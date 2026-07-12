# JuruJahit 🧵

Asisten AI di Telegram yang bantu penjahit memutuskan **TERIMA / OPER / TOLAK** tiap order — berdasarkan kapasitas antrian riil, bukan perasaan.

> Sumber kebenaran spesifikasi ada di [`CLAUDE.md`](./CLAUDE.md). Filosofi inti: **LLM tidak boleh berhitung** — semua kalkulasi (kapasitas, tanggal, margin) deterministik di kode; LLM hanya ekstraksi teks, narasi, dan draft balasan.

## Jalankan lokal

```bash
cp .env.example .env      # isi token & key
npm install
# 1) buat skema DB di Supabase → paste isi src/db/migrations.sql ke SQL editor
npm run seed              # (opsional) data demo untuk dashboard
npm run dev               # start bot (long polling)
```

Test mesin kapasitas (wajib hijau sebelum dipakai):

```bash
npm test          # 58 test: penjadwalan packing per-jam, libur, deadline, margin, learning, parser harga
npm run typecheck
```

## Konfigurasi (`.env`)

| Var | Guna |
|---|---|
| `TELEGRAM_BOT_TOKEN` | dari @BotFather |
| `GEMINI_API_KEY` | Google Gemini API (free tier, ambil di https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | default `gemini-2.5-flash` (gratis) — `gemini-2.5-flash-lite` lebih hemat |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | backend (bypass RLS) |
| `SUPABASE_ANON_KEY` | dashboard read-only |
| `MARGIN_THRESHOLD_PCT` | ambang margin oper "layak" (default 20) |

## Dashboard

`dashboard/index.html` self-contained (tanpa framework/CDN — ramah koneksi terbatas). Buka dengan query param:

```
index.html?url=<SUPABASE_URL>&key=<ANON_KEY>&tailor=<TAILOR_UUID>
```

`npm run seed` mencetak `tailor` id-nya. Deploy ke Netlify/GitHub Pages; bot ke Railway/Render/VPS (long polling, tanpa webhook).

## Struktur

- `src/core/` — mesin deterministik **PURE** (`capacity`, `margin`, `verdict`, `pipeline`) + `test/`
- `src/llm/` — `extract` (teks→JSON, retry 1×), `narrate` (angka dari kode), `drafts` (3 skenario); prompt di `src/prompts/`
- `src/bot/` — handlers (wizard, forward, antrian, selesai, profil, callbacks), `messages.ts` (semua string), `keyboards.ts`
- `src/db/` — `migrations.sql`, `repo.ts`

## Status milestone (§11)

- **M0–M2** ✅ fondasi, skema, wizard, **mesin kapasitas + 58 unit test hijau**
- **M3–M5** ✅ ekstraksi + klarifikasi 1×, vonis 3 opsi + draft + update antrian, `/antrian` `/selesai` `/profil` (+ `/edit` `/riwayat` `/libur` `/dashboard`)
- **M6** ✅ dashboard live + seed demo (kalender, antrian, metrik, riwayat)
- **M7** deploy + uji penjahit asli + video — perlu kredensial nyata

## Catatan / deviasi terhadap spec

- **LLM Google Gemini (free tier)** menggantikan Claude API — model default `gemini-2.5-flash`, env-configurable (`GEMINI_MODEL`). "Thinking" dimatikan (`thinkingBudget: 0`) agar cepat & hemat kuota. Prompt di `src/prompts/` tak berubah; hanya `src/llm/client.ts` yang menyentuh SDK.
- **Dashboard tanpa Chart.js**: kalender heatmap & metrik pakai CSS grid murni → self-contained, nol dependensi eksternal, sejalan "tanpa framework berat" + "ramah koneksi terbatas".
- **Harga jual & upah oper ditanya saat setup** (`kebaya payet 3 hari, jual 500rb, upah rekan 150rb`) dan bisa diubah kapan saja: `/profil harga <jenis> jual 500rb upah 150rb`. Parser rupiah deterministik (`parseRupiah`/`extractPrices` di `src/util/parse.ts`, 14 test) — mengerti `500rb`, `1,5jt`, `500.000`, `Rp350rb`. Tanpa data ini opsi OPER jatuh ke `data_kurang` dan metrik dashboard bernilai 0, jadi bot mengingatkan di tempat. `quoted_price` per order tetap diambil dari chat pelanggan bila disebut (menimpa `base_price`).
- **State wizard/klarifikasi** dipersist ke `.data/sessions.json` (atomic write) — selamat dari restart/redeploy; single-process long-polling.
- **Penjadwalan packing per-jam** (melampaui FCFS harian §7): order kecil berbagi hari, order baru mengisi sisa jam & celah kapasitas. Lima order 2 jam = 1 hari, bukan 5.
- **Belajar dari realita** (`src/core/learning.ts`): saat `/selesai`, selisih tanggal selesai asli vs estimasi mengoreksi `hours_per_unit` (pemulusan 70/30, clamp anti-outlier, perubahan <5% diabaikan). Bot melaporkan tiap penyesuaian.

## Serah-terima / pasang untuk orang lain

Panduan pemakai (penjahit, non-teknis): [`PANDUAN.md`](./PANDUAN.md) — cetak/kirim itu saja.

Checklist operator (yang memasang):

1. **Bot Telegram baru** — @BotFather → `/newbot` → token ke `TELEGRAM_BOT_TOKEN`. Jangan pakai token bersama; satu instance = satu bot.
2. **Supabase baru** — buat project → SQL editor → paste `src/db/migrations.sql` → salin URL + service key + anon key ke `.env`.
3. **Gemini API key** — gratis di https://aistudio.google.com/apikey (kuota free tier cukup untuk 1 penjahit).
4. **Jalankan** — `npm install && npm test && npm run dev` (lokal). Deploy bot: push repo ke GitHub → railway.app → New Project → Deploy from GitHub repo → isi semua env dari `.env` (start command otomatis `npm start`; `tsx` sudah di dependencies). Pastikan filesystem bisa tulis `.data/` (Railway: tambah volume di `/app/.data`, atau relakan state wizard/libur hilang saat redeploy).
5. **Penjahit `/start`** — setup profil langsung dari HP-nya (lihat PANDUAN.md §1).
6. **Web (landing + dashboard per akun)** — `scripts/build-dashboard.sh <uuid-tailor-demo>` menghasilkan `dashboard/dist/` (landing = `index.html`, dashboard = `dashboard.html` dengan URL+anon key tertanam). Drag-drop folder `dist` ke Netlify (app.netlify.com → "Deploy manually") atau push ke GitHub Pages. Lalu set `DASHBOARD_BASE_URL=<url-situs>/dashboard.html` di env bot — perintah `/dashboard` tiap penjahit otomatis memakai URL itu. **Anon key hanya aman bila RLS aktif read-only** (sudah diaudit: policy select-only ✅).
7. **Jangan bagikan** `.env`, service key, atau `dashboard/dev.html` (berisi kredensial).
