// Parser ringan deterministik untuk input wizard. Hindari LLM bila pola jelas.

export interface ParsedSchedule {
  workDaysPerWeek: number;
  workHoursPerDay: number;
}

/** "6 hari, 8 jam" / "6 hari 8jam" / "seminggu 6 hari 8 jam sehari" */
export function parseSchedule(text: string): ParsedSchedule | null {
  const t = text.toLowerCase();
  const hari = t.match(/(\d+)\s*hari/);
  const jam = t.match(/(\d+(?:[.,]\d+)?)\s*jam/);
  if (!hari && !jam) {
    // fallback: dua angka pertama → hari, jam
    const nums = t.match(/\d+(?:[.,]\d+)?/g);
    if (nums && nums.length >= 2) {
      return {
        workDaysPerWeek: clampDays(Number(nums[0])),
        workHoursPerDay: num(nums[1]),
      };
    }
    return null;
  }
  return {
    workDaysPerWeek: hari ? clampDays(Number(hari[1])) : 6,
    workHoursPerDay: jam ? num(jam[1]) : 8,
  };
}

export interface ParsedItem {
  name: string;
  hoursPerUnit: number;
  rough: boolean; // true bila satuan waktu tak terbaca (pakai default)
  basePrice?: number | null; // harga jual per pcs, bila disebut
  outsourceCost?: number | null; // upah oper per pcs, bila disebut
}

/**
 * "500rb" / "500 ribu" / "500.000" / "1,5jt" / "2 juta" / "80000" → rupiah.
 * Titik dianggap pemisah ribuan bila polanya 1-3 digit + kelipatan 3 digit.
 */
export function parseRupiah(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  const m = t.match(/^(?:rp\.?)?(\d[\d.,]*)(rb|ribu|k|jt|juta|m)?$/i);
  if (!m) return null;
  const suffix = (m[2] || '').toLowerCase();
  let numStr = m[1];
  if (/^\d{1,3}(\.\d{3})+$/.test(numStr)) {
    numStr = numStr.replace(/\./g, ''); // 500.000 → 500000
  } else {
    numStr = numStr.replace(/,/g, '.'); // 1,5 → 1.5
  }
  const value = Number(numStr);
  if (!Number.isFinite(value) || value <= 0) return null;
  let mult = 1;
  if (suffix === 'rb' || suffix === 'ribu' || suffix === 'k') mult = 1_000;
  else if (suffix === 'jt' || suffix === 'juta' || suffix === 'm') mult = 1_000_000;
  return Math.round(value * mult);
}

/**
 * Ambil harga jual & upah oper dari teks bebas, dikenali lewat kata kunci
 * (jual/harga vs upah/oper/ongkos). Mengembalikan sisa teks tanpa bagian harga,
 * agar parser durasi tidak salah membaca angka rupiah sebagai jam.
 */
export function extractPrices(text: string): {
  rest: string;
  basePrice: number | null;
  outsourceCost: number | null;
} {
  const AMOUNT = String.raw`(?:rp\.?\s*)?\d[\d.,]*\s*(?:rb|ribu|k|jt|juta|m)?`;
  const sell = new RegExp(
    String.raw`\b(?:jual|harga|dijual|tarif)\s*(?:nya)?\s*:?\s*(${AMOUNT})`,
    'i',
  );
  const cost = new RegExp(
    String.raw`\b(?:upah|oper|ongkos|rekan|borong)\s*(?:oper|rekan|nya)?\s*:?\s*(${AMOUNT})`,
    'i',
  );

  let rest = text;
  let basePrice: number | null = null;
  let outsourceCost: number | null = null;

  const cm = rest.match(cost); // upah dulu — "upah rekan" lebih spesifik
  if (cm) {
    outsourceCost = parseRupiah(cm[1]);
    if (outsourceCost != null) rest = rest.replace(cm[0], ' ');
  }
  const sm = rest.match(sell);
  if (sm) {
    basePrice = parseRupiah(sm[1]);
    if (basePrice != null) rest = rest.replace(sm[0], ' ');
  }

  rest = rest.replace(/[,;]\s*(?=[,;]|$)/g, ' ').replace(/\s+/g, ' ').trim();
  return { rest, basePrice, outsourceCost };
}

/**
 * "kebaya payet 3 hari" / "celana sekolah 4 jam" / "seragam 90 menit"
 * Harga opsional: "kebaya payet 3 hari, jual 500rb, upah rekan 150rb"
 */
export function parseItemDuration(
  text: string,
  hoursPerDay: number,
): ParsedItem | null {
  const { rest, basePrice, outsourceCost } = extractPrices(text.trim());
  const t = rest;
  // cari angka + satuan di bagian mana pun
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(hari|jam|jm|menit|mnt)?\b/i);
  if (!m) return null;
  const qty = num(m[1]);
  const unit = (m[2] || '').toLowerCase();
  let hours: number;
  let rough = false;
  if (unit.startsWith('hari')) hours = qty * hoursPerDay;
  else if (unit === 'menit' || unit === 'mnt') hours = qty / 60;
  else if (unit === 'jam' || unit === 'jm') hours = qty;
  else {
    // tanpa satuan → anggap jam (default), tandai rough
    hours = qty;
    rough = true;
  }
  // nama = teks tanpa angka+satuan (dan tanpa bagian harga)
  const name = t
    .replace(m[0], ' ')
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) return null;
  return { name, hoursPerUnit: round2(hours), rough, basePrice, outsourceCost };
}

/** "Bu Sri — Sri Jahit Modern" / "Bu Sri, Sri Jahit" */
export function parseNameBusiness(text: string): {
  name: string;
  business: string | null;
} {
  const parts = text.split(/[—\-–,|]/).map((s) => s.trim()).filter(Boolean);
  return { name: parts[0] || text.trim(), business: parts[1] ?? null };
}

function num(s: string): number {
  return Number(s.replace(',', '.'));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function clampDays(n: number): number {
  return Math.min(7, Math.max(1, Math.round(n)));
}
