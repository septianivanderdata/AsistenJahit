# JURUJAHIT — Spesifikasi Proyek Lengkap
> Dokumen ini adalah sumber kebenaran (source of truth) proyek. Simpan sebagai `CLAUDE.md` di root repo agar Claude Code selalu membacanya. Semua keputusan desain sudah final — jangan menambah fitur di luar scope MVP.

---

## 1. KONTEKS & VISI

**Produk:** Asisten AI di Telegram yang membantu penjahit memutuskan **TERIMA / OPER / TOLAK** setiap order masuk — berdasarkan kapasitas antrian riil, bukan perasaan.

**Masalah nyata (dari partner UMKM riil, seorang penjahit):**
- Menerima semua order karena tidak tahu kapasitas sendiri dalam angka
- Orderan menumpuk → panik oper ke rekan penjahit tanpa hitungan margin
- Kebocoran di tiga tempat: margin (upah oper asal lempar), kualitas (nama sendiri dipertaruhkan), pelacakan (order siapa di rekan mana, dicatat di kepala)

**Konteks:** Submission untuk IDCamp Developer Challenge #2 (Dicoding/Indosat) — tema "Digitalization & Acceleration of MSMEs with Generative AI". Syarat: MVP berfungsi, berbasis AI, untuk pengguna non-teknis, Bahasa Indonesia, ramah mobile & koneksi terbatas.

**Visi jangka panjang (HANYA diceritakan di video demo, TIDAK dibangun):** akumulasi data order yang ditolak/dioper menjadi sinyal keputusan naik kelas — "bulan ini kamu menolak order senilai Rp4,2 juta → layak naikkan harga 15% atau rekrut 1 tukang jahit."

---

## 2. FILOSOFI PRODUK (GUARDRAILS — JANGAN DILANGGAR)

1. **Jangan ubah kebiasaan pengguna.** Pelanggan chat WA seperti biasa. Penjahit hanya melakukan SATU gerakan baru: forward chat ke bot. Tidak ada form, tidak ada input manual master data setelah setup awal.
2. **Satu pisau tajam, bukan super-app.** Alur inti hanya: forward → vonis 3 opsi → update antrian. Fitur apapun di luar ini = TOLAK. Termasuk: pembukuan, pembayaran, marketplace, chatbot pelanggan, manajemen stok bahan.
3. **LLM tidak boleh berhitung.** Semua kalkulasi (kapasitas, tanggal, margin) dilakukan kode deterministik. LLM hanya untuk: (a) ekstraksi teks tak terstruktur → JSON, (b) menarasikan hasil hitungan → bahasa manusia, (c) menyusun draft balasan. Ini mencegah halusinasi angka.
4. **Sederhana di depan, berat di belakang.** UX bot harus bisa dipakai penjahit usia 45+ non-teknis. Kompleksitas hidup di backend.
5. **Bahasa Indonesia santai-sopan** di semua output bot (gaya chat sehari-hari, bukan bahasa formal kaku).

---

## 3. SCOPE MVP

### ✅ IN SCOPE
- Bot Telegram: setup profil kapasitas (wizard sekali jalan), terima forward order, keluarkan vonis 3 opsi, tombol aksi (Terima/Oper/Tolak), antrian otomatis terupdate
- Ekstraksi spesifikasi order dari teks forward via Gemini API
- Kalkulasi kapasitas & tanggal realistis (deterministik)
- Estimasi margin oper (deterministik, dari data upah rekan di profil)
- Draft balasan siap-copy untuk 3 skenario (terima/nego mundur, oper, tolak halus)
- Perintah: `/antrian` (lihat antrian aktif), `/selesai` (tandai order selesai), `/profil` (lihat/edit profil kapasitas)
- Dashboard web read-only: kalender kapasitas, daftar antrian, metrik ringkas (nilai order berjalan, nilai ditolak/dioper bulan ini)
- Seed data demo untuk video

### ❌ OUT OF SCOPE (tolak jika diminta)
- Integrasi WhatsApp Business API (cukup narasi roadmap)
- Pembayaran, invoice, pembukuan
- Multi-tailor / multi-tenant kompleks (cukup 1 penjahit = 1 chat_id, tapi desain DB jangan menghalangi multi-tenant nanti)
- Notifikasi push terjadwal, reminder deadline (nice-to-have, hanya jika semua milestone selesai)
- Login/auth di dashboard (cukup URL dengan token rahasia di query param untuk MVP)

