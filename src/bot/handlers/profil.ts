// §6.3 — /profil: lihat jenis jahitan & durasi; tambah/ubah via sub-perintah.
//   /profil                          → tampilkan profil
//   /profil tambah kebaya payet 3 hari → jenis baru (atau perbarui bila nama sama)
//   /profil ubah kebaya 2 hari         → ubah durasi jenis yang cocok
import { Context } from 'grammy';
import { M } from '../messages.js';
import {
  addItemType,
  getItemTypes,
  getPartners,
  getTailorByChat,
  updateItemType,
} from '../../db/repo.js';
import { parseItemDuration } from '../../util/parse.js';

const MD = { parse_mode: 'Markdown' as const };

export async function handleProfil(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const tailor = await getTailorByChat(chatId);
  if (!tailor) {
    await ctx.reply(M.notRegistered);
    return;
  }

  const args = (ctx.message?.text ?? '').replace(/^\/profil\S*/i, '').trim();
  const sub = args.match(/^(tambah|ubah)\s+(.+)$/is);
  if (sub) {
    await handleItemEdit(ctx, tailor.id, Number(tailor.work_hours_per_day), sub[1].toLowerCase(), sub[2].trim());
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

  lines.push(
    '',
    '_Tambah/ubah jenis: ketik_ `/profil tambah gamis pesta 5 jam` _atau_ `/profil ubah kebaya 2 hari`.',
    '_Setup ulang semua (nama, jam kerja): /start — dashboard & antrian tetap._',
  );
  await ctx.reply(lines.join('\n'), MD);
}

async function handleItemEdit(
  ctx: Context,
  tailorId: string,
  hoursPerDay: number,
  action: string,
  spec: string,
): Promise<void> {
  const parsed = parseItemDuration(spec, hoursPerDay);
  if (!parsed || !parsed.name) {
    await ctx.reply(
      'Belum kebaca. Contoh: `/profil tambah gamis pesta 5 jam` atau `/profil ubah kebaya 2 hari`',
      MD,
    );
    return;
  }

  const items = await getItemTypes(tailorId);
  const key = parsed.name.toLowerCase();
  const match = items.find((it) => {
    const n = it.name.toLowerCase();
    return n === key || n.includes(key) || key.includes(n);
  });

  const jamHari =
    parsed.hoursPerUnit >= hoursPerDay
      ? `≈ ${Math.round((parsed.hoursPerUnit / hoursPerDay) * 10) / 10} hari`
      : `${parsed.hoursPerUnit} jam`;

  if (action === 'ubah') {
    if (!match) {
      const daftar = items.map((it) => it.name).join(', ') || '(kosong)';
      await ctx.reply(
        `Jenis *${parsed.name}* tidak ketemu di profilmu.\nYang ada: ${daftar}\nMau menambahkan? Pakai \`/profil tambah ${spec}\``,
        MD,
      );
      return;
    }
    await updateItemType(match.id, { hours_per_unit: parsed.hoursPerUnit });
    await ctx.reply(
      `✅ *${match.name}* diubah jadi ${parsed.hoursPerUnit} jam/pcs (${jamHari}).`,
      MD,
    );
    return;
  }

  // tambah — bila nama sudah ada, perlakukan sebagai ubah agar tak dobel
  if (match) {
    await updateItemType(match.id, { hours_per_unit: parsed.hoursPerUnit });
    await ctx.reply(
      `ℹ️ *${match.name}* sudah ada — durasinya kuperbarui jadi ${parsed.hoursPerUnit} jam/pcs (${jamHari}).`,
      MD,
    );
    return;
  }
  await addItemType({
    tailor_id: tailorId,
    name: parsed.name,
    hours_per_unit: parsed.hoursPerUnit,
  });
  await ctx.reply(
    `✅ Jenis baru dicatat: *${parsed.name}* — ${parsed.hoursPerUnit} jam/pcs (${jamHari}).`,
    MD,
  );
}
