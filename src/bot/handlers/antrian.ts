// §6.3 — /antrian: daftar order aktif urut deadline + kapasitas terisi sampai.
import { Context } from 'grammy';
import { M, tpl } from '../messages.js';
import {
  getDecidedSince,
  getOrdersByDeadline,
  getTailorByChat,
} from '../../db/repo.js';
import { filledUntil } from '../../core/capacity.js';
import { monthlyRecap } from '../../core/recap.js';
import { formatID, parseISO } from '../../util/dates.js';
import { rupiah } from '../../util/format.js';
import { todayISO } from '../../config.js';

const MD = { parse_mode: 'Markdown' as const };

const STATUS_BADGE: Record<string, string> = {
  accepted: '🟢 dikerjakan',
  outsourced: '🤝 dioper',
  pending: '⏳ menunggu',
};

export async function handleAntrian(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const tailor = await getTailorByChat(chatId);
  if (!tailor) {
    await ctx.reply(M.notRegistered);
    return;
  }
  const orders = await getOrdersByDeadline(tailor.id);
  if (!orders.length) {
    await ctx.reply(M.queueEmpty);
    return;
  }

  const y = new Date().getUTCFullYear();
  const lines = [M.queueHeader, ''];
  for (const o of orders) {
    const dl = o.deadline ? formatID(o.deadline, y) : '—';
    const finish = o.finish_date ? formatID(o.finish_date, y) : '—';
    const badge = STATUS_BADGE[o.status] ?? o.status;
    lines.push(
      `• *${o.quantity}× ${o.item_label}* — deadline ${dl}, selesai ~${finish} ${badge}`,
    );
  }

  const jobs = orders
    .filter((o) => o.finish_date && o.status === 'accepted')
    .map((o) => ({
      label: o.item_label,
      estHours: Number(o.est_hours),
      startDate: o.start_date!,
      finishDate: o.finish_date!,
    }));
  const until = filledUntil(jobs);
  if (until) {
    lines.push(tpl(M.filledUntil, { date: formatID(until, parseISO(until).getUTCFullYear()) }));
  }

  // Rekap bulan berjalan — sinyal naik kelas (§1 visi).
  const monthStart = todayISO().slice(0, 7) + '-01';
  const decided = await getDecidedSince(tailor.id, monthStart);
  if (decided.length) {
    const r = monthlyRecap(decided);
    lines.push(
      tpl(M.monthlyRecap, {
        accepted: rupiah(r.acceptedTotal),
        outsourced: rupiah(r.outsourcedTotal),
        margin: rupiah(r.outsourcedMargin),
        rejected: rupiah(r.rejectedTotal),
      }),
    );
  }

  await ctx.reply(lines.join('\n'), MD);
}
