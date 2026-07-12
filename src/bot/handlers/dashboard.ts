// /dashboard — magic link: kirim link dashboard pribadi penjahit.
// UUID tailor bertindak sebagai kapabilitas rahasia (tak bisa ditebak);
// keamanan data bertumpu pada RLS anon read-only di Supabase.
import { Context } from 'grammy';
import { M } from '../messages.js';
import { config } from '../../config.js';
import { getTailorByChat } from '../../db/repo.js';

export async function handleDashboard(ctx: Context): Promise<void> {
  const tailor = await getTailorByChat(ctx.chat!.id);
  if (!tailor) {
    await ctx.reply(M.notRegistered);
    return;
  }
  const url = new URL(config.dashboardBaseUrl);
  // Bila halaman deploy sudah menanam URL+key, param ini sekadar menimpa
  // dengan nilai sama; bila belum (dev lokal), param ini yang dipakai.
  url.searchParams.set('url', config.supabaseUrl);
  url.searchParams.set('key', config.supabaseAnonKey);
  url.searchParams.set('tailor', tailor.id);
  await ctx.reply(`${M.dashboardLink}\n${url.toString()}`, {
    link_preview_options: { is_disabled: true },
  });
}
