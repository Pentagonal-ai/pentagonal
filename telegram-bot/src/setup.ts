// One-shot bot profile configuration. Run: npm run setup
// Sets the command menu, name, and descriptions via the Telegram Bot API —
// no manual @BotFather steps needed. Each call is independent so a rate-limited
// one (e.g. name changes are throttled) doesn't block the others.
import "dotenv/config";
import { Bot } from "grammy";
import { BOT_NAME, SHORT_DESCRIPTION, DESCRIPTION, COMMANDS } from "./knowledge";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN — set it in .env (get one from @BotFather).");
  process.exit(1);
}

const bot = new Bot(token);

async function step(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    console.log(`✅ ${label}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️  ${label} — skipped: ${msg}`);
  }
}

(async () => {
  await step("command menu", () => bot.api.setMyCommands(COMMANDS));
  await step("bot name", () => bot.api.setMyName(BOT_NAME));
  await step("short description", () => bot.api.setMyShortDescription(SHORT_DESCRIPTION));
  await step("description", () => bot.api.setMyDescription(DESCRIPTION));
  console.log("\nDone. Open your bot in Telegram — the command menu and profile text are live.");
})().catch((e) => {
  console.error("Setup failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
