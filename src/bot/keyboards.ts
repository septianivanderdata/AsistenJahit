import { InlineKeyboard } from 'grammy';
import { Order, Partner } from '../db/types.js';

/** Tombol vonis 3 opsi (§6.2). callback_data pendek: act:<decision>:<orderId> */
export function verdictKeyboard(orderId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Terima', `act:accept:${orderId}`)
    .text('🤝 Oper', `act:outsource:${orderId}`)
    .text('🙏 Tolak', `act:reject:${orderId}`);
}

/** Daftar rekan untuk pilihan oper. partner:<orderId>:<partnerId> */
export function partnerKeyboard(orderId: string, partners: Partner[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  partners.forEach((p, i) => {
    kb.text(p.name, `partner:${orderId}:${p.id}`);
    if (i % 2 === 1) kb.row();
  });
  return kb;
}

/** Daftar order aktif untuk /selesai. done:<orderId> */
export function selesaiKeyboard(orders: Order[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const o of orders) {
    const dl = o.deadline ? ` (${o.deadline})` : '';
    kb.text(`${o.quantity}× ${o.item_label}${dl}`, `done:${o.id}`).row();
  }
  return kb;
}

/** Daftar order aktif untuk /edit. edit:<orderId> */
export function editPickKeyboard(orders: Order[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const o of orders) {
    const dl = o.deadline ? ` (${o.deadline})` : '';
    kb.text(`${o.quantity}× ${o.item_label}${dl}`, `edit:${o.id}`).row();
  }
  return kb;
}

/** Pilihan aksi edit satu order. editf:<orderId>:<field> */
export function editFieldKeyboard(orderId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('⏩ Percepat/ubah selesai', `editf:${orderId}:finish`)
    .row()
    .text('📅 Ubah deadline', `editf:${orderId}:deadline`)
    .row()
    .text('🗑 Batalkan order', `editf:${orderId}:cancel`);
}
