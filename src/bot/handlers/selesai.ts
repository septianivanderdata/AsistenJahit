// §6.3 — /selesai: tampilkan order aktif sbg tombol → tandai done (bebaskan kapasitas).
import { Context } from 'grammy';
import { M } from '../messages.js';
import { getActiveOrders, getTailorByChat } from '../../db/repo.js';
import { selesaiKeyboard } from '../keyboards.js';

export async function handleSelesai(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const tailor = await getTailorByChat(chatId);
  if (!tailor) {
    await ctx.reply(M.notRegistered);
    return;
  }
  const orders = await getActiveOrders(tailor.id);
  if (!orders.length) {
    await ctx.reply(M.selesaiEmpty);
    return;
  }
  await ctx.reply(M.selesaiPick, { reply_markup: selesaiKeyboard(orders) });
}
