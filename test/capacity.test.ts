import { describe, it, expect } from 'vitest';
import {
  addWorkingHours,
  estHours,
  queueCursor,
  scheduleOrder,
  filledUntil,
  QueuedJob,
  WorkProfile,
} from '../src/core/capacity.js';
import {
  offDays,
  isWorkday,
  dayOfWeek,
  addDays,
} from '../src/util/dates.js';
import { computeMargin } from '../src/core/margin.js';

const P7: WorkProfile = { workHoursPerDay: 8, workDaysPerWeek: 7 };
const P6: WorkProfile = { workHoursPerDay: 8, workDaysPerWeek: 6 };

// helper: cari hari Minggu pertama pada/sesudah `s`
function firstSundayOnOrAfter(s: string): string {
  let cur = s;
  for (let i = 0; i < 8; i++) {
    if (dayOfWeek(cur) === 0) return cur;
    cur = addDays(cur, 1);
  }
  throw new Error('unreachable');
}

describe('offDays / isWorkday', () => {
  it('6 hari kerja → Minggu libur', () => {
    expect([...offDays(6)]).toEqual([0]);
  });
  it('5 hari kerja → Sabtu + Minggu libur', () => {
    expect(new Set(offDays(5))).toEqual(new Set([0, 6]));
  });
  it('7 hari kerja → tak ada libur', () => {
    expect(offDays(7).size).toBe(0);
  });
  it('Minggu bukan hari kerja saat 6 hari', () => {
    const sun = firstSundayOnOrAfter('2026-08-01');
    expect(isWorkday(sun, 6)).toBe(false);
    expect(isWorkday(sun, 7)).toBe(true);
  });
});

describe('estHours', () => {
  it('qty × hours_per_unit', () => {
    expect(estHours(20, 1.5)).toBe(30);
    expect(estHours(1, 24)).toBe(24);
  });
});

describe('addWorkingHours (7 hari, 8 jam/hari)', () => {
  it('muat satu hari', () => {
    expect(addWorkingHours('2026-08-10', 8, P7)).toBe('2026-08-10');
    expect(addWorkingHours('2026-08-10', 0.5, P7)).toBe('2026-08-10');
    expect(addWorkingHours('2026-08-10', 0, P7)).toBe('2026-08-10');
  });
  it('tumpah ke hari berikut', () => {
    expect(addWorkingHours('2026-08-10', 16, P7)).toBe('2026-08-11');
    expect(addWorkingHours('2026-08-10', 20, P7)).toBe('2026-08-12');
  });
  it('qty besar: 200 jam = 25 hari kerja', () => {
    // 25 hari → hari ke-25 dari 2026-08-10 (indeks 0) = +24 hari
    expect(addWorkingHours('2026-08-10', 200, P7)).toBe(addDays('2026-08-10', 24));
  });
});

describe('addWorkingHours melewati libur mingguan', () => {
  it('melompati Minggu saat 6 hari kerja', () => {
    const sun = firstSundayOnOrAfter('2026-08-03');
    const sat = addDays(sun, -1); // Sabtu, hari kerja
    // mulai Sabtu, butuh 2 hari kerja (16 jam): Sabtu penuh, lalu lompat Minggu → Senin
    const finish = addWorkingHours(sat, 16, P6);
    expect(finish).toBe(addDays(sun, 1)); // Senin
  });
});

describe('queueCursor & scheduleOrder', () => {
  const today = '2026-08-10';

  it('antrian kosong → mulai hari ini', () => {
    const sched = scheduleOrder({
      today,
      estHours: 8,
      deadline: '2026-08-20',
      activeJobs: [],
      profile: P7,
    });
    expect(sched.startDate).toBe(today);
    expect(sched.finishDate).toBe(today);
    expect(sched.status).toBe('aman');
  });

  it('antrian penuh → mulai setelah order terakhir selesai', () => {
    const jobs: QueuedJob[] = [
      { label: 'kebaya', estHours: 24, startDate: today, finishDate: '2026-08-12' },
      { label: 'seragam', estHours: 24, startDate: '2026-08-13', finishDate: '2026-08-15' },
    ];
    const cursor = queueCursor(today, jobs, P7);
    expect(cursor).toBe('2026-08-16'); // sehari setelah 15 Agu
    const sched = scheduleOrder({
      today,
      estHours: 8,
      deadline: '2026-08-25',
      activeJobs: jobs,
      profile: P7,
    });
    expect(sched.startDate).toBe('2026-08-16');
    expect(sched.finishDate).toBe('2026-08-16');
  });

  it('deadline lewat → status terlambat + daysLate', () => {
    const sched = scheduleOrder({
      today,
      estHours: 80, // 10 hari kerja → selesai 19 Agu
      deadline: '2026-08-15',
      activeJobs: [],
      profile: P7,
    });
    expect(sched.finishDate).toBe('2026-08-19');
    expect(sched.status).toBe('terlambat');
    expect(sched.daysLate).toBe(4);
  });

  it('deadline pas → status mepet', () => {
    const sched = scheduleOrder({
      today,
      estHours: 80,
      deadline: '2026-08-19',
      activeJobs: [],
      profile: P7,
    });
    expect(sched.status).toBe('mepet');
    expect(sched.daysLate).toBe(0);
  });

  it('tanpa deadline → status null', () => {
    const sched = scheduleOrder({
      today,
      estHours: 8,
      deadline: null,
      activeJobs: [],
      profile: P7,
    });
    expect(sched.status).toBeNull();
    expect(sched.daysLate).toBeNull();
  });
});

