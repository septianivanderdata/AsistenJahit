// Merakit data vonis 3 opsi dari hasil kalkulasi deterministik.
// Objek ini yang dikirim ke LLM untuk DINARASIKAN (bukan dihitung ulang).
// verdict.ts juga menyediakan fallback teks deterministik bila LLM gagal.

import { Schedule } from './capacity.js';
import { MarginResult } from './margin.js';
import { ISODate, formatID, parseISO } from '../util/dates.js';
import { rupiah } from '../util/format.js';

export interface VerdictInput {
  itemLabel: string;
  quantity: number;
  deadline: ISODate | null;
  materialBy: 'customer' | 'tailor' | 'unknown';
  filledUntil: ISODate | null;
  activeSummary: string; // "3 kebaya + 1 rombongan pengantin"
  schedule: Schedule;
  margin: MarginResult;
  assumptions: string[]; // asumsi eksplisit yang WAJIB ditampilkan (§7)
  roughEstimate: boolean; // true bila durasi item ≈ perkiraan kasar LLM
}

export interface VerdictData extends VerdictInput {
  today: ISODate;
}

/**
 * Teks vonis deterministik — dipakai sebagai fallback bila narasi LLM gagal,
 * dan sebagai "kontrak angka" yang tak boleh diubah LLM.
 */
export function renderVerdictFallback(v: VerdictData): string {
  const y = parseISO(v.today).getUTCFullYear();
  const lines: string[] = [];

  const bahan =
    v.materialBy === 'customer'
      ? ' (bahan dari pelanggan)'
      : v.materialBy === 'tailor'
        ? ' (bahan dari penjahit)'
        : '';
  const dl = v.deadline ? ` — deadline ${formatID(v.deadline, y)}` : '';
  lines.push(`📋 Order: ${v.quantity} pcs ${v.itemLabel}${dl}${bahan}`);
  lines.push('');

  if (v.filledUntil) {
    const isi = v.activeSummary ? ` (${v.activeSummary})` : '';
    lines.push(`🗓 Antrianmu terisi s.d. ${formatID(v.filledUntil, y)}${isi}`);
  } else {
    lines.push('🗓 Antrianmu masih kosong — bisa langsung dikerjakan');
  }
  lines.push('');

  // A — TERIMA
  lines.push(renderAccept(v, y));
  // B — OPER
  lines.push(renderOutsource(v));
  // C — TOLAK
  lines.push('🅲 TOLAK HALUS — tetap jaga pelanggan');
  lines.push('   → [Draft chat tolak]');

  if (v.roughEstimate) {
    lines.push('');
    lines.push('≈ durasi item ini perkiraan kasar — konfirmasi bila perlu.');
  }
  if (v.assumptions.length) {
    lines.push('');
    lines.push('Asumsi: ' + v.assumptions.join('; '));
  }
  lines.push('');
  lines.push('Pilih aksi:');
  return lines.join('\n');
}

function renderAccept(v: VerdictData, y: number): string {
  const s = v.schedule;
  const start = formatID(s.startDate, y);
  const finish = formatID(s.finishDate, y);
  let tail = '';
  if (s.status === 'aman') tail = ' ✅';
  else if (s.status === 'mepet') tail = ' ⚠️ mepet';
  else if (s.status === 'terlambat')
    tail = ` ⚠️ lewat ${s.daysLate} hari`;

  let line = `🅰 TERIMA SENDIRI — mulai ${start}, realistis selesai ${finish}${tail}`;
  const hint =
    s.status === 'terlambat'
      ? '   → nego mundur deadline. [Draft chat nego]'
      : '   → [Draft chat terima]';
  return `${line}\n${hint}`;
}

function renderOutsource(v: VerdictData): string {
  const m = v.margin;
  if (m.verdict === 'data_kurang') {
    return (
      '🅱 OPER ke rekan — data upah/harga belum lengkap\n' +
      `   → butuh: ${m.missing.join(', ')}.\n` +
      `   → isi sekali saja: /profil harga ${v.itemLabel} jual 500rb upah 150rb`
    );
  }
  const upahPer =
    m.outsourceTotal != null && v.quantity > 0
      ? rupiah(m.outsourceTotal / v.quantity)
      : '?';
  const marginStr = m.margin != null ? rupiah(m.margin) : '?';
  const pctStr = m.marginPct != null ? ` (${m.marginPct}%)` : '';
  const badge =
    m.verdict === 'layak' ? ' ✅ layak' : m.verdict === 'rugi' ? ' ❌ rugi' : ' ⚠️ tipis';
  return (
    `🅱 OPER ke rekan — upah ±${upahPer}/pcs, margin sisa ±${marginStr}${pctStr}${badge}\n` +
    '   → [Draft chat ke rekan]'
  );
}
