// Kirim pesan Markdown dengan jaring pengaman: bila entity Markdown dari
// teks LLM rusak (underscore/asterisk tak berpasangan), Telegram menolak
// seluruh pesan — fallback kirim ulang sebagai teks polos.
import { Context } from 'grammy';

export async function replyMD(
  ctx: Context,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  try {
    await ctx.reply(text, { parse_mode: 'Markdown', ...extra });
  } catch {
    await ctx.reply(text, { ...extra });
  }
}
