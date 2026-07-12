// Seed data demo untuk video (§12). ± 8–12 order beragam status.
// Jalankan: npm run seed  (butuh .env terisi).
import { db } from '../src/db/client.js';
import { todayISO } from '../src/config.js';
import {
  WorkProfile,
  QueuedJob,
  estHours,
  scheduleOrder,
} from '../src/core/capacity.js';
import { addDays } from '../src/util/dates.js';

const DEMO_CHAT_ID = 999_000_001; // chat id fiktif untuk demo

async function wipe(tailorId: string) {
  await db.from('orders').delete().eq('tailor_id', tailorId);
  await db.from('partners').delete().eq('tailor_id', tailorId);
  await db.from('item_types').delete().eq('tailor_id', tailorId);
  await db.from('tailors').delete().eq('id', tailorId);
}

async function main() {
  const today = todayISO();
  const profile: WorkProfile = { workHoursPerDay: 8, workDaysPerWeek: 6 };

  // Bersihkan tailor demo lama bila ada.
  const { data: old } = await db
    .from('tailors')
    .select('id')
    .eq('telegram_chat_id', DEMO_CHAT_ID)
    .maybeSingle();
  if (old) await wipe(old.id);

  const { data: tailor, error: te } = await db
    .from('tailors')
    .insert({
      telegram_chat_id: DEMO_CHAT_ID,
      name: 'Bu Sri',
      business_name: 'Sri Jahit Modern',
      work_days_per_week: 6,
      work_hours_per_day: 8,
    })
    .select()
    .single();
  if (te) throw te;

  const items = [
    { name: 'kebaya payet', aliases: ['kebaya', 'payet'], hours_per_unit: 24, base_price: 450_000, outsource_cost: 250_000 },
    { name: 'seragam kantor', aliases: ['seragam', 'kantor'], hours_per_unit: 3, base_price: 120_000, outsource_cost: 85_000 },
    { name: 'celana sekolah', aliases: ['celana', 'sekolah'], hours_per_unit: 4, base_price: 90_000, outsource_cost: 60_000 },
    { name: 'gamis pesta', aliases: ['gamis', 'pesta'], hours_per_unit: 16, base_price: 350_000, outsource_cost: 200_000 },
  ];
  const { data: itemRows, error: ie } = await db
    .from('item_types')
    .insert(items.map((i) => ({ ...i, tailor_id: tailor.id })))
    .select();
  if (ie) throw ie;
  const byName = Object.fromEntries(itemRows!.map((r: any) => [r.name, r]));

  const { data: partnerRows, error: pe } = await db
    .from('partners')
    .insert([
      { tailor_id: tailor.id, name: 'Bu Wati', notes: 'jago kebaya, lambat kalau musim nikahan' },
      { tailor_id: tailor.id, name: 'Pak Herman', notes: 'cepat untuk seragam & celana' },
    ])
    .select();
  if (pe) throw pe;

  // Bangun antrian accepted secara serial agar kalender & finish konsisten.
  const active: QueuedJob[] = [];
  const orders: any[] = [];

  function accept(itemName: string, qty: number, deadlineOffset: number) {
    const it = byName[itemName];
    const hrs = estHours(qty, Number(it.hours_per_unit));
    const deadline = addDays(today, deadlineOffset);
    const sched = scheduleOrder({ today, estHours: hrs, deadline, activeJobs: active, profile });
    active.push({ label: it.name, estHours: hrs, startDate: sched.startDate, finishDate: sched.finishDate });
    orders.push({
      tailor_id: tailor.id,
      customer_name: pickName(),
      raw_message: `Order demo ${qty} ${it.name}`,
      extracted: { demo: true },
      item_type_id: it.id,
      item_label: it.name,
      quantity: qty,
      deadline,
      material_provided_by: 'customer',
      est_hours: hrs,
      quoted_price: Number(it.base_price) * qty,
      outsource_cost: Number(it.outsource_cost),
      status: 'accepted',
      start_date: sched.startDate,
      finish_date: sched.finishDate,
      decided_at: new Date().toISOString(),
    });
  }

  function simple(itemName: string, qty: number, status: string, deadlineOffset: number) {
    const it = byName[itemName];
    const hrs = estHours(qty, Number(it.hours_per_unit));
    orders.push({
      tailor_id: tailor.id,
      customer_name: pickName(),
      raw_message: `Order demo ${qty} ${it.name}`,
      extracted: { demo: true },
      item_type_id: it.id,
      item_label: it.name,
      quantity: qty,
      deadline: addDays(today, deadlineOffset),
      material_provided_by: 'customer',
      est_hours: hrs,
      quoted_price: Number(it.base_price) * qty,
      outsource_cost: Number(it.outsource_cost),
      partner_id: status === 'outsourced' ? partnerRows![0].id : null,
      status,
      start_date: null,
      finish_date: null,
      decided_at: new Date().toISOString(),
      completed_at: status === 'done' ? new Date().toISOString() : null,
    });
  }

  // 5 accepted (isi kalender & antrian)
  accept('kebaya payet', 2, 20);
  accept('seragam kantor', 20, 12);
  accept('gamis pesta', 3, 25);
  accept('celana sekolah', 15, 18);
  accept('kebaya payet', 1, 30);

  // 3 outsourced (margin oper)
  simple('seragam kantor', 30, 'outsourced', 10);
  simple('gamis pesta', 4, 'outsourced', 14);
  simple('celana sekolah', 25, 'outsourced', 9);

  // 3 rejected bulan ini (angka bintang "sinyal naik kelas")
  simple('kebaya payet', 4, 'rejected', 8);
  simple('gamis pesta', 6, 'rejected', 7);
  simple('seragam kantor', 40, 'rejected', 6);

  // 1 done (histori)
  simple('celana sekolah', 10, 'done', -3);

  const { error: oe } = await db.from('orders').insert(orders);
  if (oe) throw oe;

  console.log(`✅ Seed selesai. Tailor id: ${tailor.id}`);
  console.log(`   ${orders.length} order (5 accepted, 3 outsourced, 3 rejected, 1 done).`);
  console.log(`   Dashboard: index.html?tailor=${tailor.id}`);
}

const NAMES = ['Bu Ani', 'Pak Budi', 'Mbak Rina', 'Bu Dewi', 'Pak Joko', 'Mbak Sari', 'Bu Lina', 'Pak Toni'];
let ni = 0;
function pickName() { return NAMES[ni++ % NAMES.length]; }

main().catch((e) => {
  console.error('seed gagal', e);
  process.exit(1);
});
