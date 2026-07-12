// /riwayat — order yang sudah selesai, ditolak, atau dibatalkan.
import { Context } from 'grammy';
import { M } from '../messages.js';
import { getHistory, getTailorByChat } from '../../db/repo.js';
import { orderValue } from '../../core/recap.js';
import { formatID, parseISO } from '../../util/dates.js';
import { rupiah } from '../../util/format.js';
import { todayISO } from '../../config.js';
import { Order } from '../../db/types.js';

const MD = { parse_mode: 'Markdown' as const };

function when(o: Order): string | null {
  const ts = o.completed_at ?? o.decided_at ?? o.created_at;
  return ts ? ts.slice(0, 10) : null;
}

export async function handleRiwayat(ctx: Context): Promise<void> {
  const tailor = await getTailorByChat(ctx.chat!.id);
  if (!tailor) {
    await ctx.reply(M.notRegistered);
    return;
  }
  const rows = await getHistory(tailor.id, 20);
  if (!rows.length) {
    await ctx.reply(M.historyEmpty);
    return;
  }

  const y = parseISO(todayISO()).getUTCFullYear();
  const line = (o: Order) => {
    const d = when(o);
    const tgl = d ? formatID(d, y) : '—';
    const val = orderValue(o);
    const rp = val > 0 ? ` · ${rupiah(val)}` : '';
    return `• *${o.quantity}× ${o.item_label}* — ${tgl}${rp}`;
  };

  const done = rows.filter((o) => o.status === 'done');
  const rejected = rows.filter((o) => o.status === 'rejected');
  const cancelled = rows.filter((o) => o.status === 'cancelled');

  const parts: string[] = [M.historyHeader];
  if (done.length) {
    parts.push('', `✅ *Selesai* (${done.length}):`, ...done.map(line));
  }
  if (rejected.length) {
    const total = rejected.reduce((s, o) => s + orderValue(o), 0);
    parts.push(
      '',
      `🙏 *Ditolak* (${rejected.length} — total ${rupiah(total)}):`,
      ...rejected.map(line),
    );
  }
  if (cancelled.length) {
    parts.push('', `🗑 *Dibatalkan* (${cancelled.length}):`, ...cancelled.map(line));
  }
  parts.push('', M.historyFooter);

  await ctx.reply(parts.join('\n'), MD);
}
