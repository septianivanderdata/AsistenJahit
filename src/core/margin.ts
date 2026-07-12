// §7 — Estimasi margin oper. PURE. Semua rupiah dihitung di sini, bukan LLM.

export interface MarginInput {
  quantity: number;
  quotedPrice?: number | null; // total harga jual order (bila disebut pelanggan)
  basePrice?: number | null; // harga jual biasa per pcs (dari profil item)
  outsourceCost?: number | null; // upah oper ke rekan per pcs
}

export type MarginVerdict = 'layak' | 'tipis' | 'rugi' | 'data_kurang';

export interface MarginResult {
  sellTotal: number | null; // total harga jual dipakai
  outsourceTotal: number | null; // total upah oper
  margin: number | null; // sellTotal - outsourceTotal
  marginPct: number | null; // margin / sellTotal
  verdict: MarginVerdict;
  /** field yang hilang sehingga hitungan tak lengkap */
  missing: string[];
}

const DEFAULT_THRESHOLD_PCT = Number(process.env.MARGIN_THRESHOLD_PCT ?? 20);

export function computeMargin(
  input: MarginInput,
  thresholdPct: number = DEFAULT_THRESHOLD_PCT,
): MarginResult {
  const { quantity } = input;
  const missing: string[] = [];

  // Harga jual: pakai quotedPrice (total) bila ada, else basePrice × qty.
  let sellTotal: number | null = null;
  if (input.quotedPrice != null) {
    sellTotal = input.quotedPrice;
  } else if (input.basePrice != null) {
    sellTotal = input.basePrice * quantity;
  } else {
    // Label tampil di pesan bot — tanpa underscore (dimakan parser Markdown).
    missing.push('harga jual');
  }

  let outsourceTotal: number | null = null;
  if (input.outsourceCost != null) {
    outsourceTotal = input.outsourceCost * quantity;
  } else {
    missing.push('upah oper');
  }

  if (sellTotal == null || outsourceTotal == null) {
    return {
      sellTotal,
      outsourceTotal,
      margin: null,
      marginPct: null,
      verdict: 'data_kurang',
      missing,
    };
  }

  const margin = round2(sellTotal - outsourceTotal);
  const marginPct = sellTotal > 0 ? round2((margin / sellTotal) * 100) : null;

  let verdict: MarginVerdict;
  if (margin < 0) verdict = 'rugi';
  else if (marginPct != null && marginPct >= thresholdPct) verdict = 'layak';
  else verdict = 'tipis';

  return { sellTotal, outsourceTotal, margin, marginPct, verdict, missing };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
