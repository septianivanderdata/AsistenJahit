import { describe, expect, it } from 'vitest';
import { extractPrices, parseItemDuration, parseRupiah } from '../src/util/parse.js';

describe('parseRupiah', () => {
  it('sufiks ribuan', () => {
    expect(parseRupiah('500rb')).toBe(500_000);
    expect(parseRupiah('500 ribu')).toBe(500_000);
    expect(parseRupiah('150k')).toBe(150_000);
  });

  it('sufiks jutaan (termasuk desimal koma)', () => {
    expect(parseRupiah('2jt')).toBe(2_000_000);
    expect(parseRupiah('1,5jt')).toBe(1_500_000);
    expect(parseRupiah('2 juta')).toBe(2_000_000);
  });

  it('titik sebagai pemisah ribuan', () => {
    expect(parseRupiah('500.000')).toBe(500_000);
    expect(parseRupiah('1.250.000')).toBe(1_250_000);
  });

  it('angka polos & prefiks Rp', () => {
    expect(parseRupiah('80000')).toBe(80_000);
    expect(parseRupiah('Rp 350rb')).toBe(350_000);
  });

  it('tolak input tak valid', () => {
    expect(parseRupiah('mahal')).toBeNull();
    expect(parseRupiah('0')).toBeNull();
    expect(parseRupiah('')).toBeNull();
  });
});

describe('extractPrices', () => {
  it('ambil jual & upah, sisakan nama + durasi', () => {
    const r = extractPrices('kebaya payet 3 hari, jual 500rb, upah rekan 150rb');
    expect(r.basePrice).toBe(500_000);
    expect(r.outsourceCost).toBe(150_000);
    expect(r.rest).toBe('kebaya payet 3 hari');
  });

  it('hanya harga jual', () => {
    const r = extractPrices('gamis 5 jam harga 300rb');
    expect(r.basePrice).toBe(300_000);
    expect(r.outsourceCost).toBeNull();
    expect(r.rest).toBe('gamis 5 jam');
  });

  it('tanpa harga → teks utuh', () => {
    const r = extractPrices('celana sekolah 4 jam');
    expect(r.basePrice).toBeNull();
    expect(r.outsourceCost).toBeNull();
    expect(r.rest).toBe('celana sekolah 4 jam');
  });

  it('angka rupiah tidak tertukar dengan durasi', () => {
    const r = extractPrices('seragam 6 jam jual 200rb upah 60rb');
    expect(r.rest).toBe('seragam 6 jam');
  });
});

describe('parseItemDuration + harga', () => {
  it('durasi & dua harga sekaligus', () => {
    const it = parseItemDuration('kebaya payet 3 hari, jual 500rb, upah rekan 150rb', 8);
    expect(it).toMatchObject({
      name: 'kebaya payet',
      hoursPerUnit: 24,
      basePrice: 500_000,
      outsourceCost: 150_000,
    });
  });

  it('tanpa harga tetap jalan (kompatibel lama)', () => {
    const it = parseItemDuration('celana sekolah 4 jam', 8);
    expect(it).toMatchObject({ name: 'celana sekolah', hoursPerUnit: 4 });
    expect(it?.basePrice ?? null).toBeNull();
    expect(it?.outsourceCost ?? null).toBeNull();
  });

  it('harga jual saja — upah null', () => {
    const it = parseItemDuration('gamis pesta 5 jam jual 300rb', 8);
    expect(it).toMatchObject({
      name: 'gamis pesta',
      hoursPerUnit: 5,
      basePrice: 300_000,
      outsourceCost: null,
    });
  });

  it('menit → jam, harga tetap terbaca', () => {
    const it = parseItemDuration('masker 90 menit jual 25rb', 8);
    expect(it).toMatchObject({ name: 'masker', hoursPerUnit: 1.5, basePrice: 25_000 });
  });

  it('teks tanpa angka → null', () => {
    expect(parseItemDuration('celana', 8)).toBeNull();
  });
});