---

## 4. ARSITEKTUR & STACK

```
[Pelanggan] --chat--> [WA/Telegram penjahit] --forward--> [Bot Telegram]
                                                              |
                                                    [Node.js backend]
                                                    |       |        |
                                              [Gemini API] [Supabase] [Dashboard web]
```

**Stack (final, jangan diganti):**
- **Runtime:** Node.js 20+, TypeScript
- **Bot framework:** grammY (ringan, TypeScript-first, dokumentasi bagus)
- **Database:** Supabase (PostgreSQL) — pakai `@supabase/supabase-js`
- **LLM:** Google Gemini API (free tier) — model `gemini-2.5-flash` untuk ekstraksi & narasi (gratis+cepat), via `@google/genai`. "Thinking" dimatikan agar hemat kuota. Hanya `src/llm/client.ts` yang menyentuh SDK; abstraksi `complete()` menjaga sisa kode tetap provider-agnostic.
- **Dashboard:** Satu halaman HTML+JS statis (vanilla atau Alpine.js) yang fetch data dari Supabase REST (anon key + RLS read-only) ATAU endpoint Express sederhana. Estetika: bersih, mobile-friendly, aksen warna jahit (benang/emas tua). Grafik pakai Chart.js.
- **Hosting (untuk penjurian, produk wajib bisa diakses):** bot di Railway/Render/VPS murah (long polling, tidak perlu webhook+domain), dashboard di Netlify/GitHub Pages.
- **Dev:** jalankan lokal dulu dengan long polling; `.env` untuk semua secret.

---

## 5. SKEMA DATABASE (SUPABASE / POSTGRES)

Buat migration SQL berikut (sesuaikan detail bila perlu, tapi pertahankan struktur):

```sql
-- Penjahit (single-tenant MVP, tapi siap multi)
create table tailors (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint unique not null,
  name text not null,
  business_name text,
  work_days_per_week int not null default 6,
  work_hours_per_day numeric not null default 8,
  created_at timestamptz default now()
);

-- Profil kapasitas: durasi pengerjaan per jenis item
create table item_types (
  id uuid primary key default gen_random_uuid(),
  tailor_id uuid references tailors(id) not null,
  name text not null,                -- 'kebaya payet', 'celana sekolah', 'seragam kantor'
  aliases text[],                    -- kata kunci lain: {'kebaya','payet'}
  hours_per_unit numeric not null,   -- jam kerja per pcs
  base_price numeric,                -- harga jual biasa per pcs (opsional)
  outsource_cost numeric,            -- upah oper ke rekan per pcs (opsional)
  created_at timestamptz default now()
);

-- Rekan penjahit (untuk opsi OPER)
create table partners (
  id uuid primary key default gen_random_uuid(),
  tailor_id uuid references tailors(id) not null,
  name text not null,
  phone text,
  notes text,                        -- 'jago kebaya, lambat kalau musim nikahan'
  created_at timestamptz default now()
);

-- Order
create table orders (
  id uuid primary key default gen_random_uuid(),
  tailor_id uuid references tailors(id) not null,
  customer_name text,
  raw_message text not null,          -- teks forward asli
  extracted jsonb not null,           -- hasil ekstraksi LLM (audit trail)
  item_type_id uuid references item_types(id),
  item_label text not null,           -- label bebas bila tak cocok item_types
  quantity int not null default 1,
  deadline date,
  material_provided_by text check (material_provided_by in ('customer','tailor','unknown')) default 'unknown',
  est_hours numeric not null,         -- hasil kalkulasi
  quoted_price numeric,
  status text not null check (status in
    ('pending','accepted','outsourced','rejected','done','cancelled')) default 'pending',
  partner_id uuid references partners(id),   -- terisi bila outsourced
  outsource_cost numeric,
  start_date date,                    -- jadwal mulai hasil kalkulasi
  finish_date date,                   -- estimasi selesai hasil kalkulasi
  verdict jsonb,                      -- snapshot vonis 3 opsi (audit + demo)
  created_at timestamptz default now(),
  decided_at timestamptz,
  completed_at timestamptz
);

create index on orders (tailor_id, status);
```

