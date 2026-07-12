// §8.1 — Ekstraksi order teks bebas → JSON. Retry 1× bila JSON gagal.
import { ItemType } from '../db/types.js';
import { complete, fill, loadPrompt } from './client.js';

export interface ExtractedItem {
  label: string;
  quantity: number;
  matched_item_type_id: string | null;
}

export interface ExtractedOrder {
  customer_name: string | null;
  items: ExtractedItem[];
  deadline_iso: string | null;
  /** TOTAL harga/budget rupiah bila disebut di chat; null bila tidak. */
  quoted_price: number | null;
  material_provided_by: 'customer' | 'tailor' | 'unknown';
  notes: string | null;
  ambiguities: string[];
}

const SYSTEM =
  'Kamu mengekstrak spesifikasi order jahit dari chat Bahasa Indonesia informal. ' +
  'Balas HANYA JSON valid tanpa markdown.';

/** Buang code fence & ambil blok JSON pertama. */
function stripToJSON(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

function normalize(o: any): ExtractedOrder {
  return {
    customer_name: o.customer_name ?? null,
    items: Array.isArray(o.items)
      ? o.items.map((it: any) => ({
          label: String(it.label ?? 'item'),
          quantity: Number.isFinite(it.quantity) ? Number(it.quantity) : 1,
          matched_item_type_id: it.matched_item_type_id ?? null,
        }))
      : [],
    deadline_iso: o.deadline_iso ?? null,
    quoted_price:
      Number.isFinite(o.quoted_price) && Number(o.quoted_price) > 0
        ? Number(o.quoted_price)
        : null,
    material_provided_by: ['customer', 'tailor', 'unknown'].includes(
      o.material_provided_by,
    )
      ? o.material_provided_by
      : 'unknown',
    notes: o.notes ?? null,
    ambiguities: Array.isArray(o.ambiguities) ? o.ambiguities.map(String) : [],
  };
}

function itemTypesBlock(items: ItemType[]): string {
  if (!items.length) return '(belum ada jenis terdaftar)';
  return items
    .map((it) => {
      const al = it.aliases?.length ? ` [alias: ${it.aliases.join(', ')}]` : '';
      return `- id=${it.id} nama="${it.name}"${al}`;
    })
    .join('\n');
}

export async function extractOrder(params: {
  raw: string;
  today: string;
  itemTypes: ItemType[];
}): Promise<ExtractedOrder> {
  const base = fill(loadPrompt('extract_order'), {
    TODAY: params.today,
    ITEM_TYPES: itemTypesBlock(params.itemTypes),
    RAW: params.raw,
  });

  const attempt = async (extra = ''): Promise<ExtractedOrder> => {
    const text = await complete({
      system: SYSTEM,
      prompt: base + extra,
      temperature: 0,
      maxTokens: 800,
    });
    return normalize(JSON.parse(stripToJSON(text)));
  };

  try {
    return await attempt();
  } catch {
    // Retry 1× dengan pesan koreksi (§8.1).
    return await attempt(
      '\n\nPENTING: balasan sebelumnya bukan JSON valid. Balas ULANG HANYA JSON sesuai skema.',
    );
  }
}
