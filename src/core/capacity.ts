// §7 — Mesin kapasitas. PURE FUNCTIONS. Tidak ada I/O, tidak ada LLM.
// LLM DILARANG berhitung; semua angka & tanggal lahir di sini.

import {
  ISODate,
  addDays,
  diffDays,
  maxDate,
  nextWorkday,
} from '../util/dates.js';

export interface WorkProfile {
  workHoursPerDay: number;
  workDaysPerWeek: number;
  /** Tanggal libur tambahan (libur nasional/cuti), format ISO. Opsional. */
  daysOff?: Set<ISODate>;
}

/** Hari kerja berikutnya: lompati libur mingguan DAN tanggal libur khusus. */
function nextAvailableDay(s: ISODate, profile: WorkProfile): ISODate {
  let cur = nextWorkday(s, profile.workDaysPerWeek);
  let guard = 0;
  while (profile.daysOff?.has(cur) && guard++ < 400) {
    cur = nextWorkday(addDays(cur, 1), profile.workDaysPerWeek);
  }
  return cur;
}

/** Ringkasan satu order aktif yang sudah menempati antrian. */
export interface QueuedJob {
  label: string;
  estHours: number;
  startDate: ISODate;
  finishDate: ISODate;
}

export type DeadlineStatus = 'aman' | 'mepet' | 'terlambat';

export interface Schedule {
  estHours: number;
  startDate: ISODate;
  finishDate: ISODate;
  /** Berapa hari terlambat (positif) vs deadline; null bila tak ada deadline. */
  daysLate: number | null;
  status: DeadlineStatus | null;
}

/** est_hours = quantity × hours_per_unit */
export function estHours(quantity: number, hoursPerUnit: number): number {
  return round2(quantity * hoursPerUnit);
}

/**
 * Tambahkan `hours` jam kerja ke kalender mulai dari `start`.
 * Tiap hari kerja menyumbang `workHoursPerDay` jam. Hari libur dilewati.
 * Mengembalikan tanggal di mana pekerjaan SELESAI (hari terakhir yang tersentuh).
 */
export function addWorkingHours(
  start: ISODate,
  hours: number,
  profile: WorkProfile,
): ISODate {
  const perDay = profile.workHoursPerDay;
  if (perDay <= 0) throw new Error('work_hours_per_day harus > 0');

  let cursor = nextWorkday(start, profile.workDaysPerWeek);
  // Order tanpa jam kerja (est 0) tetap memakan minimal 0 → selesai di hari mulai.
  let remaining = Math.max(0, hours);
  if (remaining <= perDay) return cursor;

  // Habiskan hari pertama.
  remaining -= perDay;
  // Loop hari kerja berikutnya sampai sisa jam masuk dalam satu hari.
  // Batas iterasi generous untuk cegah loop tak henti.
  let guard = 0;
  while (remaining > 1e-9 && guard < 100_000) {
    cursor = nextWorkday(addDays(cursor, 1), profile.workDaysPerWeek);
    if (remaining <= perDay) break;
    remaining -= perDay;
    guard++;
  }
  return cursor;
}

const EPS = 1e-9;

/** Peta beban kalender: tanggal ISO → jam kerja terpakai hari itu. */
export type DayLoad = Map<ISODate, number>;

/**
 * Isi `hours` jam kerja ke kalender mulai `from`, memakai SISA kapasitas
 * tiap hari kerja (mutasi `load`). Order kecil berbagi hari; celah kapasitas
 * di tengah antrian ikut terpakai.
 */
export function fillHours(
  load: DayLoad,
  from: ISODate,
  hours: number,
  profile: WorkProfile,
): { startDate: ISODate; finishDate: ISODate } {
  const perDay = profile.workHoursPerDay;
  if (perDay <= 0) throw new Error('work_hours_per_day harus > 0');

  let cursor = nextAvailableDay(from, profile);
  let remaining = Math.max(0, hours);
  let startDate: ISODate | null = null;
  let finishDate = cursor;
  let guard = 0;
  while (guard++ < 100_000) {
    const free = perDay - (load.get(cursor) ?? 0);
    if (free > EPS) {
      const used = Math.min(free, remaining);
      load.set(cursor, (load.get(cursor) ?? 0) + used);
      if (startDate === null) startDate = cursor;
      finishDate = cursor;
      remaining -= used;
      if (remaining <= EPS) break;
    }
    cursor = nextAvailableDay(addDays(cursor, 1), profile);
  }
  return { startDate: startDate ?? cursor, finishDate };
}

/**
 * Rekonstruksi beban kalender dari order aktif: tiap job diisi berurutan
 * (urut startDate) mulai dari startDate-nya ke sisa kapasitas harian.
 * Job hasil algoritma yang sama terpetakan persis; job lama (granular
 * harian) terpetakan wajar.
 */
export function packJobs(jobs: QueuedJob[], profile: WorkProfile): DayLoad {
  const load: DayLoad = new Map();
  const ordered = [...jobs].sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
  );
  for (const job of ordered) {
    fillHours(load, job.startDate, job.estHours, profile);
  }
  return load;
}

/**
 * Kursor antrian: hari kerja pertama (≥ hari ini) yang masih punya sisa
 * kapasitas setelah semua order aktif dipetakan.
 */
export function queueCursor(
  today: ISODate,
  activeJobs: QueuedJob[],
  profile: WorkProfile,
): ISODate {
  const load = packJobs(activeJobs, profile);
  let cursor = nextAvailableDay(today, profile);
  for (let i = 0; i < 100_000; i++) {
    if (profile.workHoursPerDay - (load.get(cursor) ?? 0) > EPS) return cursor;
    cursor = nextAvailableDay(addDays(cursor, 1), profile);
  }
  return cursor;
}

/**
 * Jadwalkan order baru: packing per-JAM, bukan per-hari — jam order mengisi
 * sisa kapasitas harian mulai hari ini, lalu dinilai terhadap deadline.
 * (Perbaikan atas FCFS harian §7: lima order 2 jam kini muat sehari,
 * bukan memakan lima hari.)
 */
export function scheduleOrder(params: {
  today: ISODate;
  estHours: number;
  deadline: ISODate | null;
  activeJobs: QueuedJob[];
  profile: WorkProfile;
}): Schedule {
  const { today, estHours: hrs, deadline, activeJobs, profile } = params;
  const load = packJobs(activeJobs, profile);
  const { startDate, finishDate } = fillHours(load, today, hrs, profile);

  let daysLate: number | null = null;
  let status: DeadlineStatus | null = null;
  if (deadline) {
    // daysLate > 0 → selesai setelah deadline.
    daysLate = diffDays(deadline, finishDate);
    if (diffDays(finishDate, deadline) >= 1) status = 'aman'; // finish ≤ deadline-1
    else if (daysLate <= 0) status = 'mepet'; // finish == deadline
    else status = 'terlambat';
  }

  return { estHours: hrs, startDate, finishDate, daysLate, status };
}

/** Kapasitas terisi sampai tanggal berapa (finish order aktif terakhir). */
export function filledUntil(activeJobs: QueuedJob[]): ISODate | null {
  if (activeJobs.length === 0) return null;
  return activeJobs.reduce(
    (acc, j) => maxDate(acc, j.finishDate),
    activeJobs[0].finishDate,
  );
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Utility: pastikan daftar job urut finishDate menaik (defensif). */
export function sortJobs(jobs: QueuedJob[]): QueuedJob[] {
  return [...jobs].sort((a, b) =>
    a.finishDate < b.finishDate ? -1 : a.finishDate > b.finishDate ? 1 : 0,
  );
}
