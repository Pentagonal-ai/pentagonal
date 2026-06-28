// Pentagonal Sentinel — Telegram alert poller (Chunk 3)
// Polls the Supabase `alerts` table for undelivered rows, posts them to the configured
// chat, and flips `delivered`. The target chat is set with /alertshere (persisted to a
// local file) or via the ALERTS_CHAT_ID env var.
import fs from "fs";
import path from "path";
import { Bot } from "grammy";
import { createClient } from "@supabase/supabase-js";

const CHAT_FILE = path.join(__dirname, "..", "alerts-chat.json");
const POLL_MS = 15000;

export function getAlertsChatId(): number | null {
  const env = process.env.ALERTS_CHAT_ID;
  if (env && Number.isFinite(Number(env))) return Number(env);
  try {
    const j = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
    return typeof j.chatId === "number" ? j.chatId : null;
  } catch {
    return null;
  }
}

export function setAlertsChatId(chatId: number): void {
  fs.writeFileSync(CHAT_FILE, JSON.stringify({ chatId }), "utf8");
}

type AlertRow = {
  id: string;
  type: string;
  severity: string;
  address: string | null;
  chain: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

const SEV_ICON: Record<string, string> = {
  critical: "🔴", high: "🟠", medium: "🟡", low: "🔵", info: "⚪",
};

function fmt(a: AlertRow): string {
  const icon = SEV_ICON[a.severity] ?? "⚪";
  const title = String((a.payload?.title as string) || a.type.replace(/_/g, " "));
  const lines = [`${icon} ${a.severity.toUpperCase()} — ${title}`];
  if (a.address) lines.push(`${a.chain ?? ""} ${a.address}`.trim());
  const message = a.payload?.message as string | undefined;
  if (message) lines.push("", message);
  if (a.payload?.score !== undefined) lines.push(`Pentagon Score: ${a.payload.score}`);
  const url = a.payload?.url as string | undefined;
  if (url) lines.push(url);
  return lines.join("\n");
}

export function startAlertPoller(bot: Bot): void {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("⚠️  alert poller off — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to enable");
    return;
  }
  const sb = createClient(url, key);

  async function tick(): Promise<void> {
    const chatId = getAlertsChatId();
    if (!chatId) return; // not configured — run /alertshere in the target chat
    const { data, error } = await sb
      .from("alerts")
      .select("id,type,severity,address,chain,payload,created_at")
      .eq("delivered", false)
      .order("created_at", { ascending: true })
      .limit(20);
    if (error) {
      console.error("alert poll error:", error.message);
      return;
    }
    for (const a of (data ?? []) as AlertRow[]) {
      try {
        await bot.api.sendMessage(chatId, fmt(a), { link_preview_options: { is_disabled: true } });
        await sb.from("alerts").update({ delivered: true, delivered_at: new Date().toISOString() }).eq("id", a.id);
      } catch (e) {
        console.error("alert send failed:", e);
      }
    }
  }

  setInterval(() => void tick().catch((e) => console.error("alert tick:", e)), POLL_MS);
  console.log(`✅ alert poller on (every ${POLL_MS / 1000}s)`);
}
