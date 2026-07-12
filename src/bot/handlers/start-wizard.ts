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
import { addItemType, addPartner, createTailor, getTailorByChat } from '../../db/repo.js';

const MD = { parse_mode: 'Markdown' as const };

export async function handleStart(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const existing = await getTailorByChat(chatId);
  startWizard(chatId);
  if (existing) {
    await ctx.reply(
      'Kamu sudah pernah setup. Kita atur ulang profil dari awal ya.\n\n' + M.welcome,
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
  const tailor = await createTailor({
    telegram_chat_id: chatId,
    name: w.name!,
    business_name: w.businessName ?? null,
    work_days_per_week: w.workDaysPerWeek ?? 6,
    work_hours_per_day: w.workHoursPerDay ?? 8,
  });
  for (const it of w.pendingItems) {
    await addItemType({
      tailor_id: tailor.id,
      name: it.name,
      hours_per_unit: it.hours_per_unit,
    });
  }
  const bufferedPartners = ((w as any)._partners ?? []) as {
    name: string;
    notes: string | null;
  }[];
  for (const p of bufferedPartners) {
    await addPartner({ tailor_id: tailor.id, name: p.name, notes: p.notes });
  }
  endWizard(chatId);
  await ctx.reply(tpl(M.setupDone, { name: w.name! }), MD);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
