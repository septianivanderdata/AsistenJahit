// §8.3 — Draft balasan siap-copy untuk 3 skenario.
import { complete, fill, loadPrompt } from './client.js';

export type Decision = 'accept' | 'outsource' | 'reject';

export interface DraftContext {
  customerName?: string | null;
  itemLabel: string;
  quantity: number;
  deadline?: string | null;
  finishDate?: string | null;
  daysLate?: number | null;
  partnerName?: string | null;
  outsourcePerUnit?: number | null;
  rawMessage?: string; // cuplikan chat asli untuk menangkap sapaan
}

const SYSTEM =
  'Kamu menulis draft balasan chat WA Indonesia untuk penjahit: sopan, singkat, ' +
  'hangat, tanpa emoji berlebihan. Balas HANYA teks draft.';

const FALLBACK: Record<Decision, (c: DraftContext) => string> = {
  accept: (c) =>
    `Halo${c.customerName ? ' ' + c.customerName : ''}, untuk ${c.quantity} pcs ${c.itemLabel} ` +
    (c.daysLate && c.daysLate > 0
      ? `insyaAllah bisa saya kerjakan, tapi realistisnya selesai sekitar ${c.finishDate}. Boleh mundur sedikit ya deadline-nya?`
      : `siap saya kerjakan, target selesai ${c.finishDate ?? 'sesuai deadline'}. Terima kasih ordernya 🙏`),
  outsource: (c) =>
    `Halo${c.partnerName ? ' ' + c.partnerName : ''}, ada order ${c.quantity} pcs ${c.itemLabel}` +
    (c.deadline ? `, deadline ${c.deadline}` : '') +
    (c.outsourcePerUnit ? `. Upah ±${c.outsourcePerUnit}/pcs` : '') +
    '. Bisa bantu ambil? Kabari ya.',
  reject: (c) =>
    `Halo${c.customerName ? ' ' + c.customerName : ''}, maaf sekali untuk ${c.itemLabel} ini ` +
    'antrian saya sedang penuh jadi belum bisa ambil. Kalau tidak buru-buru, ' +
    'saya bisa kerjakan setelahnya — atau saya bantu rekomendasi rekan yang bisa. 🙏',
};

export async function draftReply(
  decision: Decision,
  ctx: DraftContext,
): Promise<string> {
  try {
    const text = await complete({
      system: SYSTEM,
      prompt: fill(loadPrompt('draft_replies'), {
        DECISION: decision,
        CONTEXT: JSON.stringify(ctx),
      }),
      temperature: 0.6,
      maxTokens: 400,
    });
    return text.length > 5 ? text : FALLBACK[decision](ctx);
  } catch {
    return FALLBACK[decision](ctx);
  }
}
