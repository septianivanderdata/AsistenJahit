// Orkestrasi deterministik: extracted + konteks → data order + data vonis.
// Tidak ada LLM di sini. LLM hanya dipanggil untuk ekstraksi (sebelum) &
// narasi/draft (sesudah).

import { ExtractedOrder } from '../llm/extract.js';
import { ItemType, Order, Tailor } from '../db/types.js';
import {
  QueuedJob,
  Schedule,
  WorkProfile,
  estHours,
  filledUntil,
  scheduleOrder,
  sortJobs,
} from './capacity.js';
import { computeMargin } from './margin.js';
import { rupiah } from '../util/format.js';
import { VerdictData } from './verdict.js';
import { config } from '../config.js';

// Default kasar bila item tak dikenal: 1 hari kerja per unit.
const ROUGH_HOURS_PER_UNIT_DAYS = 1;

export interface PipelineResult {
  verdictData: VerdictData;
  orderInsert: Partial<Order>;
}

function activeSummary(active: Order[]): string {
  if (!active.length) return '';
  const counts = new Map<string, number>();
  for (const o of active) {
    counts.set(o.item_label, (counts.get(o.item_label) ?? 0) + o.quantity);
  }
  return [...counts.entries()].map(([label, n]) => `${n} ${label}`).join(' + ');
}

function toJobs(active: Order[]): QueuedJob[] {
  return sortJobs(
    active
      .filter((o) => o.start_date && o.finish_date)
      .map((o) => ({
        label: o.item_label,
        estHours: Number(o.est_hours),
        startDate: o.start_date!,
        finishDate: o.finish_date!,
      })),
  );
}

export function buildPipeline(params: {
  today: string;
  tailor: Tailor;
  itemTypes: ItemType[];
  activeOrders: Order[];
  extracted: ExtractedOrder;
  /** Tanggal libur khusus tailor (nasional/cuti). */
  daysOff?: Set<string>;
}): PipelineResult {
  const { today, tailor, itemTypes, activeOrders, extracted, daysOff } = params;

  const profile: WorkProfile = {
    workHoursPerDay: Number(tailor.work_hours_per_day),
    workDaysPerWeek: Number(tailor.work_days_per_week),
    daysOff,
  };

  const item = extracted.items[0] ?? {
    label: 'item',
    quantity: 1,
    matched_item_type_id: null,
  };
  const quantity = Math.max(1, item.quantity || 1);

  const matched = item.matched_item_type_id
    ? itemTypes.find((t) => t.id === item.matched_item_type_id) ?? null
    : null;

  const assumptions: string[] = [];
  let roughEstimate = false;
  let hoursPerUnit: number;
  if (matched) {
    hoursPerUnit = Number(matched.hours_per_unit);
  } else {
    hoursPerUnit = profile.workHoursPerDay * ROUGH_HOURS_PER_UNIT_DAYS;
    roughEstimate = true;
    assumptions.push(
      `durasi "${item.label}" belum ada di profil → dipakai ≈ ${hoursPerUnit} jam/pcs`,
    );
  }

  if (extracted.items.length > 1) {
    assumptions.push('hanya item pertama dihitung; sisanya belum masuk perhitungan');
  }
  if (!extracted.deadline_iso) assumptions.push('deadline belum jelas');
  for (const a of extracted.ambiguities) assumptions.push(a);

  const hrs = estHours(quantity, hoursPerUnit);
  const jobs = toJobs(activeOrders);
  const schedule: Schedule = scheduleOrder({
    today,
    estHours: hrs,
    deadline: extracted.deadline_iso,
    activeJobs: jobs,
    profile,
  });

  // Info sisipkan: bila telat lewat antrian normal, hitung seandainya order
  // ini diprioritaskan paling depan (antrian lain mundur). Deterministik,
  // sekadar informasi — tidak mengubah jadwal siapa pun.
  if (schedule.status === 'terlambat' && jobs.length > 0) {
    const prioritized = scheduleOrder({
      today,
      estHours: hrs,
      deadline: extracted.deadline_iso,
      activeJobs: [],
      profile,
    });
    if (prioritized.status !== 'terlambat') {
      const shiftDays = Math.ceil(hrs / profile.workHoursPerDay);
      assumptions.push(
        `masih MUAT kalau disisipkan paling depan: selesai ${prioritized.finishDate}, ` +
          `tapi order lain di antrian mundur ±${shiftDays} hari kerja`,
      );
    }
  }

  if (extracted.quoted_price != null) {
    assumptions.push(
      `harga dari chat: total ${rupiah(extracted.quoted_price)}`,
    );
  }
  const margin = computeMargin(
    {
      quantity,
      quotedPrice: extracted.quoted_price,
      basePrice: matched?.base_price ?? null,
      outsourceCost: matched?.outsource_cost ?? null,
    },
    config.marginThresholdPct,
  );

  const verdictData: VerdictData = {
    today,
    itemLabel: item.label,
    quantity,
    deadline: extracted.deadline_iso,
    materialBy: extracted.material_provided_by,
    filledUntil: filledUntil(jobs),
    activeSummary: activeSummary(activeOrders),
    schedule,
    margin,
    assumptions,
    roughEstimate,
  };

  const orderInsert: Partial<Order> = {
    tailor_id: tailor.id,
    customer_name: extracted.customer_name,
    raw_message: '', // diisi handler
    extracted: extracted as unknown,
    item_type_id: matched?.id ?? null,
    item_label: item.label,
    quantity,
    deadline: extracted.deadline_iso,
    material_provided_by: extracted.material_provided_by,
    est_hours: hrs,
    quoted_price: extracted.quoted_price,
    outsource_cost: matched?.outsource_cost ?? null,
    status: 'pending',
    start_date: schedule.startDate,
    finish_date: schedule.finishDate,
    verdict: verdictData as unknown,
  };

  return { verdictData, orderInsert };
}
