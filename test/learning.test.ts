import { describe, it, expect } from 'vitest';
import { learnHoursPerUnit } from '../src/core/learning.js';
import { WorkProfile } from '../src/core/capacity.js';
import { workdaysDiff } from '../src/util/dates.js';

const P7: WorkProfile = { workHoursPerDay: 8, workDaysPerWeek: 7 };
const P6: WorkProfile = { workHoursPerDay: 8, workDaysPerWeek: 6 };

describe('workdaysDiff', () => {
  it('tanggal sama → 0', () => {
    expect(workdaysDiff('2026-08-10', '2026-08-10', 7)).toBe(0);
  });
  it('maju 3 hari (7 hari kerja) → +3', () => {
    expect(workdaysDiff('2026-08-10', '2026-08-13', 7)).toBe(3);
  });
  it('mundur → negatif', () => {
    expect(workdaysDiff('2026-08-13', '2026-08-10', 7)).toBe(-3);
  });
  it('melewati Minggu (6 hari kerja) tidak dihitung', () => {
    // 2026-08-15 Sabtu → 2026-08-17 Senin: Minggu 16 dilewati → 1 hari kerja
    expect(workdaysDiff('2026-08-15', '2026-08-17', 6)).toBe(1);
  });
});

describe('learnHoursPerUnit', () => {
  const base = {
    oldHoursPerUnit: 4,
    estHours: 40, // 10 pcs × 4 jam
    quantity: 10,
    estFinish: '2026-08-15',
    profile: P7,
  };

  it('selesai 2 hari lebih lambat → durasi naik (dipulus, bukan lompat)', () => {
    const r = learnHoursPerUnit({ ...base, actualFinish: '2026-08-17' });
    // observasi: 40 + 2×8 = 56 jam → 5.6 jam/pcs; blend 0.7×4 + 0.3×5.6 = 4.48
    expect(r).not.toBeNull();
    expect(r!.observedPerUnit).toBe(5.6);
    expect(r!.newHoursPerUnit).toBe(4.48);
  });

  it('selesai 2 hari lebih cepat → durasi turun', () => {
    const r = learnHoursPerUnit({ ...base, actualFinish: '2026-08-13' });
    // observasi: 40 − 16 = 24 jam → 2.4 jam/pcs; blend = 3.52
    expect(r!.newHoursPerUnit).toBe(3.52);
  });

  it('selesai tepat waktu → tak ada perubahan (null)', () => {
    expect(learnHoursPerUnit({ ...base, actualFinish: '2026-08-15' })).toBeNull();
  });

  it('perubahan kecil (< 5%) diabaikan', () => {
    // 100 pcs × 4 jam = 400 jam; telat 1 hari = +8 jam → 4.08/pcs; blend 4.02 → delta 0.6%
    const r = learnHoursPerUnit({
      ...base,
      estHours: 400,
      quantity: 100,
      actualFinish: '2026-08-16',
    });
    expect(r).toBeNull();
  });

  it('outlier ekstrem di-clamp (order menganggur lama)', () => {
    // Telat 100 hari → observasi mentah 840 jam, di-clamp ke 4×40 = 160 jam → 16/pcs
    // blend 0.7×4 + 0.3×16 = 7.6 (masih di bawah batas langkah ×2 = 8)
    const r = learnHoursPerUnit({ ...base, actualFinish: '2026-11-23' });
    expect(r!.observedPerUnit).toBe(16);
    expect(r!.newHoursPerUnit).toBe(7.6);
  });

  it('lebih cepat dari fisik mungkin → clamp bawah 0.25×', () => {
    // Lebih cepat 100 hari (mustahil) → observasi min 0.25×40 = 10 jam → 1/pcs
    // blend 0.7×4 + 0.3×1 = 3.1
    const r = learnHoursPerUnit({ ...base, actualFinish: '2026-05-01' });
    expect(r!.newHoursPerUnit).toBe(3.1);
  });

  it('data tak cukup → null', () => {
    expect(
      learnHoursPerUnit({ ...base, estHours: 0, actualFinish: '2026-08-17' }),
    ).toBeNull();
    expect(
      learnHoursPerUnit({ ...base, quantity: 0, actualFinish: '2026-08-17' }),
    ).toBeNull();
  });

  it('hari libur mingguan tak dihitung sebagai keterlambatan', () => {
    // estFinish Sabtu 15 Agu, selesai Senin 17 Agu (Minggu libur) → telat 1 hari kerja
    const r = learnHoursPerUnit({
      ...base,
      profile: P6,
      estFinish: '2026-08-15',
      actualFinish: '2026-08-17',
    });
    // observasi: 40 + 8 = 48 → 4.8/pcs; blend = 4.24
    expect(r!.newHoursPerUnit).toBe(4.24);
  });
});
