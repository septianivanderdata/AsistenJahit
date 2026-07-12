// Sinyal naik kelas (§1 visi): agregasi bulanan deterministik dari order
// yang sudah diputuskan. PURE — tanpa I/O, tanpa LLM.

export interface RecapOrder {
  status: string;
  quantity: number;
  quoted_price: number | null;
  outsource_cost: number | null;
  /** snapshot vonis (jsonb) — dipakai fallback nilai order */
  verdict?: unknown;
}

export interface MonthlyRecap {
  acceptedTotal: number;
  acceptedCount: number;
  outsourcedTotal: number;
  outsourcedMargin: number;
  outsourcedCount: number;
  rejectedTotal: number;
  rejectedCount: number;
}

/** Nilai rupiah satu order: harga dari chat, else snapshot hitungan vonis. */
export function orderValue(o: RecapOrder): number {
  if (o.quoted_price != null && Number(o.quoted_price) > 0) {
    return Number(o.quoted_price);
  }
  const sell = (o.verdict as any)?.margin?.sellTotal;
  return Number.isFinite(Number(sell)) && Number(sell) > 0 ? Number(sell) : 0;
}

export function monthlyRecap(orders: RecapOrder[]): MonthlyRecap {
  const r: MonthlyRecap = {
    acceptedTotal: 0,
    acceptedCount: 0,
    outsourcedTotal: 0,
    outsourcedMargin: 0,
    outsourcedCount: 0,
    rejectedTotal: 0,
    rejectedCount: 0,
  };
  for (const o of orders) {
    const val = orderValue(o);
    // 'done' = order accepted yang sudah rampung — tetap karya bulan ini.
    if (o.status === 'accepted' || o.status === 'done') {
      r.acceptedTotal += val;
      r.acceptedCount++;
    } else if (o.status === 'outsourced') {
      r.outsourcedTotal += val;
      r.outsourcedCount++;
      if (o.outsource_cost != null) {
        r.outsourcedMargin += val - Number(o.outsource_cost) * o.quantity;
      }
    } else if (o.status === 'rejected') {
      r.rejectedTotal += val;
      r.rejectedCount++;
    }
  }
  return r;
}
