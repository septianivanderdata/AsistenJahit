// Muat & validasi env sekali di sini. Jangan taruh secret di kode.
import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env ${name} wajib diisi (lihat .env.example)`);
  return v;
}

function opt(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  telegramToken: req('TELEGRAM_BOT_TOKEN'),
  geminiKey: req('GEMINI_API_KEY'),
  geminiModel: opt('GEMINI_MODEL', 'gemini-3.5-flash'),
  supabaseUrl: req('SUPABASE_URL'),
  supabaseServiceKey: req('SUPABASE_SERVICE_KEY'),
  supabaseAnonKey: opt('SUPABASE_ANON_KEY', ''),
  dashboardToken: opt('DASHBOARD_TOKEN', ''),
  dashboardBaseUrl: opt('DASHBOARD_BASE_URL', 'http://127.0.0.1:5173/index.html'),
  marginThresholdPct: Number(opt('MARGIN_THRESHOLD_PCT', '20')),
  tz: opt('TZ', 'Asia/Jakarta'),
};

/** Tanggal hari ini di zona Asia/Jakarta sebagai ISO "YYYY-MM-DD". */
export function todayISO(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // en-CA → YYYY-MM-DD
}
