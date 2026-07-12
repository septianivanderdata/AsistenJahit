// §6.2 tombol aksi + §6.3 /selesai callback.
import { Context } from 'grammy';
import { M, quote, tpl } from '../messages.js';
import {
  getDecidedSince,
  getItemTypes,
  getOrder,
  getPartners,
  getTailorByChat,
  setOrderStatus,
  updateItemType,
} from '../../db/repo.js';
import { monthlyRecap } from '../../core/recap.js';
import { rupiah } from '../../util/format.js';
import { partnerKeyboard } from '../keyboards.js';
import { draftReply, DraftContext } from '../../llm/drafts.js';
import { Order, Tailor } from '../../db/types.js';
import { learnHoursPerUnit } from '../../core/learning.js';
import { todayISO } from '../../config.js';
import { replyMD } from '../reply.js';
import { onEditField, onEditPick } from './edit.js';

const MD = { parse_mode: 'Markdown' as const };

export async function handleCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data ?? '';
  try {
    if (data.startsWith('act:')) return await onAction(ctx, data);
    if (data.startsWith('partner:')) return await onPartner(ctx, data);
    if (data.startsWith('done:')) return await onDone(ctx, data);
    if (data.startsWith('editf:')) return await onEditField(ctx, data);
    if (data.startsWith('edit:')) return await onEditPick(ctx, data);
  } catch (e) {
    console.error('callback error', e);
    await ctx.answerCallbackQuery({ text: 'Ada kendala, coba lagi.' });
    return;
  }
  await ctx.answerCallbackQuery();
}

function ctxFromOrder(o: Order, partnerName?: string): DraftContext {
  const ex = (o.extracted ?? {}) as any;
  return {
    customerName: o.customer_name,
    itemLabel: o.item_label,
    quantity: o.quantity,
    deadline: o.deadline,
    finishDate: o.finish_date,
    daysLate: readDaysLate(o),
    partnerName,
    outsourcePerUnit: o.outsource_cost,
    rawMessage: o.raw_message,
    ...(ex ? {} : {}),
  };
}

function readDaysLate(o: Order): number | null {
  const v = (o.verdict ?? {}) as any;
  return v?.schedule?.daysLate ?? null;
}

async function onAction(ctx: Context, data: string): Promise<void> {
  const [, decision, orderId] = data.split(':');
  const order = await getOrder(orderId);
  if (!order) {
    await ctx.answerCallbackQuery({ text: 'Order tak ditemukan.' });
    return;
  }

  if (decision === 'accept') {
    await setOrderStatus(orderId, 'accepted');
    await ctx.answerCallbackQuery({ text: 'Diterima ✅' });
    const draft = await draftReply('accept', ctxFromOrder(order));
    await ctx.reply(M.accepted, MD);
    await replyMD(ctx, quote(draft) + '\n' + M.copyHint);
    return;
  }

  if (decision === 'reject') {
    await setOrderStatus(orderId, 'rejected');
    await ctx.answerCallbackQuery({ text: 'Ditolak 🙏' });
    const draft = await draftReply('reject', ctxFromOrder(order));
    await ctx.reply(M.rejected, MD);
    await replyMD(ctx, quote(draft) + '\n' + M.copyHint);
    // Sinyal naik kelas: total nilai order ditolak bulan berjalan.
    try {
      const monthStart = todayISO().slice(0, 7) + '-01';
      const r = monthlyRecap(await getDecidedSince(order.tailor_id, monthStart));
      if (r.rejectedTotal > 0) {
        await ctx.reply(
          tpl(M.rejectedSignal, {
            total: rupiah(r.rejectedTotal),
            count: String(r.rejectedCount),
          }),
          MD,
        );
      }
    } catch (e) {
      console.error('rekap tolak gagal (order tetap ditolak)', e);
    }
    return;
  }

  if (decision === 'outsource') {
    const tailor = await getTailorByChat(ctx.chat!.id);
    const partners = tailor ? await getPartners(tailor.id) : [];
    if (!partners.length) {
      await ctx.answerCallbackQuery();
      await ctx.reply(M.noPartners);
      return;
    }
    await ctx.answerCallbackQuery();
    await ctx.reply(M.pickPartner, { reply_markup: partnerKeyboard(orderId, partners) });
    return;
  }

  await ctx.answerCallbackQuery();
}

async function onPartner(ctx: Context, data: string): Promise<void> {
  const [, orderId, partnerId] = data.split(':');
  const order = await getOrder(orderId);
  const tailor = await getTailorByChat(ctx.chat!.id);
  const partners = tailor ? await getPartners(tailor.id) : [];
  const partner = partners.find((p) => p.id === partnerId);
  if (!order || !partner) {
    await ctx.answerCallbackQuery({ text: 'Data tak ditemukan.' });
    return;
  }
  await setOrderStatus(orderId, 'outsourced', { partner_id: partnerId });
  await ctx.answerCallbackQuery({ text: `Dioper ke ${partner.name} 🤝` });
  const draft = await draftReply('outsource', ctxFromOrder(order, partner.name));
  await ctx.reply(tpl(M.outsourced, { partner: partner.name }), MD);
  await replyMD(ctx, quote(draft) + '\n' + M.copyHint);
}

async function onDone(ctx: Context, data: string): Promise<void> {
  const [, orderId] = data.split(':');
  const order = await getOrder(orderId);
  if (!order) {
    await ctx.answerCallbackQuery({ text: 'Order tak ditemukan.' });
    return;
  }
  await setOrderStatus(orderId, 'done');
  await ctx.answerCallbackQuery({ text: 'Selesai ✅' });
  await ctx.reply(tpl(M.selesaiDone, { label: order.item_label }), MD);

  // Belajar dari realita: koreksi durasi item dari tanggal selesai asli.
  try {
    const tailor = await getTailorByChat(ctx.chat!.id);
    if (tailor) {
      const note = await learnFromCompletion(tailor, order);
      if (note) await ctx.reply(note, MD);
    }
  } catch (e) {
    console.error('learning gagal (order tetap selesai)', e);
  }
}

/** Koreksi hours_per_unit item dari order selesai; balikan pesan bila berubah. */
async function learnFromCompletion(
  tailor: Tailor,
  order: Order,
): Promise<string | null> {
  if (!order.item_type_id || !order.finish_date) return null;
  const items = await getItemTypes(tailor.id);
  const item = items.find((t) => t.id === order.item_type_id);
  if (!item) return null;

  const result = learnHoursPerUnit({
    oldHoursPerUnit: Number(item.hours_per_unit),
    estHours: Number(order.est_hours),
    quantity: order.quantity,
    estFinish: order.finish_date,
    actualFinish: todayISO(),
    profile: {
      workHoursPerDay: Number(tailor.work_hours_per_day),
      workDaysPerWeek: Number(tailor.work_days_per_week),
    },
  });
  if (!result) return null;

  await updateItemType(item.id, { hours_per_unit: result.newHoursPerUnit });
  return tpl(M.learnAdjusted, {
    name: item.name,
    old: String(Number(item.hours_per_unit)),
    new: String(result.newHoursPerUnit),
  });
}
