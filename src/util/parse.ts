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
}

/** "kebaya payet 3 hari" / "celana sekolah 4 jam" / "seragam 90 menit" */
export function parseItemDuration(
  text: string,
  hoursPerDay: number,
): ParsedItem | null {
  const t = text.trim();
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
  // nama = teks tanpa angka+satuan
  const name = t
    .replace(m[0], ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) return null;
  return { name, hoursPerUnit: round2(hours), rough };
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
