// §6.2 — Alur inti: forward → ekstraksi → (klarifikasi 1×) → vonis 3 opsi.
import { Context } from 'grammy';
import { M } from '../messages.js';
import { todayISO } from '../../config.js';
import {
  cancelStalePending,
  findRecentDuplicate,
  getActiveOrders,
  getItemTypes,
  getTailorByChat,
  insertOrder,
} from '../../db/repo.js';
import { extractOrder, ExtractedOrder } from '../../llm/extract.js';
import { buildPipeline } from '../../core/pipeline.js';
import { narrateVerdict } from '../../llm/narrate.js';
import { verdictKeyboard } from '../keyboards.js';
import { endClarify, getClarify, setClarify } from '../session.js';
import { getDaysOff } from '../daysoff.js';
import { replyMD } from '../reply.js';
import { formatID } from '../../util/dates.js';

const MD = { parse_mode: 'Markdown' as const };

export async function handleForward(ctx: Context, rawText: string): Promise<void> {
  const chatId = ctx.chat!.id;
  const tailor = await getTailorByChat(chatId);
  if (!tailor) {
    await ctx.reply(M.notRegistered);
    return;
  }

  const itemTypes = await getItemTypes(tailor.id);

  // Bersihkan vonis basi: pending >24 jam = user tak pernah menekan tombol.
  try {
    await cancelStalePending(
      tailor.id,
      new Date(Date.now() - 24 * 3600_000).toISOString(),
    );
  } catch (e) {
    console.error('cleanup pending gagal (lanjut)', e);
  }

  // Bila sedang menunggu klarifikasi, gabung koreksi user dgn teks asli.
  const pending = getClarify(chatId);
  let raw = rawText;
  let clarified = false;
  if (pending) {
    raw = `${pending.rawMessage}\n\n[Koreksi penjahit]: ${rawText}`;
    clarified = true;
    endClarify(chatId);
  } else {
    // Anti-duplikat: forward sama persis <10 menit → jangan proses ulang
    // (hemat kuota LLM, cegah order dobel).
    const dup = await findRecentDuplicate(
      tailor.id,
      rawText,
      new Date(Date.now() - 10 * 60_000).toISOString(),
    );
    if (dup) {
      await ctx.reply(M.duplicateOrder);
      return;
    }
  }

  await ctx.reply(M.processing);

  let extracted: ExtractedOrder;
  try {
    extracted = await extractOrder({ raw, today: todayISO(), itemTypes });
  } catch {
    await ctx.reply(M.extractFailed, MD);
    return;
  }

  if (!extracted.items.length) {
    await ctx.reply(M.extractFailed, MD);
    return;
  }

  // Klarifikasi minimal SATU putaran (§6.2), hanya bila belum diklarifikasi.
  if (!clarified) {
    const q = clarifyQuestion(extracted);
    if (q) {
      setClarify(chatId, { rawMessage: raw, itemTypes });
      await ctx.reply(q, MD);
      return;
    }
  }

  // Kalkulasi deterministik + rakit vonis.
  const { verdictData, orderInsert } = buildPipeline({
    today: todayISO(),
    tailor,
    itemTypes,
    activeOrders: await getActiveOrders(tailor.id),
    extracted,
    daysOff: getDaysOff(tailor.id),
  });
  orderInsert.raw_message = rawText;

  const order = await insertOrder(orderInsert);

  const narration = await narrateVerdict(verdictData);
  await replyMD(ctx, narration, { reply_markup: verdictKeyboard(order.id) });
}

/** Satu pertanyaan klarifikasi dgn tebakan bila field kritis kosong. */
function clarifyQuestion(e: ExtractedOrder): string | null {
  const item = e.items[0];
  const unmatched = !item.matched_item_type_id;
  const noDeadline = !e.deadline_iso;
  if (!unmatched && !noDeadline) return null;

  const y = new Date().getUTCFullYear();
  const dl = e.deadline_iso ? formatID(e.deadline_iso, y) : 'belum ada';
  const guess =
    `Aku tangkap: *${item.quantity} pcs ${item.label}*, deadline *${dl}*` +
    (unmatched ? ' (jenis ini belum ada di profilmu, aku pakai perkiraan kasar)' : '') +
    '.\n\nBetul? Kalau ada yang beda (jumlah/jenis/deadline), balas koreksinya. ' +
    'Kalau sudah benar, balas *ya*.';
  return guess;
}
