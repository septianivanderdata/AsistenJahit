// §6.1 — Wizard setup sekali jalan. Satu pertanyaan per pesan.
import { Context } from 'grammy';
import { M, tpl } from '../messages.js';
import {
  DraftItemType,
  WizardState,
  endWizard,
  getWizard,
  startWizard,
  setWizard,
} from '../session.js';
import { parseItemDuration, parseNameBusiness, parseSchedule } from '../../util/parse.js';
import {
  addItemType,
  addPartner,
  createTailor,
  getItemTypes,
  getPartners,
  getTailorByChat,
  updateItemType,
  updateTailor,
} from '../../db/repo.js';

const MD = { parse_mode: 'Markdown' as const };

export async function handleStart(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const existing = await getTailorByChat(chatId);
  startWizard(chatId);
  if (existing) {
    await ctx.reply(
      'Kamu sudah pernah setup. Kita atur ulang profil ya — antrian, riwayat, dan link dashboard-mu *tetap sama*, tidak dibuat baru.\n' +
        '_Cuma mau tambah/ubah jenis jahitan? Lebih cepat pakai_ /profil _tambah_ …\n\n' +
        M.welcome,
      MD,
    );
  } else {
    await ctx.reply(M.welcome, MD);
  }
}

/** Return true bila pesan ini dikonsumsi oleh wizard. */
export async function tryWizardStep(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat!.id;
  const w = getWizard(chatId);
  if (!w || w.step === 'idle') return false;
  const text = (ctx.message?.text ?? '').trim();
  if (!text) return false;

  switch (w.step) {
    case 'name':
      return stepName(ctx, w, text);
    case 'schedule':
      return stepSchedule(ctx, w, text);
    case 'items':
      return stepItems(ctx, w, text);
    case 'partners':
      return stepPartners(ctx, w, text);
    default:
      return false;
  }
}

async function stepName(ctx: Context, w: WizardState, text: string): Promise<boolean> {
  const { name, business } = parseNameBusiness(text);
  w.name = name;
  w.businessName = business ?? undefined;
  w.step = 'schedule';
  setWizard(ctx.chat!.id, w);
  await ctx.reply(M.askWorkSchedule, MD);
  return true;
}

async function stepSchedule(ctx: Context, w: WizardState, text: string): Promise<boolean> {
  const parsed = parseSchedule(text);
  if (!parsed) {
    await ctx.reply('Belum kebaca. Tulis contoh: _6 hari, 8 jam_', MD);
    return true;
  }
  w.workDaysPerWeek = parsed.workDaysPerWeek;
  w.workHoursPerDay = parsed.workHoursPerDay;
  w.step = 'items';
  setWizard(ctx.chat!.id, w);
  await ctx.reply(M.askItems, MD);
  return true;
}

async function stepItems(ctx: Context, w: WizardState, text: string): Promise<boolean> {
  if (/^selesai$/i.test(text)) {
    if (w.pendingItems.length === 0) {
      await ctx.reply('Minimal satu jenis dulu ya. Contoh: _kebaya payet 3 hari_', MD);
      return true;
    }
    w.step = 'partners';
    setWizard(ctx.chat!.id, w);
    await ctx.reply(M.askPartners, MD);
    return true;
  }
  const item = parseItemDuration(text, w.workHoursPerDay ?? 8);
  if (!item) {
    await ctx.reply(
      'Belum kebaca. Contoh: _kebaya payet 3 hari_ atau _celana 4 jam_',
      MD,
    );
    return true;
  }
  const d: DraftItemType = { name: item.name, hours_per_unit: item.hoursPerUnit };
  w.pendingItems.push(d);
  setWizard(ctx.chat!.id, w);
  const jamHari =
    item.hoursPerUnit >= (w.workHoursPerDay ?? 8)
      ? `≈ ${round1(item.hoursPerUnit / (w.workHoursPerDay ?? 8))} hari`
      : `${item.hoursPerUnit} jam`;
  await ctx.reply(
    `✅ Dicatat: *${d.name}* — ${d.hours_per_unit} jam/pcs (${jamHari}).\n\n${M.askItemMore}`,
    MD,
  );
  return true;
}

async function stepPartners(ctx: Context, w: WizardState, text: string): Promise<boolean> {
  const chatId = ctx.chat!.id;
  if (/^(lewati|skip|selesai)$/i.test(text)) {
    await finishWizard(ctx, w);
    return true;
  }
  // "Wati — kebaya 150rb" → simpan nama; catatan upah masuk notes (MVP sederhana).
  const parts = text.split(/[—\-–,|]/).map((s) => s.trim()).filter(Boolean);
  const name = parts[0];
  const notes = parts.slice(1).join(' — ') || null;
  const tailorId = (w as any)._tailorId as string | undefined;
  if (tailorId) {
    await addPartner({ tailor_id: tailorId, name, notes });
  } else {
    // tailor belum dibuat (partner dikirim sebelum finish) → simpan buffer
    (w as any)._partners = [...((w as any)._partners ?? []), { name, notes }];
    setWizard(chatId, w);
  }
  await ctx.reply(
    `✅ Rekan *${name}* dicatat. Tambah lagi atau ketik *lewati* untuk selesai.`,
    MD,
  );
  return true;
}

async function finishWizard(ctx: Context, w: WizardState): Promise<void> {
  const chatId = ctx.chat!.id;
  const existing = await getTailorByChat(chatId);
  const profile = {
    name: w.name!,
    business_name: w.businessName ?? null,
    work_days_per_week: w.workDaysPerWeek ?? 6,
    work_hours_per_day: w.workHoursPerDay ?? 8,
  };

  let tailorId: string;
  if (existing) {
    // Setup ulang: perbarui baris yang sama — UUID (= link dashboard),
    // antrian, dan riwayat order tetap. Jenis jahitan di-upsert per nama;
    // yang tidak disebut ulang dibiarkan (bisa masih dirujuk order lama).
    await updateTailor(existing.id, profile);
    tailorId = existing.id;
  } else {
    const tailor = await createTailor({ telegram_chat_id: chatId, ...profile });
    tailorId = tailor.id;
  }

  const currentItems = existing ? await getItemTypes(tailorId) : [];
  for (const it of w.pendingItems) {
    const match = currentItems.find(
      (c) => c.name.toLowerCase() === it.name.toLowerCase(),
    );
    if (match) {
      await updateItemType(match.id, { hours_per_unit: it.hours_per_unit });
    } else {
      await addItemType({
        tailor_id: tailorId,
        name: it.name,
        hours_per_unit: it.hours_per_unit,
      });
    }
  }

  const bufferedPartners = ((w as any)._partners ?? []) as {
    name: string;
    notes: string | null;
  }[];
  const currentPartners = existing ? await getPartners(tailorId) : [];
  for (const p of bufferedPartners) {
    const dupe = currentPartners.some(
      (c) => c.name.toLowerCase() === p.name.toLowerCase(),
    );
    if (!dupe) await addPartner({ tailor_id: tailorId, name: p.name, notes: p.notes });
  }
  endWizard(chatId);
  await ctx.reply(tpl(M.setupDone, { name: w.name! }), MD);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
