// Semua string user-facing dikumpulkan di sini (§13) agar mudah dipoles.
// Bahasa Indonesia santai-sopan.

export const M = {
  // Wizard
  welcome:
    'Halo! Aku *JuruJahit* 🧵 — asisten yang bantu kamu putuskan *terima / oper / tolak* tiap order, ' +
    'pakai hitungan kapasitas, bukan perasaan.\n\nKita setup dulu ya, sebentar saja.\n\n' +
    '*Siapa namamu & nama usahamu?*\nContoh: _Bu Sri — Sri Jahit Modern_',
  askWorkSchedule:
    'Oke! Sekarang, *berapa hari kamu kerja per minggu, dan berapa jam per hari?*\n' +
    'Contoh: _6 hari, 8 jam_',
  askItems:
    'Mantap. Sekarang sebutkan *jenis jahitan yang biasa kamu terima + berapa lama pengerjaannya*.\n' +
    'Contoh: _kebaya payet 3 hari_ atau _celana sekolah 4 jam_\n\n' +
    'Kirim satu-satu. Ketik *selesai* kalau sudah.',
  askItemMore: 'Tambah lagi? Kirim jenis berikutnya, atau ketik *selesai*.',
  askPartners:
    'Terakhir (boleh dilewati): punya *rekan penjahit* buat oper order?\n' +
    'Kirim: _nama — upah per jenis_ (contoh: _Wati — kebaya 150rb_), atau ketik *lewati*.',
  setupDone:
    '✅ Siap, *{name}*!\n\nMulai sekarang, tiap ada orderan masuk, tinggal *forward* chatnya ke sini. ' +
    'Aku hitung kapasitasmu & kasih 3 opsi. 🙂',

  // Umum
  notRegistered: 'Kamu belum setup. Ketik /start dulu ya 🙂',
  forwardHint:
    'Forward saja chat orderannya ke sini ya 🙂\nAtau ketik /antrian untuk lihat antrian, /profil untuk profil.',
  processing: '⏳ Sebentar, aku baca ordernya…',
  duplicateOrder:
    'Order yang sama persis barusan sudah kuproses 🙂 Cek pesan vonis di atas ya. ' +
    'Kalau memang order baru yang mirip, tambahkan pembeda kecil (nama/tanggal) lalu kirim ulang.',
  extractFailed:
    'Waduh, aku belum nangkap detail ordernya. Coba tulis ulang singkat ya, contoh:\n' +
    '_20 seragam kantor, deadline 15 Agustus, bahan dari pelanggan_',

  // Vonis / aksi
  chooseAction: 'Pilih aksi:',
  pickPartner: 'Oper ke rekan yang mana?',
  noPartners:
    'Kamu belum daftarkan rekan penjahit. Tambah dulu lewat /profil, atau pilih opsi lain ya.',
  accepted: '✅ Masuk antrian! Draft balasan buat pelanggan:',
  outsourced: '🤝 Ditandai *dioper* ke {partner}. Draft chat buat rekan:',
  rejected: '🙏 Ditandai *ditolak*. Draft penolakan halus:',
  copyHint: '_(tekan-tahan untuk copy)_',

  // Antrian
  queueEmpty: 'Antrianmu masih kosong 🎉 Forward order pertama untuk mulai.',
  queueHeader: '📋 *Antrian aktif* (urut deadline):',
  filledUntil: '\n🗓 Kapasitas terisi sampai *{date}*',
  monthlyRecap:
    '\n📊 *Bulan ini:* diterima {accepted} · dioper {outsourced} (margin {margin}) · ditolak {rejected}',
  rejectedSignal:
    '📉 Total order kamu tolak bulan ini: *{total}* ({count} order).\n' +
    'Kalau angka ini terus membesar, itu sinyal: layak naikkan harga atau tambah tenaga. 📈',

  // Selesai
  selesaiEmpty: 'Tidak ada order aktif untuk ditandai selesai.',
  selesaiPick: 'Order mana yang sudah *selesai*? (membebaskan kapasitas)',
  selesaiDone: '✅ Order *{label}* ditandai selesai. Kapasitas bebas lagi 👍',
  learnAdjusted:
    '📈 Aku belajar dari order ini: estimasi *{name}* kusetel *{old} → {new} jam/pcs* ' +
    '(dari selisih tanggal selesai asli vs perkiraan). Kalau tak pas, ubah lewat /profil ya.',

  // Dashboard
  dashboardLink:
    '📊 Ini dashboard pribadimu — kalender kapasitas, antrian, dan angka bulan ini.\n' +
    'Simpan linknya, jangan dibagikan ke orang lain ya (ini kunci datamu):',

  // Reminder
  reminderHeader:
    '⏰ *Cek deadline hari ini:*\n{list}\n\n' +
    'Sudah rampung? Tandai lewat /selesai biar kapasitasmu bebas 👍',

  // Libur
  liburList:
    '🏖 *Hari libur khususmu* (di luar libur mingguan):\n{list}\n\n' +
    'Tambah/hapus: ketik _/libur 17 agustus_ (ketik tanggal yang sama lagi untuk membatalkan). ' +
    'Hari libur dilewati waktu aku menghitung jadwal.',
  liburAdded: '🏖 Oke, *{date}* kucatat libur. Jadwal order baru akan melewati hari itu.',
  liburRemoved: '💪 *{date}* dihapus dari daftar libur — kembali jadi hari kerja.',
  liburParseFailed:
    'Formatnya belum kubaca 😅 Contoh: _/libur 17 agustus_ atau _/libur 2026-08-17_',
  liburPast: 'Tanggal itu sudah lewat 🙂 Pilih tanggal mendatang ya.',

  // Profil
  profilHeader: '👤 *Profilmu*',
  errGeneric: 'Aduh, ada kendala teknis sebentar. Coba lagi ya 🙏',
};

export function tpl(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

/** Bungkus teks dalam blockquote Telegram (mudah di-copy). */
export function quote(text: string): string {
  return text
    .split('\n')
    .map((l) => '> ' + l)
    .join('\n');
}
