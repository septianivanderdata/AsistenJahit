// Utilitas tanggal murni & bebas timezone.
// Semua tanggal direpresentasikan sebagai string ISO "YYYY-MM-DD".
// Perhitungan pakai UTC agar deterministik (tak terpengaruh TZ mesin).

export type ISODate = string; // "YYYY-MM-DD"

export function toISODate(d: Date): ISODate {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}

/** 0=Minggu, 1=Senin, ... 6=Sabtu */
export function dayOfWeek(s: ISODate): number {
  return parseISO(s).getUTCDay();
}

export function diffDays(a: ISODate, b: ISODate): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return parseISO(a).getTime() >= parseISO(b).getTime() ? a : b;
}

/**
 * Hari libur mingguan ditentukan dari jumlah hari kerja.
 * MVP: libur dihitung dari akhir pekan ke dalam.
 *   7 hari kerja → tak ada libur
 *   6 hari kerja → Minggu libur                (spec §7)
 *   5 hari kerja → Sabtu + Minggu libur
 *   dst.
 */
export function offDays(workDaysPerWeek: number): Set<number> {
  const order = [0, 6, 5, 4, 3, 2, 1]; // Minggu, Sabtu, Jumat, ...
  const offCount = Math.max(0, 7 - Math.min(7, Math.max(1, workDaysPerWeek)));
  return new Set(order.slice(0, offCount));
}

export function isWorkday(s: ISODate, workDaysPerWeek: number): boolean {
  return !offDays(workDaysPerWeek).has(dayOfWeek(s));
}

/** Maju ke hari kerja berikutnya bila `s` jatuh di hari libur (termasuk `s` sendiri). */
export function nextWorkday(s: ISODate, workDaysPerWeek: number): ISODate {
  let cur = s;
  // Batasi iterasi agar aman bila semua hari libur (tak mungkin: min 1 hari kerja).
  for (let i = 0; i < 8; i++) {
    if (isWorkday(cur, workDaysPerWeek)) return cur;
    cur = addDays(cur, 1);
  }
  return cur;
}

/**
 * Selisih hari KERJA bertanda dari `a` ke `b`:
 * positif bila `b` setelah `a`, negatif bila sebelum, 0 bila sama.
 * Rentang eksklusif-awal, inklusif-akhir.
 */
export function workdaysDiff(
  a: ISODate,
  b: ISODate,
  workDaysPerWeek: number,
): number {
  if (a === b) return 0;
  const sign = a < b ? 1 : -1;
  const [from, to] = sign === 1 ? [a, b] : [b, a];
  let n = 0;
  let cur = addDays(from, 1);
  while (cur <= to) {
    if (isWorkday(cur, workDaysPerWeek)) n++;
    cur = addDays(cur, 1);
  }
  return sign * n;
}

const BULAN_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

/** Format ramah: "15 Agu" atau "15 Agu 2026" bila tahun beda dari `refYear`. */
export function formatID(s: ISODate, refYear?: number): string {
  const d = parseISO(s);
  const day = d.getUTCDate();
  const mon = BULAN_ID[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  if (refYear !== undefined && year === refYear) return `${day} ${mon}`;
  return `${day} ${mon} ${year}`;
}
