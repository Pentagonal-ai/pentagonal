# Pentagonal Telegram Bot — Runbook

How to operate **@pentagonalaibot**. It runs as a macOS **LaunchDaemon** on the headless box,
so it auto-starts at boot and auto-restarts on crash.

| | |
|---|---|
| Host | `achillesheadless@192.168.1.244` |
| Service (label) | `com.pentagonal.telegrambot` |
| Plist | `/Library/LaunchDaemons/com.pentagonal.telegrambot.plist` |
| Code | `~/apps/pentagonal-telegram-bot` |
| Logs | `~/apps/pentagonal-telegram-bot/logs/bot.out.log` (+ `bot.err.log`) |
| Node | `~/.local/node/bin` |

> **First:** SSH in → `ssh achillesheadless@192.168.1.244` → then run the commands below.
> `sudo` will prompt for your password.

---

## ⏹ STOP the bot

The process auto-restarts (KeepAlive), so `kill` will **not** stop it — you must unload the service:

```bash
sudo launchctl bootout system/com.pentagonal.telegrambot
```

Stops it immediately. It stays off until you start it again **or the box reboots** (a reboot reloads it).

**Stop it for good (stays off across reboots):**

```bash
sudo launchctl bootout  system/com.pentagonal.telegrambot   # stop now
sudo launchctl disable  system/com.pentagonal.telegrambot   # block auto-start at boot
```

---

## ▶️ START the bot

```bash
sudo launchctl enable    system/com.pentagonal.telegrambot                                  # only if you ran `disable`
sudo launchctl bootstrap system /Library/LaunchDaemons/com.pentagonal.telegrambot.plist
```

## 🔄 RESTART (e.g. after a code change)

```bash
sudo launchctl kickstart -k system/com.pentagonal.telegrambot
```

## 📊 STATUS & LOGS

```bash
sudo launchctl print system/com.pentagonal.telegrambot | grep -i 'state ='   # running / not running
pgrep -fl dist/bot.js                                                        # the live process
tail -f  ~/apps/pentagonal-telegram-bot/logs/bot.out.log                     # live output
tail -n 50 ~/apps/pentagonal-telegram-bot/logs/bot.err.log                   # recent errors
```

You should see `✅ Pentagonal bot online as @pentagonalaibot` in the out log when healthy.

---

## ⬆️ DEPLOY A CODE UPDATE (run from your Mac)

```bash
rsync -az --delete --exclude node_modules --exclude dist --exclude .git --exclude logs \
  ~/Documents/Pentagonal/telegram-bot/ achillesheadless@192.168.1.244:apps/pentagonal-telegram-bot/

ssh -t achillesheadless@192.168.1.244 \
  'cd ~/apps/pentagonal-telegram-bot && export PATH=$HOME/.local/node/bin:$PATH && npm install && npm run build && sudo launchctl kickstart -k system/com.pentagonal.telegrambot'
```

## 🖥 ONE-LINERS FROM YOUR MAC (no SSH session)

`-t` gives sudo a terminal so it can prompt for your password:

```bash
ssh -t achillesheadless@192.168.1.244 'sudo launchctl bootout system/com.pentagonal.telegrambot'        # stop
ssh -t achillesheadless@192.168.1.244 'sudo launchctl bootstrap system /Library/LaunchDaemons/com.pentagonal.telegrambot.plist'  # start
ssh -t achillesheadless@192.168.1.244 'sudo launchctl kickstart -k system/com.pentagonal.telegrambot'   # restart
ssh    achillesheadless@192.168.1.244 'tail -n 30 ~/apps/pentagonal-telegram-bot/logs/bot.out.log'      # logs
```

---

## ⚠️ RULES & GOTCHAS

- **One poller only.** Never run a second instance (e.g. `npm start` on your Mac) while the
  headless service is up — Telegram returns **HTTP 409**. Stop one before starting the other.
- **`kill` / `pkill` won't stop it** — KeepAlive respawns it in ~10s. Use **`bootout`** to stop.
- **Secrets** live in `~/apps/pentagonal-telegram-bot/.env` (chmod 600, gitignored). If the bot
  token ever leaks: `@BotFather` → `/revoke`, paste the new token into `.env`, then restart.
- **Edit what the bot says** in `src/knowledge.ts` (answers, greeting, commands), then deploy.
