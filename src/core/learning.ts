// Belajar dari realita (§7 lanjutan): saat order ditandai selesai, selisih
// tanggal selesai ASLI vs ESTIMASI dipakai mengoreksi hours_per_unit item.
// PURE FUNCTIONS — tanpa I/O, tanpa LLM. Estimasi makin akurat tiap order
// tanpa input manual apa pun dari penjahit.

import { ISODate, workdaysDiff } from '../util/dates.js';
import { WorkProfile, round2 } from './capacity.js';

/** Bobot data baru dalam pemulusan (sisanya bobot estimasi lama). */
const BLEND_NEW = 0.3;
/** Batas koreksi per satu order: maksimal ×2 / ÷2 dari durasi lama. */
const MAX_STEP = 2;
/** Perubahan < 5% diabaikan — noise, bukan sinyal. */
const MIN_DELTA_PCT = 0.05;
/** Observasi total dibatasi 0.25×–4× estimasi: menahan outlier ekstrem
 *  (mis. order lama menganggur lalu ditandai selesai sekaligus). */
const OBS_MIN_FACTOR = 0.25;
const OBS_MAX_FACTOR = 4;

export interface LearnResult {
  /** Durasi per pcs hasil observasi order ini (jam). */
  observedPerUnit: number;
  /** Durasi per pcs baru setelah pemulusan & clamp (jam). */
  newHoursPerUnit: number;
}

/**
 * Hitung koreksi hours_per_unit dari satu order yang selesai.
 * Observasi = estimasi jam ± (selisih hari kerja × jam kerja/hari).
 * Mengembalikan null bila data tak cukup atau perubahan tak berarti.
 */
export function learnHoursPerUnit(params: {
  oldHoursPerUnit: number;
  estHours: number;
  quantity: number;
  estFinish: ISODate;
  actualFinish: ISODate;
  profile: WorkProfile;
}): LearnResult | null {
  const { oldHoursPerUnit, estHours, quantity, estFinish, actualFinish, profile } = params;
  if (oldHoursPerUnit <= 0 || estHours <= 0 || quantity <= 0) return null;

  const deltaDays = workdaysDiff(estFinish, actualFinish, profile.workDaysPerWeek);
  let observedTotal = estHours + deltaDays * profile.workHoursPerDay;
  observedTotal = Math.min(
    estHours * OBS_MAX_FACTOR,
    Math.max(estHours * OBS_MIN_FACTOR, observedTotal),
  );
  const observedPerUnit = round2(observedTotal / quantity);

  let blended = (1 - BLEND_NEW) * oldHoursPerUnit + BLEND_NEW * observedPerUnit;
  blended = Math.min(
    oldHoursPerUnit * MAX_STEP,
    Math.max(oldHoursPerUnit / MAX_STEP, blended),
  );
  const newHoursPerUnit = round2(blended);

  const deltaPct = Math.abs(newHoursPerUnit - oldHoursPerUnit) / oldHoursPerUnit;
  if (deltaPct < MIN_DELTA_PCT) return null;

  return { observedPerUnit, newHoursPerUnit };
}
