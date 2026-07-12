// /libur — kelola tanggal libur khusus (nasional/cuti/sakit).
// /libur              → daftar libur mendatang + cara pakai
// /libur 17 agustus   → toggle: tambah (atau hapus bila sudah ada)
// /libur 2026-08-17   → format ISO juga diterima
import { Context } from 'grammy';
import { M, tpl } from '../messages.js';
import { getTailorByChat } from '../../db/repo.js';
import { getDaysOff, pruneDaysOff, toggleDayOff } from '../daysoff.js';
import { todayISO } from '../../config.js';
import { ISODate, formatID, parseISO } from '../../util/dates.js';

const MD = { parse_mode: 'Markdown' as const };

const BULAN: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8,
  sep: 9, okt: 10, nov: 11, des: 12,
};

/** Parse "17 agustus", "17 agustus 2026", "2026-08-17" → ISO; null bila gagal. */
export function parseDateID(input: string, today: ISODate): ISODate | null {
  const s = input.trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = BULAN[m[2]];
  if (!mon || day < 1 || day > 31) return null;

  const thisYear = Number(today.slice(0, 4));
  let year = m[3] ? Number(m[3]) : thisYear;
  let iso = toISO(year, mon, day);
  // Tanpa tahun & tanggal sudah lewat → maksudnya tahun depan.
  if (!m[3] && iso < today) iso = toISO(thisYear + 1, mon, day);
  return iso;
}

function toISO(y: number, m: number, d: number): ISODate {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export async function handleLibur(ctx: Context): Promise<void> {
  const tailor = await getTailorByChat(ctx.chat!.id);
  if (!tailor) {
    await ctx.reply(M.notRegistered);
    return;
  }
  const today = todayISO();
  pruneDaysOff(tailor.id, today);

  const arg = (ctx.message?.text ?? '').replace(/^\/libur\s*/i, '').trim();
  const y = parseISO(today).getUTCFullYear();

  if (!arg) {
    const days = [...getDaysOff(tailor.id)].sort();
    const list = days.length
      ? days.map((d) => `• ${formatID(d, y)}`).join('\n')
      : '_(belum ada)_';
    await ctx.reply(tpl(M.liburList, { list }), MD);
    return;
  }

  const date = parseDateID(arg, today);
  if (!date) {
    await ctx.reply(M.liburParseFailed, MD);
    return;
  }
  if (date < today) {
    await ctx.reply(M.liburPast, MD);
    return;
  }

  const added = toggleDayOff(tailor.id, date);
  const msg = added ? M.liburAdded : M.liburRemoved;
  await ctx.reply(tpl(msg, { date: formatID(date, y) }), MD);
}