**RLS:** aktifkan; service key dipakai backend; anon key hanya `select` untuk dashboard (atau matikan anon dan pakai endpoint Express).

---

## 6. ALUR BOT (DETAIL)

### 6.1 Setup awal — `/start` (wizard, sekali jalan)
Percakapan bertahap, satu pertanyaan per pesan, simpan progres di state ringan (in-memory map atau tabel kecil):
1. Nama & nama usaha
2. Hari kerja per minggu & jam kerja per hari
3. **Loop input jenis jahitan:** "Sebutkan jenis jahitan yang biasa kamu terima + berapa lama pengerjaannya. Contoh: *kebaya payet 3 hari* atau *celana sekolah 4 jam*. Ketik *selesai* kalau sudah." → tiap jawaban diekstrak LLM jadi `{name, hours_per_unit}` (konversi hari→jam pakai jam kerja/hari), konfirmasi ke user sebelum simpan.
4. (Opsional, boleh dilewati) Rekan penjahit: nama + upah biasa per jenis.
5. Tutup: "Siap! Sekarang tiap ada orderan masuk, tinggal **forward** chatnya ke sini."

### 6.2 Alur inti — forward order
1. User forward/paste teks chat pelanggan.
2. **Ekstraksi (LLM):** keluarkan JSON `{customer_name?, items:[{label, quantity, matched_alias?}], deadline?, material_provided_by?, notes?, ambiguities:[]}`.
3. **Klarifikasi minimal:** jika field kritis kosong (jenis tak dikenali / jumlah / deadline), bot bertanya SATU pertanyaan singkat dengan tebakan ("Ini 20 pcs seragam kantor, deadline 15 Agustus — betul? Kalau beda, koreksi ya"). Maksimal satu putaran klarifikasi; sisanya pakai asumsi eksplisit.
4. **Kalkulasi deterministik** (lihat §7): est_hours, jadwal mulai & selesai realistis, status vs deadline, margin oper.
5. **Vonis (LLM menarasikan hasil hitungan — angka dari kode, BUKAN dari LLM):** kirim pesan vonis dengan format tetap:

```
📋 Order: 20 pcs seragam kantor — deadline 15 Agu (bahan dari pelanggan)

🗓 Antrianmu terisi s.d. 12 Agu (3 kebaya + 1 rombongan pengantin)

🅰 TERIMA SENDIRI — mulai 13 Agu, realistis selesai 19 Agu ⚠️ lewat 4 hari
   → nego mundur deadline. [Draft chat nego]
🅱 OPER ke rekan — upah ±Rp35rb/pcs, margin sisa ±Rp300rb (30%) ✅ layak
   → [Draft chat ke rekan]
🅲 TOLAK HALUS — tetap jaga pelanggan
   → [Draft chat tolak]

Pilih aksi: [✅ Terima] [🤝 Oper] [🙏 Tolak]
```
6. **Tombol aksi (inline keyboard):**
   - ✅ Terima → status `accepted`, masuk antrian dgn start/finish date, kirim draft balasan final ke user (siap copy)
   - 🤝 Oper → tanya pilih rekan (tombol daftar partner) → status `outsourced` + partner_id + outsource_cost, kirim draft chat ke rekan
   - 🙏 Tolak → status `rejected`, kirim draft penolakan halus
7. Semua draft dikirim sebagai pesan terpisah dalam blok kutip agar mudah di-copy.

### 6.3 Perintah pendukung
- `/antrian` — daftar order aktif urut deadline: label, qty, deadline, estimasi selesai, status; + ringkas "kapasitas terisi sampai [tanggal]"
- `/selesai` — tampilkan order aktif sebagai tombol → tandai `done` (membebaskan kapasitas)
- `/profil` — lihat jenis jahitan & durasi; sub-perintah tambah/ubah via percakapan
- Teks bebas non-forward → jawab singkat + arahkan ("Forward saja chat orderannya ke sini ya 🙂")

---

## 7. LOGIKA KAPASITAS (DETERMINISTIK — TULIS DI KODE, BUKAN PROMPT)

