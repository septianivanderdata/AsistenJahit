// §6.3 — /profil: lihat jenis jahitan & durasi. Edit lewat /start (setup ulang).
import { Context } from 'grammy';
import { M } from '../messages.js';
import { getItemTypes, getPartners, getTailorByChat } from '../../db/repo.js';

const MD = { parse_mode: 'Markdown' as const };

export async function handleProfil(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const tailor = await getTailorByChat(chatId);
  if (!tailor) {
    await ctx.reply(M.notRegistered);
    return;
  }
  const [items, partners] = await Promise.all([
    getItemTypes(tailor.id),
    getPartners(tailor.id),
  ]);

  const lines: string[] = [
    M.profilHeader,
    `Nama: *${tailor.name}*` + (tailor.business_name ? ` — ${tailor.business_name}` : ''),
    `Jam kerja: *${tailor.work_days_per_week} hari/minggu, ${tailor.work_hours_per_day} jam/hari*`,
    '',
    '*Jenis jahitan:*',
  ];
  if (items.length) {
    for (const it of items) {
      const hari = (it.hours_per_unit / Number(tailor.work_hours_per_day)).toFixed(1);
      lines.push(`• ${it.name} — ${it.hours_per_unit} jam/pcs (~${hari} hari)`);
    }
  } else {
    lines.push('_(belum ada)_');
  }

  lines.push('', '*Rekan penjahit:*');
  if (partners.length) {
    for (const p of partners) {
      lines.push(`• ${p.name}` + (p.notes ? ` — ${p.notes}` : ''));
    }
  } else {
    lines.push('_(belum ada)_');
  }

  lines.push('', '_Mau ubah? Ketik /start untuk setup ulang profil._');
  await ctx.reply(lines.join('\n'), MD);
}
