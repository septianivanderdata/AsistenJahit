// Tipe baris DB (subset yang dipakai backend).

export interface Tailor {
  id: string;
  telegram_chat_id: number;
  name: string;
  business_name: string | null;
  work_days_per_week: number;
  work_hours_per_day: number;
  created_at?: string;
}

export interface ItemType {
  id: string;
  tailor_id: string;
  name: string;
  aliases: string[] | null;
  hours_per_unit: number;
  base_price: number | null;
  outsource_cost: number | null;
}

export interface Partner {
  id: string;
  tailor_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'outsourced'
  | 'rejected'
  | 'done'
  | 'cancelled';

export interface Order {
  id: string;
  tailor_id: string;
  customer_name: string | null;
  raw_message: string;
  extracted: unknown;
  item_type_id: string | null;
  item_label: string;
  quantity: number;
  deadline: string | null;
  material_provided_by: 'customer' | 'tailor' | 'unknown';
  est_hours: number;
  quoted_price: number | null;
  status: OrderStatus;
  partner_id: string | null;
  outsource_cost: number | null;
  start_date: string | null;
  finish_date: string | null;
  verdict: unknown;
  created_at?: string;
  decided_at?: string | null;
  completed_at?: string | null;
}

/** Status yang masih memakan kapasitas (menempati antrian). */
export const ACTIVE_STATUSES: OrderStatus[] = ['accepted'];
