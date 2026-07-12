// Format angka & rupiah untuk pesan bot.

/** "Rp35rb", "Rp1,2jt", "Rp300rb" — ringkas gaya chat. */
export function rupiah(n: number): string {
  const v = Math.round(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const jt = abs / 1_000_000;
    return `${sign}Rp${trim(jt)}jt`;
  }
  if (abs >= 1_000) {
    const rb = abs / 1_000;
    return `${sign}Rp${trim(rb)}rb`;
  }
  return `${sign}Rp${abs}`;
}

/** Rupiah penuh dengan pemisah ribuan: "Rp4.200.000". */
export function rupiahFull(n: number): string {
  const v = Math.round(n);
  return 'Rp' + v.toLocaleString('id-ID');
}

function trim(n: number): string {
  // Maks 1 desimal, koma gaya Indonesia, buang .0
  const r = Math.round(n * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ',');
}
