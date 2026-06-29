// Qcipher on-chain smoke test: register a key, send an encrypted message, read it
// back from the chain, and decrypt it — proving the full round-trip on Base.
//   npx tsx scripts/smoke-qcipher.ts            # Base Sepolia (default)
//   npx tsx scripts/smoke-qcipher.ts --mainnet  # Base mainnet
// Needs SMOKE_PRIVATE_KEY (funded) + NEXT_PUBLIC_QCIPHER_{KEY_REGISTRY,MESSENGER}.

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import {
  identityFromSeed,
  publicBundle,
  serializeBundle,
  conversationId,
  initiatorSession,
  responderSession,
  encrypt,
  decrypt,
  serialize,
  deserialize,
  toChainHex,
  fromChainHex,
  KEY_REGISTRY_ABI,
  MESSENGER_ABI,
} from '../src/lib/qcipher';

const chain = process.argv.includes('--mainnet') ? base : baseSepolia;
const pk = process.env.SMOKE_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
const keyRegistry = process.env.NEXT_PUBLIC_QCIPHER_KEY_REGISTRY as `0x${string}` | undefined;
const messenger = process.env.NEXT_PUBLIC_QCIPHER_MESSENGER as `0x${string}` | undefined;

function need(v: unknown, name: string): asserts v {
  if (!v) {
    console.error(`missing ${name} — see contracts/qcipher/DEPLOY.md`);
    process.exit(1);
  }
}

function ok(name: string, cond: boolean) {
  console.log(`${cond ? 'PASS ✓' : 'FAIL ✗'}  ${name}`);
  if (!cond) process.exit(1);
}

// Public RPCs are load-balanced + eventually consistent, so a read right after a
// write can hit a lagging node. Retry the read until it reflects the write.
async function retry<T>(fn: () => Promise<T>, pred: (v: T) => boolean, tries = 12, delayMs = 1500): Promise<T> {
  let last: T | undefined;
  for (let i = 0; i < tries; i++) {
    try {
      last = await fn();
      if (pred(last)) return last;
    } catch (e) {
      if (i === tries - 1) throw e; // a lagging node can throw (e.g. range beyond head) — keep retrying
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return last as T;
}

async function main() {
  need(pk, 'SMOKE_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY)');
  need(keyRegistry, 'NEXT_PUBLIC_QCIPHER_KEY_REGISTRY');
  need(messenger, 'NEXT_PUBLIC_QCIPHER_MESSENGER');

  const account = privateKeyToAccount((pk!.startsWith('0x') ? pk! : `0x${pk!}`) as `0x${string}`);
  const rpc = process.env.QCIPHER_RPC_URL || chain.rpcUrls.default.http[0];
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });
  const pub = createPublicClient({ chain, transport: http(rpc) });
  console.log(`smoke test on ${chain.name} as ${account.address}\n`);

  // 1. derive identity + publish the public bundle on-chain
  const id = identityFromSeed(utf8ToBytes(`qcipher-smoke-${account.address}`));
  const bundleHex = toChainHex(serializeBundle(publicBundle(id)));
  console.log('register…');
  let hash = await wallet.writeContract({ address: keyRegistry!, abi: KEY_REGISTRY_ABI, functionName: 'register', args: [bundleHex] });
  const regReceipt = await pub.waitForTransactionReceipt({ hash });

  // 2. confirm registration (cheap bool) + that the bundle in the KeyRegistered log matches
  const reg = await retry(
    () => pub.readContract({ address: keyRegistry!, abi: KEY_REGISTRY_ABI, functionName: 'isRegistered', args: [account.address] }) as Promise<boolean>,
    (v) => v === true,
  );
  ok('registered on-chain (isRegistered)', reg === true);
  const regLogs = await retry(
    () => pub.getContractEvents({ address: keyRegistry!, abi: KEY_REGISTRY_ABI, eventName: 'KeyRegistered', args: { user: account.address }, fromBlock: regReceipt.blockNumber, toBlock: regReceipt.blockNumber }),
    (v) => v.length > 0,
  );
  const evBundle = (regLogs[regLogs.length - 1]?.args as { bundle?: `0x${string}` } | undefined)?.bundle;
  ok('bundle matches in KeyRegistered event log', evBundle?.toLowerCase() === bundleHex.toLowerCase());

  // 3. encrypt a message in a (self) conversation, sealed under the live block
  const block = await pub.getBlock();
  const epoch = Number(block.number);
  const convo = conversationId(account.address, account.address);
  const { session, handshake } = initiatorSession(id, publicBundle(id));
  const plaintext = 'hello from base — quantum-safe, on-chain';
  const payloadHex = toChainHex(serialize(encrypt(session, utf8ToBytes(plaintext), epoch, fromChainHex(block.hash)), handshake));

  // 4. write it on-chain
  console.log('send…');
  hash = await wallet.writeContract({ address: messenger!, abi: MESSENGER_ABI, functionName: 'send', args: [convo, BigInt(epoch), payloadHex] });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  ok('message sent on-chain', receipt.status === 'success');

  // 5. read the Message event back by convoId
  const logs = await retry(
    () => pub.getContractEvents({ address: messenger!, abi: MESSENGER_ABI, eventName: 'Message', args: { convoId: convo }, fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber }),
    (v) => v.length > 0,
  );
  ok('Message event found on-chain', logs.length > 0);
  const gotPayload = logs[logs.length - 1].args.payload as `0x${string}`;

  // 6. deserialize + decrypt
  const { env, handshake: hs } = deserialize(fromChainHex(gotPayload));
  const recv = responderSession(id, publicBundle(id), hs!);
  const got = new TextDecoder().decode(decrypt(recv, env));
  ok('decrypted on-chain message matches plaintext', got === plaintext);

  console.log('\nSMOKE TEST PASSED ✓ — register → send → read → decrypt, all on-chain');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
