#!/usr/bin/env bash
# Build folder siap-deploy untuk Netlify/GitHub Pages → dashboard/dist/
#   index.html     = landing page (link demo menunjuk tailor demo)
#   dashboard.html = dashboard (URL+anon key ditanam; ?tailor= per akun)
# Pakai: scripts/build-dashboard.sh [DEMO_TAILOR_ID]
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; source .env; set +a
DEMO_TAILOR_ID="${1:-${DEMO_TAILOR_ID:-}}"
if [ -z "$DEMO_TAILOR_ID" ]; then
  echo "Peringatan: DEMO_TAILOR_ID kosong — link demo di landing tak akan jalan." >&2
  echo "  Pakai: scripts/build-dashboard.sh <uuid-tailor-demo>" >&2
fi

mkdir -p dashboard/dist

sed "s|DEMO_TAILOR_ID|${DEMO_TAILOR_ID}|" dashboard/landing.html > dashboard/dist/index.html

sed -e "s|__SUPABASE_URL__|${SUPABASE_URL}|" \
    -e "s|__SUPABASE_ANON_KEY__|${SUPABASE_ANON_KEY}|" \
    dashboard/index.html > dashboard/dist/dashboard.html

echo "OK → dashboard/dist/ (index.html + dashboard.html)"
echo "Setelah deploy, set DASHBOARD_BASE_URL=<url-situs>/dashboard.html di env bot."
