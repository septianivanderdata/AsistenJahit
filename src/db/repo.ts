// Query functions. Semua akses DB lewat sini agar handler bersih.
import { db } from './client.js';
import {
  ACTIVE_STATUSES,
  ItemType,
  Order,
  OrderStatus,
  Partner,
  Tailor,
} from './types.js';

// ---- Tailor ----
export async function getTailorByChat(chatId: number): Promise<Tailor | null> {
  const { data, error } = await db
    .from('tailors')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();
  if (error) throw error;
  return data as Tailor | null;
}

export async function createTailor(t: {
  telegram_chat_id: number;
  name: string;
  business_name?: string | null;
  work_days_per_week: number;
  work_hours_per_day: number;
}): Promise<Tailor> {
  const { data, error } = await db.from('tailors').insert(t).select().single();
  if (error) throw error;
  return data as Tailor;
}

export async function updateTailor(
  id: string,
  patch: Partial<Tailor>,
): Promise<void> {
  const { error } = await db.from('tailors').update(patch).eq('id', id);
  if (error) throw error;
}

export async function getAllTailors(): Promise<Tailor[]> {
  const { data, error } = await db.from('tailors').select('*');
  if (error) throw error;
  return (data ?? []) as Tailor[];
}

// ---- Item types ----
export async function getItemTypes(tailorId: string): Promise<ItemType[]> {
  const { data, error } = await db
    .from('item_types')
    .select('*')
    .eq('tailor_id', tailorId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ItemType[];
}

export async function updateItemType(
  id: string,
  patch: Partial<ItemType>,
): Promise<void> {
  const { error } = await db.from('item_types').update(patch).eq('id', id);
  if (error) throw error;
}

export async function addItemType(row: {
  tailor_id: string;
  name: string;
  aliases?: string[];
  hours_per_unit: number;
  base_price?: number | null;
  outsource_cost?: number | null;
}): Promise<ItemType> {
  const { data, error } = await db.from('item_types').insert(row).select().single();
  if (error) throw error;
  return data as ItemType;
}

// ---- Partners ----
export async function getPartners(tailorId: string): Promise<Partner[]> {
  const { data, error } = await db
    .from('partners')
    .select('*')
    .eq('tailor_id', tailorId);
  if (error) throw error;
  return (data ?? []) as Partner[];
}

export async function addPartner(row: {
  tailor_id: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
}): Promise<Partner> {
  const { data, error } = await db.from('partners').insert(row).select().single();
  if (error) throw error;
  return data as Partner;
}

// ---- Orders ----
export async function getActiveOrders(tailorId: string): Promise<Order[]> {
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('tailor_id', tailorId)
    .in('status', ACTIVE_STATUSES)
    .order('finish_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}

/** Order aktif urut deadline untuk /antrian. */
export async function getOrdersByDeadline(tailorId: string): Promise<Order[]> {
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('tailor_id', tailorId)
    .in('status', ACTIVE_STATUSES)
    .order('deadline', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}

/** Batalkan order `pending` basi (vonis tak pernah dieksekusi user). */
export async function cancelStalePending(
  tailorId: string,
  cutoffISO: string,
): Promise<void> {
  const { error } = await db
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('tailor_id', tailorId)
    .eq('status', 'pending')
    .lt('created_at', cutoffISO);
  if (error) throw error;
}

/** Cari order dgn teks forward identik sejak `sinceISO` (anti-duplikat). */
export async function findRecentDuplicate(
  tailorId: string,
  rawMessage: string,
  sinceISO: string,
): Promise<Order | null> {
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('tailor_id', tailorId)
    .eq('raw_message', rawMessage)
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as Order | null;
}

/** Order aktif ber-deadline ≤ `maxDeadlineISO` (reminder harian). */
export async function getUpcomingDeadlines(
  tailorId: string,
  maxDeadlineISO: string,
): Promise<Order[]> {
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('tailor_id', tailorId)
    .in('status', ['accepted', 'outsourced'])
    .not('deadline', 'is', null)
    .lte('deadline', maxDeadlineISO)
    .order('deadline', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Order[];
}

/** Order yang diputuskan sejak `monthStartISO` (untuk rekap bulanan). */
export async function getDecidedSince(
  tailorId: string,
  monthStartISO: string,
): Promise<Order[]> {
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('tailor_id', tailorId)
    .gte('decided_at', monthStartISO)
    .in('status', ['accepted', 'outsourced', 'rejected', 'done']);
  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function insertOrder(row: Partial<Order>): Promise<Order> {
  const { data, error } = await db.from('orders').insert(row).select().single();
  if (error) throw error;
  return data as Order;
}

export async function getOrder(id: string): Promise<Order | null> {
  const { data, error } = await db.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Order | null;
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<void> {
  const { error } = await db.from('orders').update(patch).eq('id', id);
  if (error) throw error;
}

export async function setOrderStatus(
  id: string,
  status: OrderStatus,
  patch: Partial<Order> = {},
): Promise<void> {
  const now = new Date().toISOString();
  const extra: Partial<Order> = { status, ...patch };
  if (status === 'done') extra.completed_at = now;
  else extra.decided_at = now;
  await updateOrder(id, extra);
}
