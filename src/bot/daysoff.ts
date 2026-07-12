// Tanggal libur khusus per tailor (libur nasional/cuti), dipersist ke file
// JSON — DDL Supabase tak bisa dijalankan via REST, dan file cukup untuk
// single-process MVP (pola sama dgn session.ts). Bila pindah multi-instance,
// migrasikan ke tabel days_off.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ISODate } from '../util/dates.js';

const STORE_PATH = join(process.cwd(), '.data', 'daysoff.json');

type StoreShape = Record<string, ISODate[]>; // tailorId -> tanggal libur

let store: StoreShape = load();

function load(): StoreShape {
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8')) as StoreShape;
  } catch {
    return {};
  }
}

function save(): void {
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    const tmp = STORE_PATH + '.tmp';
    writeFileSync(tmp, JSON.stringify(store));
    renameSync(tmp, STORE_PATH);
  } catch (e) {
    console.error('daysoff save gagal', e);
  }
}

export function getDaysOff(tailorId: string): Set<ISODate> {
  return new Set(store[tailorId] ?? []);
}

/** Toggle: tambah bila belum ada, hapus bila sudah. Balikan true = ditambah. */
export function toggleDayOff(tailorId: string, date: ISODate): boolean {
  const cur = new Set(store[tailorId] ?? []);
  const added = !cur.has(date);
  if (added) cur.add(date);
  else cur.delete(date);
  store[tailorId] = [...cur].sort();
  save();
  return added;
}

/** Buang tanggal yang sudah lewat agar file tak tumbuh selamanya. */
export function pruneDaysOff(tailorId: string, todayISO: ISODate): void {
  const cur = store[tailorId];
  if (!cur?.length) return;
  const kept = cur.filter((d) => d >= todayISO);
  if (kept.length !== cur.length) {
    store[tailorId] = kept;
    save();
  }
}
