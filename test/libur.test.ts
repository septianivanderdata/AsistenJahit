import { describe, it, expect } from 'vitest';
import { parseDateID } from '../src/bot/handlers/libur.js';

const TODAY = '2026-07-12';

describe('parseDateID', () => {
  it('format ISO diterima langsung', () => {
    expect(parseDateID('2026-08-17', TODAY)).toBe('2026-08-17');
  });
  it('nama bulan Indonesia', () => {
    expect(parseDateID('17 agustus', TODAY)).toBe('2026-08-17');
    expect(parseDateID('17 Agustus 2027', TODAY)).toBe('2027-08-17');
    expect(parseDateID('1 des', TODAY)).toBe('2026-12-01');
  });
  it('tanpa tahun & sudah lewat → tahun depan', () => {
    expect(parseDateID('1 januari', TODAY)).toBe('2027-01-01');
  });
  it('input tak dikenal → null', () => {
    expect(parseDateID('besok', TODAY)).toBeNull();
    expect(parseDateID('17 augustus', TODAY)).toBeNull();
    expect(parseDateID('', TODAY)).toBeNull();
  });
});
