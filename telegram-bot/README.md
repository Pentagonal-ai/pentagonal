# Pentagonal Telegram Bot

A Claude Haiku–powered guide bot for Telegram. It explains what Pentagonal does,
how the 8-agent adversarial audit works, and links users into the Forge, the MCP
server, and x402 — grounded entirely in the real Pentagonal product spec.

- **Model:** `claude-haiku-4-5` (fast + cheap, right for a high-traffic guide bot)
- **Framework:** [grammY](https://grammy.dev) (Telegram) + `@anthropic-ai/sdk`
- **Mode:** long polling — runs anywhere, no public URL or webhook needed
- **Knowledge:** system-prompt grounding (see `src/knowledge.ts`), not fine-tuning

## Security

The Anthropic API key lives **only** in this bot's server-side `.env` (gitignored).
It is never sent to a client. Same for the Telegram token. Don't commit `.env`.

## Setup

1. **Create the bot** — message [@BotFather](https://t.me/BotFather) on Telegram,
   send `/newbot`, follow the prompts, and copy the HTTP API token.

2. **Configure env:**
   ```bash
   cd telegram-bot
   cp .env.example .env
   # edit .env and paste TELEGRAM_BOT_TOKEN and ANTHROPIC_API_KEY
   ```

3. **Install + run:**
   ```bash
   npm install
   npm run dev      # hot-reload during development
   # or, for production:
   npm run build && npm start
   ```

When it connects you'll see: `✅ Pentagonal bot online as @YourBotName`.

## Configure the bot profile (one command)

After `.env` is set, register the command menu + name + descriptions via the Bot API — no manual BotFather steps:

```bash
npm run setup
```

This sets the tap-menu of commands, the bot name, the short description (profile/sharing), and the long description (shown in an empty chat). Edit the copy in [`src/knowledge.ts`](src/knowledge.ts) (`BOT_NAME`, `SHORT_DESCRIPTION`, `DESCRIPTION`, `COMMANDS`) and re-run.

> Telegram throttles **name** changes; if `bot name` is skipped on re-run that's just the rate limit — the rest still apply. Manual fallback: `@BotFather` → `/setcommands`, `/setname`, `/setdescription`, `/setabouttext`.

## Commands

| Command | Does |
|---|---|
| `/start` | Intro + resets the chat memory |
| `/scan` | Scan a token address — price, liquidity, market cap, trade activity |
| `/audit` | How the 8-agent audit works |
| `/generate` | How contract generation works |
| `/links` | All official Pentagonal links |
| `/reset` | Clear this chat's memory |
| `/help` | What the bot can do |

**Token scan:** users can also just **paste a contract address** (EVM `0x…` or a Solana address) with no command — the bot auto-detects it, calls Pentagonal's free `detect-chain` + `token-info` endpoints, and returns a market snapshot. It always ends by pointing to the Forge to run the actual audit — the bot **scans, it does not run** audits/generation in-chat.

Anything else is answered by Claude Haiku using the Pentagonal knowledge base.

## Deployment (headless M1 Max — live)

Deployed and running 24/7 on the headless box as a native macOS **LaunchDaemon**
(boot-persistent, auto-restart on crash, runs as the user — no inbound ports,
since long polling is outbound-only).

| | |
|---|---|
| Host | `achillesheadless@192.168.1.244` |
| Path | `~/apps/pentagonal-telegram-bot` |
| Node | `~/.local/node` (v22, official arm64 build, no sudo) |
| Service | `/Library/LaunchDaemons/com.pentagonal.telegrambot.plist` |
| Logs | `logs/bot.out.log`, `logs/bot.err.log` |

Manage it (over SSH on the headless box):

```bash
# status
sudo launchctl list | grep pentagonal
# follow logs
tail -f ~/apps/pentagonal-telegram-bot/logs/bot.out.log
# restart
sudo launchctl kickstart -k system/com.pentagonal.telegrambot
# stop / start
sudo launchctl bootout   system /Library/LaunchDaemons/com.pentagonal.telegrambot.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.pentagonal.telegrambot.plist
```

**Deploy a code update** (from this machine):

```bash
rsync -az --delete --exclude node_modules --exclude dist --exclude .git \
  ~/Documents/Pentagonal/telegram-bot/ achillesheadless@192.168.1.244:apps/pentagonal-telegram-bot/
ssh achillesheadless@192.168.1.244 \
  'cd ~/apps/pentagonal-telegram-bot && export PATH=$HOME/.local/node/bin:$PATH && npm install && npm run build && sudo launchctl kickstart -k system/com.pentagonal.telegrambot'
```

> **One poller only.** Telegram long polling allows a single active poller per bot
> token. Don't run a second instance anywhere (local `npm start`, another box) while
> the headless service is up — you'll get HTTP 409 conflicts. Stop one first.

## Editing the bot's knowledge

All facts and canned replies live in [`src/knowledge.ts`](src/knowledge.ts).
Update the `SYSTEM_PROMPT` there when the product changes (new chains, pricing,
links). The bot is told **not** to invent anything beyond that file.

## Optional next steps

- **Profile photo:** the only profile bit not set by `npm run setup` — add the
  Pentagonal `P` via `@BotFather` → `/setuserpic`.
- **Group mode:** works in groups if you disable BotFather privacy mode, or keep
  it DM-only (default).
- **Richer scan:** `token-info` returns DexScreener market data. To add honeypot /
  LP-lock / source-verification signals in-chat, extend `src/scan.ts` to also call
  the relevant Pentagonal endpoint. Audits/generation stay web-only by design.
