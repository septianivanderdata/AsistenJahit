// §8.2 — Narasi vonis. LLM memoles kalimat; angka dari kode (fallback = kebenaran).
import { VerdictData, renderVerdictFallback } from '../core/verdict.js';
import { complete, fill, loadPrompt } from './client.js';

const SYSTEM =
  'Kamu asisten penjahit yang ramah. Susun pesan vonis mengikuti format yang ' +
  'diberikan PERSIS. DILARANG mengubah/menghitung ulang angka atau tanggal.';

export async function narrateVerdict(v: VerdictData): Promise<string> {
  const fallback = renderVerdictFallback(v);
  try {
    const text = await complete({
      system: SYSTEM,
      prompt: fill(loadPrompt('narrate_verdict'), {
        DATA: JSON.stringify(v),
        FALLBACK: fallback,
      }),
      temperature: 0.4,
      maxTokens: 700,
    });
    // Jaga-jaga: bila LLM balas kosong, pakai fallback deterministik.
    return text.length > 20 ? text : fallback;
  } catch {
    return fallback;
  }
}