describe('packing per-jam (order kecil berbagi hari)', () => {
  const today = '2026-08-10';

  it('lima order 2 jam menumpuk di hari yang sama, bukan 5 hari', () => {
    let jobs: QueuedJob[] = [];
    for (let i = 0; i < 4; i++) {
      const s = scheduleOrder({ today, estHours: 2, deadline: null, activeJobs: jobs, profile: P7 });
      jobs = [...jobs, { label: `kecil-${i}`, estHours: 2, startDate: s.startDate, finishDate: s.finishDate }];
    }
    // 4 × 2 jam = 8 jam → hari ini penuh persis
    expect(jobs.every((j) => j.startDate === today && j.finishDate === today)).toBe(true);
    // Order ke-5 tumpah ke esok hari
    const s5 = scheduleOrder({ today, estHours: 2, deadline: null, activeJobs: jobs, profile: P7 });
    expect(s5.startDate).toBe('2026-08-11');
    expect(s5.finishDate).toBe('2026-08-11');
  });

  it('order baru mengisi sisa jam hari terakhir antrian', () => {
    // 12 jam = 8 jam (10 Agu) + 4 jam (11 Agu) → sisa 4 jam di 11 Agu
    const first = scheduleOrder({ today, estHours: 12, deadline: null, activeJobs: [], profile: P7 });
    expect(first.finishDate).toBe('2026-08-11');
    const jobs: QueuedJob[] = [
      { label: 'a', estHours: 12, startDate: first.startDate, finishDate: first.finishDate },
    ];
    const second = scheduleOrder({ today, estHours: 4, deadline: null, activeJobs: jobs, profile: P7 });
    expect(second.startDate).toBe('2026-08-11');
    expect(second.finishDate).toBe('2026-08-11');
  });

  it('queueCursor menunjuk hari pertama yang masih longgar', () => {
    const jobs: QueuedJob[] = [
      { label: 'penuh', estHours: 8, startDate: today, finishDate: today },
      { label: 'setengah', estHours: 4, startDate: '2026-08-11', finishDate: '2026-08-11' },
    ];
    expect(queueCursor(today, jobs, P7)).toBe('2026-08-11');
  });

  it('packing melompati hari libur mingguan', () => {
    const sat = '2026-08-15'; // Sabtu
    const s = scheduleOrder({ today: sat, estHours: 16, deadline: null, activeJobs: [], profile: P6 });
    expect(s.startDate).toBe(sat);
    expect(s.finishDate).toBe('2026-08-17'); // Minggu dilewati → Senin
  });

  it('order 0 jam selesai di hari mulai', () => {
    const s = scheduleOrder({ today, estHours: 0, deadline: null, activeJobs: [], profile: P7 });
    expect(s.startDate).toBe(today);
    expect(s.finishDate).toBe(today);
  });

  it('tanggal libur khusus (daysOff) dilewati penjadwalan', () => {
    const libur: WorkProfile = {
      ...P7,
      daysOff: new Set(['2026-08-10', '2026-08-11']),
    };
    const s = scheduleOrder({ today, estHours: 16, deadline: null, activeJobs: [], profile: libur });
    expect(s.startDate).toBe('2026-08-12'); // 10–11 libur
    expect(s.finishDate).toBe('2026-08-13');
  });

  it('daysOff di tengah pengerjaan menggeser finish', () => {
    const libur: WorkProfile = { ...P7, daysOff: new Set(['2026-08-11']) };
    const s = scheduleOrder({ today, estHours: 16, deadline: null, activeJobs: [], profile: libur });
    expect(s.startDate).toBe('2026-08-10');
    expect(s.finishDate).toBe('2026-08-12'); // 11 dilompati
  });
});

describe('filledUntil', () => {
  it('kosong → null', () => {
    expect(filledUntil([])).toBeNull();
  });
  it('ambil finish terjauh', () => {
    const jobs: QueuedJob[] = [
      { label: 'a', estHours: 8, startDate: '2026-08-10', finishDate: '2026-08-12' },
      { label: 'b', estHours: 8, startDate: '2026-08-13', finishDate: '2026-08-18' },
    ];
    expect(filledUntil(jobs)).toBe('2026-08-18');
  });
});

describe('computeMargin', () => {
  it('layak bila margin ≥ threshold', () => {
    const r = computeMargin(
      { quantity: 20, quotedPrice: 1_000_000, outsourceCost: 35_000 },
      20,
    );
    expect(r.outsourceTotal).toBe(700_000);
    expect(r.margin).toBe(300_000);
    expect(r.marginPct).toBe(30);
    expect(r.verdict).toBe('layak');
  });
  it('pakai basePrice × qty bila quotedPrice kosong', () => {
    const r = computeMargin({ quantity: 10, basePrice: 100_000, outsourceCost: 60_000 });
    expect(r.sellTotal).toBe(1_000_000);
    expect(r.margin).toBe(400_000);
    expect(r.verdict).toBe('layak');
  });
  it('tipis bila di bawah threshold', () => {
    const r = computeMargin(
      { quantity: 10, quotedPrice: 1_000_000, outsourceCost: 90_000 },
      20,
    );
    expect(r.marginPct).toBe(10);
    expect(r.verdict).toBe('tipis');
  });
  it('rugi bila upah > harga', () => {
    const r = computeMargin({ quantity: 5, quotedPrice: 100_000, outsourceCost: 30_000 });
    expect(r.verdict).toBe('rugi');
  });
  it('data_kurang bila upah/harga hilang', () => {
    const r = computeMargin({ quantity: 5 });
    expect(r.verdict).toBe('data_kurang');
    expect(r.missing).toContain('harga jual');
    expect(r.missing).toContain('upah oper');
  });
});
