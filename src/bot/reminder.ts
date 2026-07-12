// Reminder deadline harian — timer in-process (cukup untuk single-process
// long polling; §3 menempatkan ini nice-to-have setelah milestone beres).
// Tiap pagi ≥07:00 Asia/Jakarta, kirim daftar order aktif yang deadline-nya
// hari ini / sudah lewat / ≤2 hari lagi. Dedup per hari via .data.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Bot } from 'grammy';
import { config, todayISO } from '../config.js';
import { getAllTailors, getUpcomingDeadlines } from '../db/repo.js';
import { M, tpl } from './messages.js';
import { addDays, diffDays, formatID, parseISO } from '../util/dates.js';

const STORE_PATH = join(process.cwd(), '.data', 'reminders.json');
const CHECK_EVERY_MS = 15 * 60_000;
const SEND_AFTER_HOUR = 7; // jam lokal
const HORIZON_DAYS = 2;

function lastSent(): string {
  try {
    return (JSON.parse(readFileSync(STORE_PATH, 'utf8')) as { lastSent: string })
      .lastSent;
  } catch {
    return '';
  }
}

function markSent(date: string): void {
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    const tmp = STORE_PATH + '.tmp';
    writeFileSync(tmp, JSON.stringify({ lastSent: date }));
    renameSync(tmp, STORE_PATH);
  } catch (e) {
    console.error('reminder mark gagal', e);
  }
}

function localHour(): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: config.tz,
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  );
}

async function tick(bot: Bot): Promise<void> {
  const today = todayISO();
  if (localHour() < SEND_AFTER_HOUR) return;
  if (lastSent() === today) return;
  // Tandai DULU: gagal kirim sebagian lebih baik daripada spam tiap 15 menit.
  markSent(today);

  const y = parseISO(today).getUTCFullYear();
  const horizon = addDays(today, HORIZON_DAYS);
  for (const tailor of await getAllTailors()) {
    try {
      const orders = await getUpcomingDeadlines(tailor.id, horizon);
      if (!orders.length) continue;
      const lines = orders.map((o) => {
        const left = diffDays(today, o.deadline!);
        const when =
          left < 0
            ? `LEWAT ${-left} hari`
            : left === 0
              ? 'HARI INI'
              : left === 1
                ? 'BESOK'
                : `${left} hari lagi`;
        const st = o.status === 'outsourced' ? '🤝 di rekan' : '🟢 kamu kerjakan';
        return `• *${o.quantity}× ${o.item_label}* — deadline ${formatID(o.deadline!, y)} (${when}) ${st}`;
      });
      await bot.api.sendMessage(
        Number(tailor.telegram_chat_id),
        tpl(M.reminderHeader, { list: lines.join('\n') }),
        { parse_mode: 'Markdown' },
      );
    } catch (e) {
      console.error(`reminder gagal utk tailor ${tailor.id}`, e);
    }
  }
}

export function startReminderLoop(bot: Bot): void {
  setInterval(() => void tick(bot), CHECK_EVERY_MS);
  void tick(bot); // cek langsung saat boot (kalau bot baru nyala siang hari)
}
