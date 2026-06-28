import "dotenv/config";
import { Bot } from "grammy";
import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_PROMPT,
  WELCOME,
  HELP,
  LINKS,
  AUDIT_INFO,
  GENERATE_INFO,
  SCAN_USAGE,
  groupWelcome,
} from "./knowledge";
import { findAddress, scanToken } from "./scan";
import { startAlertPoller, setAlertsChatId } from "./alerts";

// ---- config ----
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!TELEGRAM_BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN — set it in .env (get one from @BotFather).");
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY — set it in .env (server-side only).");
  process.exit(1);
}

const MODEL = "claude-haiku-4-5"; // fast + cheap, right tier for a high-traffic guide bot
const MAX_TOKENS = 1024; // concise Telegram answers
const MAX_HISTORY = 12; // keep the last ~6 turns of context
const COOLDOWN_MS = 1500; // simple per-user anti-spam
const TG_LIMIT = 4000; // Telegram hard cap is 4096; leave headroom

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const bot = new Bot(TELEGRAM_BOT_TOKEN);

// ---- per-chat state (in-memory) ----
type Turn = { role: "user" | "assistant"; content: string };
const history = new Map<number, Turn[]>();
const lastSeen = new Map<number, number>();

function getHistory(chatId: number): Turn[] {
  let turns = history.get(chatId);
  if (!turns) {
    turns = [];
    history.set(chatId, turns);
  }
  return turns;
}

function trim(turns: Turn[]): void {
  while (turns.length > MAX_HISTORY) turns.shift();
}

// Split a long reply into Telegram-sized chunks on newline boundaries.
function chunk(text: string): string[] {
  const out: string[] = [];
  let s = text.trim();
  while (s.length > TG_LIMIT) {
    let cut = s.lastIndexOf("\n", TG_LIMIT);
    if (cut < TG_LIMIT * 0.5) cut = TG_LIMIT; // no good break point — hard split
    out.push(s.slice(0, cut).trim());
    s = s.slice(cut).trim();
  }
  if (s) out.push(s);
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function askClaude(chatId: number, userText: string): Promise<string> {
  const turns = getHistory(chatId);
  turns.push({ role: "user", content: userText });
  trim(turns);

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: turns.map((t) => ({ role: t.role, content: t.content })),
  });

  const text =
    resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim() ||
    "Sorry — I didn't catch that. Try rephrasing, or visit https://www.pentagonal.ai";

  turns.push({ role: "assistant", content: text });
  trim(turns);
  return text;
}

// ---- commands ----
bot.command("start", async (ctx) => {
  history.delete(ctx.chat.id);
  await ctx.reply(WELCOME, { link_preview_options: { is_disabled: true } });
});
bot.command("help", (ctx) => ctx.reply(HELP, { link_preview_options: { is_disabled: true } }));
bot.command("links", (ctx) => ctx.reply(LINKS, { link_preview_options: { is_disabled: true } }));
bot.command("audit", (ctx) => ctx.reply(AUDIT_INFO, { link_preview_options: { is_disabled: true } }));
bot.command("generate", (ctx) =>
  ctx.reply(GENERATE_INFO, { link_preview_options: { is_disabled: true } })
);
bot.command("reset", (ctx) => {
  history.delete(ctx.chat.id);
  return ctx.reply("Cleared our chat memory. Fresh start 🛡️");
});
bot.command("alertshere", (ctx) => {
  setAlertsChatId(ctx.chat.id);
  return ctx.reply(
    "🛡️ Pentagon Sentinel alerts will be posted in this chat. Run /alertshere again elsewhere to move them."
  );
});
bot.command("scan", async (ctx) => {
  const address = findAddress(ctx.match ?? "");
  if (!address) {
    return ctx.reply(SCAN_USAGE, { link_preview_options: { is_disabled: true } });
  }
  await ctx.replyWithChatAction("typing");
  const result = await scanToken(address);
  await ctx.reply(result, { link_preview_options: { is_disabled: true } });
});

// ---- greet on being added to a group (once), tagging whoever added the bot ----
bot.on("my_chat_member", async (ctx) => {
  const upd = ctx.myChatMember;
  if (upd.new_chat_member.user.id !== ctx.me.id) return; // must be about this bot
  const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
  const wasOut = upd.old_chat_member.status === "left" || upd.old_chat_member.status === "kicked";
  const isIn =
    upd.new_chat_member.status === "member" || upd.new_chat_member.status === "administrator";
  if (!isGroup || !wasOut || !isIn) return; // only on a fresh add to a group

  const adder = upd.from;
  const name = escapeHtml(adder.first_name || "");
  const who = adder.username
    ? name
      ? `@${adder.username} (${name})`
      : `@${adder.username}`
    : `<a href="tg://user?id=${adder.id}">${name || "there"}</a>`;

  try {
    await ctx.reply(groupWelcome(who), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    console.error("group greeting error:", err);
  }
});

// ---- free-text messages ----
bot.on("message:text", async (ctx) => {
  const raw = ctx.message.text;
  if (raw.startsWith("/")) return; // commands are handled by their own handlers

  // Only respond when directly addressed:
  //  • private chat (DM)     → always (a DM is 1:1 with the bot)
  //  • group / supergroup    → only if @mentioned, or replying to one of the bot's messages
  // Commands (/scan, /audit, …) always work — they're handled above and count as being "called on".
  const isPrivate = ctx.chat.type === "private";
  const mentionRe = ctx.me.username ? new RegExp(`@${ctx.me.username}\\b`, "i") : null;
  const mentioned = mentionRe ? mentionRe.test(raw) : false;
  const repliedToBot = ctx.message.reply_to_message?.from?.id === ctx.me.id;
  if (!isPrivate && !mentioned && !repliedToBot) return; // ambient group chatter — stay silent

  // Strip the @mention so it doesn't pollute the scan / prompt.
  const text = (mentionRe ? raw.replace(mentionRe, " ") : raw).trim();

  const userId = ctx.from?.id ?? ctx.chat.id;
  const now = Date.now();
  if (now - (lastSeen.get(userId) ?? 0) < COOLDOWN_MS) return;
  lastSeen.set(userId, now);

  if (!text) {
    // mentioned with no actual question
    await ctx.reply(
      "👋 Ask me anything about Pentagonal, or paste a token address to scan. Try /help.",
      { link_preview_options: { is_disabled: true } }
    );
    return;
  }

  // A bare contract address → scan it directly (free, deterministic, no LLM cost).
  const address = findAddress(text);
  if (address) {
    try {
      await ctx.replyWithChatAction("typing");
      const result = await scanToken(address);
      await ctx.reply(result, { link_preview_options: { is_disabled: true } });
    } catch (err) {
      console.error("scan error:", err);
      await ctx.reply(
        "⚠️ Couldn't scan that right now. Try again shortly, or open it in the Forge: https://www.pentagonal.ai/forge"
      );
    }
    return;
  }

  try {
    await ctx.replyWithChatAction("typing");
    const answer = await askClaude(ctx.chat.id, text);
    for (const part of chunk(answer)) {
      await ctx.reply(part, { link_preview_options: { is_disabled: true } });
    }
  } catch (err) {
    console.error("askClaude error:", err);
    await ctx.reply(
      "⚠️ Something went wrong on my end. Try again in a moment, or head to https://www.pentagonal.ai"
    );
  }
});

bot.catch((err) => console.error("Bot error:", err));

startAlertPoller(bot);

bot.start({
  onStart: (info) => console.log(`✅ Pentagonal bot online as @${info.username}`),
});
