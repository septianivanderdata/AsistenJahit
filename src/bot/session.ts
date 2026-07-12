// State ringan wizard/klarifikasi (§6.1), dipersist ke file JSON agar
// selamat dari restart proses (tsx watch, redeploy, crash).
// Cukup untuk single-process long polling; bila multi-instance, pindah ke DB.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ItemType } from '../db/types.js';

export type WizardStep =
  | 'name'
  | 'schedule'
  | 'items'
  | 'partners'
  | 'idle';

export interface DraftItemType {
  name: string;
  hours_per_unit: number;
}

export interface WizardState {
  step: WizardStep;
  name?: string;
  businessName?: string;
  workDaysPerWeek?: number;
  workHoursPerDay?: number;
  pendingItems: DraftItemType[];
}

export interface ClarifyState {
  rawMessage: string; // teks order asli, akan digabung dgn koreksi user
  itemTypes: ItemType[];
}

/** Menunggu balasan tanggal untuk /edit (percepat selesai / ubah deadline). */
export interface EditState {
  orderId: string;
  field: 'finish' | 'deadline';
}

const STORE_PATH = join(process.cwd(), '.data', 'sessions.json');

interface StoreShape {
  wizard: Record<string, WizardState>;
  clarify: Record<string, ClarifyState>;
  edit?: Record<string, EditState>;
}

const wizard = new Map<number, WizardState>();
const clarify = new Map<number, ClarifyState>();
const edit = new Map<number, EditState>();

loadStore();

function loadStore(): void {
  try {
    const raw = readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw) as StoreShape;
    for (const [k, v] of Object.entries(data.wizard ?? {})) wizard.set(Number(k), v);
    for (const [k, v] of Object.entries(data.clarify ?? {})) clarify.set(Number(k), v);
    for (const [k, v] of Object.entries(data.edit ?? {})) edit.set(Number(k), v);
  } catch {
    // File belum ada / korup → mulai kosong. Korup tak boleh menjatuhkan bot.
  }
}

function saveStore(): void {
  const data: StoreShape = {
    wizard: Object.fromEntries([...wizard].map(([k, v]) => [String(k), v])),
    clarify: Object.fromEntries([...clarify].map(([k, v]) => [String(k), v])),
    edit: Object.fromEntries([...edit].map(([k, v]) => [String(k), v])),
  };
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    // Tulis ke tmp lalu rename: atomic, tak ada file setengah-jadi saat crash.
    const tmp = STORE_PATH + '.tmp';
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, STORE_PATH);
  } catch (e) {
    console.error('session save gagal (state tetap di memori)', e);
  }
}

export function getWizard(chatId: number): WizardState | undefined {
  return wizard.get(chatId);
}
export function startWizard(chatId: number): WizardState {
  const w: WizardState = { step: 'name', pendingItems: [] };
  wizard.set(chatId, w);
  saveStore();
  return w;
}
export function setWizard(chatId: number, w: WizardState): void {
  wizard.set(chatId, w);
  saveStore();
}
export function endWizard(chatId: number): void {
  wizard.delete(chatId);
  saveStore();
}

export function getClarify(chatId: number): ClarifyState | undefined {
  return clarify.get(chatId);
}
export function setClarify(chatId: number, c: ClarifyState): void {
  clarify.set(chatId, c);
  saveStore();
}
export function endClarify(chatId: number): void {
  clarify.delete(chatId);
  saveStore();
}

export function getEdit(chatId: number): EditState | undefined {
  return edit.get(chatId);
}
export function setEdit(chatId: number, e: EditState): void {
  edit.set(chatId, e);
  saveStore();
}
export function endEdit(chatId: number): void {
  edit.delete(chatId);
  saveStore();
}
