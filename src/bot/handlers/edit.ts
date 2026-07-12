// /edit — ubah order aktif: percepat/ubah tanggal selesai, ubah deadline,
// atau batalkan. Alur: pilih order (tombol) → pilih aksi (tombol) →
// balas tanggal (teks, format bebas "15 agustus").
import { Context } from 'grammy';
import { M, tpl } from '../messages.js';
import {
  getActiveOrders,
  getOrder,
  setOrderStatus,
  updateOrder,
} from '../../db/repo.js';
import { editFieldKeyboard, editPickKeyboard } from '../keyboards.js';
import { endEdit, getEdit, setEdit } from '../session.js';
import { parseDateID } from './libur.js';
import { todayISO } from '../../config.js';
import { formatID, parseISO } from '../../util/dates.js';
import { getTailorByChat } from '../../db/repo.js';

const MD = { parse_mode: 'Markdown' as const };

export async function handleEdit(ctx: Context): Promise<void> {
  const tailor = await getTailorByChat(ctx.chat!.id);
  if (!tailor) {
    await ctx.reply(M.notRegistered);
    return;
  }
  const orders = await getActiveOrders(tailor.id);
  if (!orders.length) {
    await ctx.reply(M.editEmpty);
    return;
  }
  await ctx.reply(M.editPick, { reply_markup: editPickKeyboard(orders) });
}

/** Callback edit:<orderId> — tampilkan pilihan aksi. */
export async function onEditPick(ctx: Context, data: string): Promise<void> {
  const [, orderId] = data.split(':');
  const order = await getOrder(orderId);
  if (!order) {
    await ctx.answerCallbackQuery({ text: 'Order tak ditemukan.' });
    return;
  }
  await ctx.answerCallbackQuery();
  await ctx.reply(
    tpl(M.editWhat, { label: `${order.quantity}× ${order.item_label}` }),
    { ...MD, reply_markup: editFieldKeyboard(orderId) },
  );
}

/** Callback editf:<orderId>:<field> — batalkan langsung / minta tanggal. */
export async function onEditField(ctx: Context, data: string): Promise<void> {
  const [, orderId, field] = data.split(':');
  const order = await getOrder(orderId);
  if (!order) {
    await ctx.answerCallbackQuery({ text: 'Order tak ditemukan.' });
    return;
  }

  if (field === 'cancel') {
    await setOrderStatus(orderId, 'cancelled');
    await ctx.answerCallbackQuery({ text: 'Dibatalkan 🗑' });
    await ctx.reply(
      tpl(M.editCancelled, { label: `${order.quantity}× ${order.item_label}` }),
      MD,
    );
    return;
  }

  if (field === 'finish' || field === 'deadline') {
    setEdit(ctx.chat!.id, { orderId, field });
    await ctx.answerCallbackQuery();
    await ctx.reply(field === 'finish' ? M.editAskFinish : M.editAskDeadline, MD);
    return;
  }

  await ctx.answerCallbackQuery();
}

/** Balasan teks saat menunggu tanggal edit. True bila pesan tertelan. */
export async function tryEditReply(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat!.id;
  const pending = getEdit(chatId);
  if (!pending) return false;

  const text = (ctx.message?.text ?? '').trim();
  if (/^batal$/i.test(text)) {
    endEdit(chatId);
    await ctx.reply(M.editAborted);
    return true;
  }

  const today = todayISO();
  const date = parseDateID(text, today);
  if (!date) {
    await ctx.reply(M.liburParseFailed, MD); // pesan contoh format sama
    return true;
  }
  if (date < today) {
    await ctx.reply(M.liburPast, MD);
    return true;
  }

  const order = await getOrder(pending.orderId);
  endEdit(chatId);
  if (!order) {
    await ctx.reply(M.errGeneric);
    return true;
  }

  const y = parseISO(today).getUTCFullYear();
  if (pending.field === 'finish') {
    const patch: Record<string, string> = { finish_date: date };
    // Selesai lebih awal dari jadwal mulai → mulai ikut maju.
    if (order.start_date && date < order.start_date) patch.start_date = date;
    await updateOrder(order.id, patch);
    await ctx.reply(
      tpl(M.editFinishSet, {
        label: `${order.quantity}× ${order.item_label}`,
        date: formatID(date, y),
      }),
      MD,
    );
  } else {
    await updateOrder(order.id, { deadline: date });
    const note =
      order.finish_date && order.finish_date > date
        ? M.editDeadlineTight
        : '';
    await ctx.reply(
      tpl(M.editDeadlineSet, {
        label: `${order.quantity}× ${order.item_label}`,
        date: formatID(date, y),
      }) + note,
      MD,
    );
  }
  return true;
}
