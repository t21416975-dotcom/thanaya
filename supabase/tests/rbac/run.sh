#!/usr/bin/env bash
# ============================================================================
# تشغيل ترحيلات منصة ثنايا + سيناريوهات الصلاحيات المحدودة على قاعدة نظيفة.
#
# الاستخدام (ينصح بقاعدة مؤقتة، فلا تُشغّله على قاعدة إنتاج):
#   ./run.sh "postgresql://postgres:postgres@127.0.0.1:55432/postgres"
#   DATABASE_URL="postgresql://..." ./run.sh
#
# ما يفعله:
#   1) يحاكي بيئة Supabase محليًا (أدوار anon/authenticated/service_role + auth.uid()).
#   2) يشغّل كل ملفات supabase/migrations بالترتيب.
#   3) يشغّل سيناريوهات الاختبار (كل فشل يوقف السكربت برسالة FAIL).
# ============================================================================
set -euo pipefail

DB_URL="${1:-${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/postgres}}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TESTS="$ROOT/supabase/tests/rbac"

echo "▶ قاعدة الهدف: $DB_URL"
PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -q)

echo "▶ 1/3 تهيئة بيئة Supabase (أدوار + auth.uid)"
"${PSQL[@]}" -f "$TESTS/00_bootstrap.sql"

echo "▶ 2/3 تشغيل الترحيلات"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "    - $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "▶ 3/3 سيناريوهات الصلاحيات"
for f in "$TESTS"/0[1-5]_*.sql; do
  echo "    - $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "✅ نجحت كل السيناريوهات (لا FAIL)"
