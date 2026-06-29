// Deploy Qcipher contracts (KeyRegistry + Messenger) to Base.
//   node scripts/deploy-qcipher.mjs            -> Base Sepolia (testnet, default)
//   node scripts/deploy-qcipher.mjs --mainnet  -> Base mainnet
// Requires DEPLOYER_PRIVATE_KEY (a funded deployer). See contracts/qcipher/DEPLOY.md.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

const require = createRequire(import.meta.url);
const solc = require('solc');

const chain = process.argv.includes('--mainnet') ? base : baseSepolia;

const rawKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!rawKey) {
  console.error('Set DEPLOYER_PRIVATE_KEY (a funded deployer key). See contracts/qcipher/DEPLOY.md');
  process.exit(1);
}
const account = privateKeyToAccount(rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`);
const rpc = process.env.QCIPHER_RPC_URL || chain.rpcUrls.default.http[0];

function compile() {
  const sources = {
    'KeyRegistry.sol': { content: readFileSync('contracts/qcipher/KeyRegistry.sol', 'utf8') },
    'Messenger.sol': { content: readFileSync('contracts/qcipher/Messenger.sol', 'utf8') },
  };
  const input = {
    language: 'Solidity',
    sources,
    settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errs = (out.errors || []).filter((e) => e.severity === 'error');
  if (errs.length) {
    errs.forEach((e) => console.error(e.formattedMessage));
    process.exit(1);
  }
  const pick = (file, name) => ({
    abi: out.contracts[file][name].abi,
    bytecode: `0x${out.contracts[file][name].evm.bytecode.object}`,
  });
  return { KeyRegistry: pick('KeyRegistry.sol', 'KeyRegistry'), Messenger: pick('Messenger.sol', 'Messenger') };
}

const wallet = createWalletClient({ account, chain, transport: http(rpc) });
const pub = createPublicClient({ chain, transport: http(rpc) });

async function deploy(name, artifact) {
  process.stdout.write(`deploying ${name} to ${chain.name}… `);
  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args: [] });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log(receipt.contractAddress);
  return receipt.contractAddress;
}

const art = compile();
console.log(`deployer ${account.address} on ${chain.name} (chainId ${chain.id})`);
const keyRegistry = await deploy('KeyRegistry', art.KeyRegistry);
const messenger = await deploy('Messenger', art.Messenger);

console.log('\n--- add to .env.local (and switch abi.ts chainId for testnet) ---');
console.log(`NEXT_PUBLIC_QCIPHER_KEY_REGISTRY=${keyRegistry}`);
console.log(`NEXT_PUBLIC_QCIPHER_MESSENGER=${messenger}`);
