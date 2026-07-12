# Panduan JuruJahit 🧵 — untuk Penjahit

JuruJahit itu asisten di Telegram. Tugasnya satu: tiap ada orderan masuk, dia bantu kamu memutuskan **TERIMA sendiri, OPER ke rekan, atau TOLAK halus** — pakai hitungan kapasitas, bukan perasaan.

Kamu tidak perlu instal apa-apa. Cukup punya Telegram.

---

## 1. Mulai pertama kali (sekali saja, ±5 menit)

1. Buka Telegram, cari bot yang diberikan (nama bot dari pemilik/pemasang).
2. Ketik `/start`.
3. Bot akan tanya beberapa hal, jawab santai saja:
   - **Nama & nama usaha** — contoh: `Bu Sri — Sri Jahit Modern`
   - **Jadwal kerja** — contoh: `6 hari, 8 jam`
   - **Jenis jahitan + lamanya** — kirim satu-satu, contoh:
     - `kebaya payet 3 hari`
     - `celana sekolah 4 jam`
     - `seragam kantor 6 jam`
     
     Kalau sudah semua, ketik `selesai`.
   - **Rekan penjahit** (boleh dilewati) — contoh: `Wati — kebaya 150rb`, atau ketik `lewati`.

Selesai. Setup ini cuma sekali.

> 💡 Makin jujur angka lamanya, makin akurat saran bot. Tapi tidak usah pusing — bot **belajar sendiri**: tiap order selesai, perkiraannya dikoreksi otomatis.

---

## 2. Pemakaian sehari-hari: FORWARD saja

Ada pelanggan chat di WA/Telegram minta jahit?

1. **Salin/forward chat pelanggan itu ke bot** (tidak usah diketik ulang, tidak usah dirapikan).
2. Tunggu beberapa detik. Bot membaca ordernya, menghitung antrianmu, lalu kirim **vonis 3 opsi**:

```
📋 Order: 20 pcs seragam kantor — deadline 15 Agu

🗓 Antrianmu terisi s.d. 12 Agu

🅰 TERIMA SENDIRI — realistis selesai 19 Agu ⚠️ lewat 4 hari
🅱 OPER ke rekan — margin sisa ±Rp300rb (30%) ✅ layak
🅲 TOLAK HALUS — tetap jaga pelanggan

[✅ Terima] [🤝 Oper] [🙏 Tolak]
```

3. **Tap satu tombol.** Bot langsung kirim **draft balasan siap-copy** — tekan-tahan, salin, kirim ke pelanggan (atau ke rekan kalau dioper). Antrianmu otomatis terupdate.

Kalau bot kurang yakin (jenis tak dikenal / deadline tidak disebut), dia tanya **satu kali** dengan tebakan. Balas `ya` kalau benar, atau koreksi singkat: `bukan, 15 pcs, deadline 20 Agustus`.

---

## 3. Tiga perintah pendukung

| Ketik | Guna |
|---|---|
| `/antrian` | Lihat semua order aktif, urut deadline + kapasitas terisi sampai kapan |
| `/selesai` | Order rampung? Tandai selesai → kapasitas bebas lagi |
| `/edit` | Ubah order aktif: percepat/geser tanggal selesai, ubah deadline, atau batalkan |
| `/riwayat` | Lihat order yang sudah selesai, ditolak, atau dibatalkan |
| `/libur` | Catat hari libur/cuti — contoh: `/libur 17 agustus` (jadwal otomatis melewatinya) |
| `/profil` | Lihat/ubah jenis jahitan & durasi |
| `/dashboard` | Minta link dashboard pribadimu (lihat bagian 4) |

**Penting: rajin tekan `/selesai` begitu order rampung.** Ini yang membebaskan jadwalmu — kalau lupa, bot mengira kamu masih penuh dan menyuruh tolak order yang sebenarnya masih muat.

---

## 4. Dashboard (lihat di HP/laptop)

Ketik `/dashboard` di bot — dia kirim link pribadimu. Buka di browser, tanpa login (simpan linknya, jangan dibagikan — itu kunci datamu):

- **Kalender kapasitas** — makin gelap warnanya = makin penuh harimu
- **Antrian aktif** — semua order berjalan
- **Angka bulan ini** — nilai order berjalan, margin oper, dan **nilai order yang kamu tolak** (kalau angka ini besar terus → tanda layak naikkan harga atau tambah orang)

---

## 5. Kalau ada masalah

- **Bot tidak balas** → hubungi pemasang (server bot mungkin mati).
- **Bot salah tangkap order** → balas koreksinya waktu ditanya, atau forward ulang dengan tulisan lebih jelas.
- **Perkiraan lama jahit meleset** → biarkan saja beberapa order; bot mengoreksi otomatis tiap kamu tekan `/selesai`. Mau langsung? Ubah lewat `/profil`.
- **Salah tekan tombol** → forward ulang ordernya, putuskan lagi.

---

*JuruJahit — Terima. Oper. Tolak. Dengan hitungan, bukan perasaan.*