```
kapasitas_jam_per_hari = work_hours_per_day
hari_kerja = work_days_per_week (skip hari libur mingguan; MVP: asumsikan Minggu libur bila 6 hari)

est_hours(order) = quantity × hours_per_unit(item_type)
  - jika item tak cocok item_types: minta konfirmasi durasi via 1 pertanyaan,
    atau pakai estimasi LLM DENGAN tanda "≈ perkiraan kasar" dan minta konfirmasi

Penjadwalan (serial, first-come-first-serve):
  cursor = max(hari_ini, tanggal_selesai_order_aktif_terakhir)
  start_date(order_baru) = cursor
  finish_date = tambah est_hours ke kalender kerja (jam/hari, skip libur)

Vonis TERIMA:
  aman     : finish_date ≤ deadline - 1 hari  → ✅
  mepet    : finish_date ≤ deadline           → ⚠️ mepet
  terlambat: finish_date > deadline           → ⚠️ lewat N hari → sarankan nego mundur

Vonis OPER:
  margin = (quoted_price ?? base_price × qty) - (outsource_cost × qty)
  margin_pct = margin / harga_jual
  layak bila margin_pct ≥ 20% (threshold konstanta, mudah diubah)
  jika data upah/harga kosong → tampilkan rumus kosong + minta angka via 1 pertanyaan

Semua asumsi yang dipakai WAJIB ditampilkan eksplisit di pesan vonis.
```

---

## 8. DESAIN PROMPT LLM (GEMINI)

Simpan semua prompt di `src/prompts/` sebagai template terpisah agar mudah diiterasi.

### 8.1 Ekstraksi order (`extract_order.md`)
- System: "Kamu mengekstrak spesifikasi order jahit dari chat Bahasa Indonesia informal (termasuk singkatan & bahasa daerah ringan). Balas HANYA JSON valid tanpa markdown."
- Sertakan daftar `item_types` milik penjahit (name + aliases) agar LLM bisa matching → `matched_item_type_id`.
- Skema output: `{customer_name, items:[{label, quantity, matched_item_type_id|null}], deadline_iso|null, material_provided_by, notes, ambiguities:[string]}`
- Aturan: jangan mengarang angka; yang tidak disebut → null + masuk `ambiguities`. Tanggal relatif ("minggu depan", "sebelum lebaran") → konversi dengan tanggal hari ini yang disuntikkan ke prompt; bila ragu masukkan ke ambiguities.
- Parsing di kode: strip code fence, `JSON.parse` dalam try/catch, retry 1× dengan pesan koreksi bila gagal.

### 8.2 Narasi vonis (`narrate_verdict.md`)
- Input: JSON hasil kalkulasi lengkap (semua angka & tanggal sudah final dari kode).
- Tugas: susun pesan vonis mengikuti format §6.2 PERSIS — boleh memoles kalimat, DILARANG mengubah/menambah angka.
- Nada: seperti teman yang paham bisnis — santai, jelas, tanpa jargon.

### 8.3 Draft balasan (`draft_replies.md`)
- Tiga varian sesuai keputusan: (a) terima + nego mundur deadline bila perlu, (b) chat ke rekan untuk oper (sebut item, qty, deadline, tawaran upah), (c) tolak halus yang menjaga hubungan (tawarkan tanggal alternatif ATAU rekomendasi rekan).
- Nada: sopan khas chat WA Indonesia (boleh "kak/bu/pak" mengikuti sapaan pelanggan di chat asli), singkat, tanpa emoji berlebihan.

---

## 9. DASHBOARD WEB (READ-ONLY, UNTUK DEMO)

Satu halaman, mobile-friendly, data live dari Supabase:
1. **Kalender kapasitas** (4–6 minggu): tiap hari diberi warna intensitas sesuai jam terisi; hover/tap → order apa saja
2. **Antrian aktif:** tabel/kartu urut deadline (item, qty, deadline, estimasi selesai, status badge)
3. **Metrik bulan berjalan:** nilai order diterima (Rp), nilai dioper + total margin oper, **nilai order ditolak (Rp)** ← angka bintang untuk narasi "sinyal naik kelas"
4. Header: nama usaha + "kapasitas terisi sampai [tanggal]"

Estetika: bersih, satu aksen warna (emas tua/benang), font sistem, tanpa framework berat.

---

## 10. STRUKTUR PROYEK

