// §6.3 — /profil: lihat jenis jahitan, durasi & harga; ubah via sub-perintah.
//   /profil                                   → tampilkan profil
//   /profil tambah kebaya payet 3 hari, jual 500rb, upah rekan 150rb
//   /profil ubah kebaya 2 hari                → ubah durasi
//   /profil harga kebaya jual 500rb upah 150rb → ubah harga saja
import { Context } from 'grammy';
import { M } from '../messages.js';
import {
  addItemType,
  getItemTypes,
  getPartners,
  getTailorByChat,
  updateItemType,
} from '../../db/repo.js';
import { extractPrices, parseItemDuration } from '../../util/parse.js';
import { ItemType } from '../../db/types.js';

const MD = { parse_mode: 'Markdown' as const };

export async function handleProfil(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const tailor = await getTailorByChat(chatId);
  if (!tailor) {
    await ctx.reply(M.notRegistered);
    return;
  }

  const args = (ctx.message?.text ?? '').replace(/^\/profil\S*/i, '').trim();
  const sub = args.match(/^(tambah|ubah|harga)\s+(.+)$/is);
  if (sub) {
    const action = sub[1].toLowerCase();
    const spec = sub[2].trim();
    const hoursPerDay = Number(tailor.work_hours_per_day);
    if (action === 'harga') {
      await handlePriceEdit(ctx, tailor.id, spec);
    } else {
      await handleItemEdit(ctx, tailor.id, hoursPerDay, action, spec);
    }
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
  let adaHargaKosong = false;
  if (items.length) {
    for (const it of items) {
      const hari = (it.hours_per_unit / Number(tailor.work_hours_per_day)).toFixed(1);
      const harga: string[] = [];
      if (it.base_price != null) harga.push(`jual ${rupiah(it.base_price)}`);
      if (it.outsource_cost != null) harga.push(`upah oper ${rupiah(it.outsource_cost)}`);
      if (it.base_price == null || it.outsource_cost == null) adaHargaKosong = true;
      const hargaStr = harga.length ? ` · ${harga.join(' · ')}` : ' · _harga belum diisi_';
      lines.push(`• ${it.name} — ${it.hours_per_unit} jam/pcs (~${hari} hari)${hargaStr}`);
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

  if (adaHargaKosong) {
    lines.push(
      '',
      '⚠️ Ada jenis tanpa harga — opsi *OPER* tak bisa hitung margin untuk jenis itu.',
      'Lengkapi: `/profil harga kebaya jual 500rb upah 150rb`',
    );
  }
  lines.push(
    '',
    '_Tambah jenis:_ `/profil tambah gamis pesta 5 jam, jual 300rb, upah 90rb`',
    '_Ubah durasi:_ `/profil ubah kebaya 2 hari` · _ubah harga:_ `/profil harga kebaya jual 500rb`',
    '_Setup ulang semua (nama, jam kerja): /start — dashboard & antrian tetap._',
  );
  await ctx.reply(lines.join('\n'), MD);
}

/** /profil harga <nama> jual <X> upah <Y> — minimal salah satu harga wajib ada. */
async function handlePriceEdit(ctx: Context, tailorId: string, spec: string): Promise<void> {
  const { rest, basePrice, outsourceCost } = extractPrices(spec);
  const name = rest.replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim();

  if (basePrice == null && outsourceCost == null) {
    await ctx.reply(
      'Harga belum kebaca. Contoh: `/profil harga kebaya jual 500rb upah 150rb`\n' +
        '(boleh salah satu saja: `jual 500rb` atau `upah 150rb`)',
      MD,
    );
    return;
  }
  if (!name) {
    await ctx.reply('Jenis jahitannya yang mana? Contoh: `/profil harga kebaya jual 500rb`', MD);
    return;
  }

  const items = await getItemTypes(tailorId);
  const match = findItem(items, name);
  if (!match) {
    const daftar = items.map((it) => it.name).join(', ') || '(kosong)';
    await ctx.reply(
      `Jenis *${name}* tidak ketemu.\nYang ada: ${daftar}`,
      MD,
    );
    return;
  }

  await updateItemType(match.id, {
    ...(basePrice != null ? { base_price: basePrice } : {}),
    ...(outsourceCost != null ? { outsource_cost: outsourceCost } : {}),
  });

  const jual = basePrice ?? match.base_price;
  const upah = outsourceCost ?? match.outsource_cost;
  const detail: string[] = [];
  if (jual != null) detail.push(`jual ${rupiah(jual)}/pcs`);
  if (upah != null) detail.push(`upah oper ${rupiah(upah)}/pcs`);

  let extra = '';
  if (jual != null && upah != null) {
    const margin = jual - upah;
    const pct = jual > 0 ? Math.round((margin / jual) * 100) : 0;
    extra = `\n💰 Margin oper: ${rupiah(margin)}/pcs (${pct}%)`;
  } else {
    extra = '\n_Lengkapi satunya lagi agar margin oper bisa dihitung._';
  }

  await ctx.reply(`✅ *${match.name}* — ${detail.join(' · ')}.${extra}`, MD);
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
      'Belum kebaca. Contoh: `/profil tambah gamis pesta 5 jam, jual 300rb, upah 90rb`\n' +
        'atau `/profil ubah kebaya 2 hari`',
      MD,
    );
    return;
  }

  const items = await getItemTypes(tailorId);
  const match = findItem(items, parsed.name);

  const jamHari =
    parsed.hoursPerUnit >= hoursPerDay
      ? `≈ ${Math.round((parsed.hoursPerUnit / hoursPerDay) * 10) / 10} hari`
      : `${parsed.hoursPerUnit} jam`;

  if (action === 'ubah' && !match) {
    const daftar = items.map((it) => it.name).join(', ') || '(kosong)';
    await ctx.reply(
      `Jenis *${parsed.name}* tidak ketemu di profilmu.\nYang ada: ${daftar}\n` +
        `Mau menambahkan? Pakai \`/profil tambah ${spec}\``,
      MD,
    );
    return;
  }

  // Harga yang tak disebut: pertahankan nilai lama, jangan ditimpa null.
  const patch = {
    hours_per_unit: parsed.hoursPerUnit,
    ...(parsed.basePrice != null ? { base_price: parsed.basePrice } : {}),
    ...(parsed.outsourceCost != null ? { outsource_cost: parsed.outsourceCost } : {}),
  };

  if (match) {
    await updateItemType(match.id, patch);
    const prefix =
      action === 'tambah'
        ? `ℹ️ *${match.name}* sudah ada — kuperbarui`
        : `✅ *${match.name}* diubah`;
    const jual = parsed.basePrice ?? match.base_price;
    const upah = parsed.outsourceCost ?? match.outsource_cost;
    await ctx.reply(
      `${prefix}: ${parsed.hoursPerUnit} jam/pcs (${jamHari})${priceSuffix(jual, upah)}`,
      MD,
    );
    return;
  }

  await addItemType({
    tailor_id: tailorId,
    name: parsed.name,
    hours_per_unit: parsed.hoursPerUnit,
    base_price: parsed.basePrice ?? null,
    outsource_cost: parsed.outsourceCost ?? null,
  });
  await ctx.reply(
    `✅ Jenis baru dicatat: *${parsed.name}* — ${parsed.hoursPerUnit} jam/pcs (${jamHari})` +
      priceSuffix(parsed.basePrice ?? null, parsed.outsourceCost ?? null),
    MD,
  );
}

function priceSuffix(jual: number | null, upah: number | null): string {
  const detail: string[] = [];
  if (jual != null) detail.push(`jual ${rupiah(jual)}`);
  if (upah != null) detail.push(`upah oper ${rupiah(upah)}`);
  if (!detail.length) {
    return '.\n💡 Harga belum diisi — opsi *OPER* tak bisa hitung margin.\n' +
      'Lengkapi: `/profil harga <jenis> jual 500rb upah 150rb`';
  }
  const kurang =
    jual == null || upah == null
      ? '\n_Lengkapi satunya lagi agar margin oper bisa dihitung._'
      : '';
  return ` · ${detail.join(' · ')}.${kurang}`;
}

/** Cocokkan nama jenis: persis dulu, lalu sebagian (mis. "kebaya" → "kebaya payet"). */
function findItem(items: ItemType[], name: string): ItemType | undefined {
  const key = name.toLowerCase();
  return (
    items.find((it) => it.name.toLowerCase() === key) ??
    items.find((it) => {
      const n = it.name.toLowerCase();
      return n.includes(key) || key.includes(n);
    })
  );
}

function rupiah(n: number): string {
  return 'Rp' + Math.round(Number(n)).toLocaleString('id-ID');
}
