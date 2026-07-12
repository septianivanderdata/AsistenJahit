// Ping standalone: uji migrasi Gemini tanpa Telegram/Supabase.
// Jalankan: GEMINI_API_KEY=xxx npx tsx scripts/ping-llm.ts
// Memanggil path SDK yang sama dengan src/llm/client.ts (generateContent,
// thinkingBudget:0, res.text) pada satu contoh chat order → JSON.
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY belum diisi. Jalankan: GEMINI_API_KEY=xxx npx tsx scripts/ping-llm.ts');
  process.exit(1);
}

const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const genai = new GoogleGenAI({ apiKey });

const SAMPLE =
  'Bu tolong dibuatin kebaya payet 2 pcs sama celana sekolah anak 3 ya, ' +
  'buat sebelum lebaran. bahan dari saya. makasih';

const SYSTEM =
  'Kamu mengekstrak spesifikasi order jahit dari chat Bahasa Indonesia informal. ' +
  'Balas HANYA JSON valid tanpa markdown dengan skema: ' +
  '{customer_name, items:[{label, quantity}], deadline_iso, material_provided_by, notes, ambiguities:[]}. ' +
  'Hari ini 2026-03-01. material_provided_by salah satu dari customer|tailor|unknown.';

async function main() {
  console.log(`Model: ${model}`);
  console.log(`Chat contoh: "${SAMPLE}"\n`);
  const t0 = Date.now();
  const res = await genai.models.generateContent({
    model,
    contents: SAMPLE,
    config: {
      systemInstruction: SYSTEM,
      temperature: 0,
      maxOutputTokens: 800,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const ms = Date.now() - t0;
  const text = (res.text ?? '').trim();
  console.log(`Respons (${ms} ms):\n${text}\n`);

  // Coba parse untuk validasi bentuk JSON.
  const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  try {
    const parsed = JSON.parse(clean.slice(start, end + 1));
    console.log('✅ JSON valid. Ekstraksi item:', JSON.stringify(parsed.items));
  } catch {
    console.log('⚠️ Bukan JSON valid — cek prompt/model.');
  }
}

main().catch((e) => {
  console.error('❌ Gagal panggil Gemini:', e?.message ?? e);
  process.exit(1);
});