```
jurujahit/
├── CLAUDE.md                  # dokumen ini
├── .env.example               # TELEGRAM_BOT_TOKEN, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
├── package.json
├── src/
│   ├── index.ts               # entry: start bot (long polling)
│   ├── bot/
│   │   ├── handlers/          # start-wizard, forward-order, antrian, selesai, profil, callbacks
│   │   └── keyboards.ts
│   ├── core/
│   │   ├── capacity.ts        # §7 — PURE FUNCTIONS + unit test
│   │   ├── verdict.ts         # rakit data vonis
│   │   └── margin.ts
│   ├── llm/
│   │   ├── client.ts
│   │   ├── extract.ts
│   │   ├── narrate.ts
│   │   └── drafts.ts
│   ├── prompts/               # *.md template
│   ├── db/
│   │   ├── client.ts
│   │   ├── migrations.sql
│   │   └── repo.ts            # query functions
│   └── util/
├── dashboard/
│   └── index.html             # self-contained
├── scripts/
│   └── seed-demo.ts           # data demo video
└── test/
    └── capacity.test.ts       # WAJIB: uji penjadwalan & edge case
```

---

## 11. URUTAN BUILD (MILESTONE)

Kerjakan berurutan; tiap milestone harus JALAN sebelum lanjut.

- **M0 — Fondasi:** init repo TS, env, koneksi Telegram (echo bot), koneksi Supabase, koneksi Gemini (ping). ✔ bot balas echo
- **M1 — Skema & profil:** migrations, wizard `/start`, simpan tailor + item_types. ✔ profil tersimpan & `/profil` tampil
- **M2 — Mesin kapasitas:** `capacity.ts` + unit tests (kasus: antrian kosong, penuh, deadline lewat, libur mingguan, qty besar). ✔ semua test hijau
- **M3 — Ekstraksi:** forward → JSON → konfirmasi/klarifikasi 1 putaran. ✔ 5 contoh chat nyata terekstrak benar
- **M4 — Vonis lengkap:** kalkulasi + narasi + 3 tombol aksi + draft balasan + update antrian. ✔ alur inti end-to-end
- **M5 — Perintah pendukung:** `/antrian`, `/selesai`. ✔ siklus hidup order penuh
- **M6 — Dashboard:** halaman live + seed demo. ✔ kalender & metrik tampil
- **M7 — Poles & deploy:** copywriting pesan bot, error handling ramah, deploy bot + dashboard, uji dengan penjahit asli, rekam video demo

**Definisi selesai MVP:** penjahit asli bisa setup profil, forward 3 order beruntun, mendapat vonis masuk akal, dan antrian di `/antrian` + dashboard konsisten.

---

## 12. SKENARIO VIDEO DEMO (60 detik)

- 0–10 dtk: masalah — cuplikan/kutipan penjahit asli: "orderan numpuk, kuterima semua, terpaksa kuoper ke kawan"
- 10–40 dtk: layar HP — chat pelanggan masuk → forward → vonis 3 opsi muncul → tap 🤝 Oper → draft chat ke rekan siap kirim
- 40–55 dtk: dashboard laptop — kalender kapasitas penuh warna + metrik "order ditolak bulan ini: Rp4,2jt" → narasi visi naik kelas
- 55–60 dtk: logo + tagline: **"Terima. Oper. Tolak. Dengan hitungan, bukan perasaan."**

Seed data demo harus menghasilkan tampilan dashboard yang "hidup" (± 8–12 order beragam status).

---

## 13. CATATAN UNTUK CLAUDE CODE

- Kerjakan per milestone; jangan generate seluruh proyek sekaligus.
- `capacity.ts` wajib pure function + unit test SEBELUM dipakai handler.
- Semua string pesan bot dikumpulkan di satu modul (`src/bot/messages.ts`) agar mudah dipoles.
- Tangani error LLM dengan anggun: JSON gagal → retry 1×; masih gagal → minta user tulis ulang dengan format bebas + contoh.
- Jangan pernah menaruh secret di kode; pakai `.env`.
- Bahasa semua output user-facing: Indonesia santai-sopan.
- Jika ragu antara menambah kompleksitas vs menjaga alur inti tetap sederhana → pilih sederhana (lihat §2).
