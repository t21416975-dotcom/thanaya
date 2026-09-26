#!/usr/bin/env bash
# ============================================================================
# تشغيل ترحيلات منصة ثنايا + سيناريوهات نظام الطالب على قاعدة نظيفة.
#
# الاستخدام (قاعدة UTF-8 مطلوبة لأن تطبيع النص العربي يعتمد على
# character classes التي لا تعمل في قواعد SQL_ASCII):
#   ./run.sh "postgresql://postgres:postgres@127.0.0.1:55432/postgres"
#   DATABASE_URL="postgresql://..." ./run.sh
#
# تحذير: لا تُشغّله على قاعدة إنتاج — السكربت يحذف.Schema ويعيد البناء.
#
# ما يفعله:
#   1) ينشئ قاعدة UTF-8 نظيفة باسم thanaya_students_test.
#   2) يحاكي بيئة Supabase (أدوار anon/authenticated/service_role + auth.uid()
#      + auth.users + auth.identities لمزوّد Google).
#   3) يشغّل كل ملفات supabase/migrations بالترتيب.
#   4) يشغّل سيناريوهات الطالب (كل فشل يوقف السكربت برسالة FAIL).
# ============================================================================
set -euo pipefail

ADMIN_URL="${1:-${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/postgres}}"
DB_NAME="thanaya_students_test"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TESTS="$ROOT/supabase/tests/students"

echo "▶ خادم Postgres: $ADMIN_URL"
PSQL=(psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -X)

echo "▶ 1/5 إعادة بناء قاعدة نظيفة بترميز UTF-8"
"${PSQL[@]}" -c "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE);"
"${PSQL[@]}" -c "CREATE DATABASE $DB_NAME ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8';"

DB_URL="${ADMIN_URL%/*}/$DB_NAME"
echo "▶ قاعدة الاختبار: $DB_URL"
TPSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -q -X)

echo "▶ 2/5 تهيئة بيئة Supabase (أدوار + auth.uid + auth.identities)"
"${TPSQL[@]}" -f "$TESTS/00_bootstrap.sql"

echo "▶ 3/5 تشغيل الترحيلات"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "    - $(basename "$f")"
  "${TPSQL[@]}" -f "$f"
done

echo "▶ 4/5 تثبيت بيانات الاختبار"
"${TPSQL[@]}" -f "$TESTS/01_fixtures.sql"

echo "▶ 5/5 سيناريوهات الطالب"
for f in "$TESTS"/0[2-9]_*.sql "$TESTS"/10_*.sql; do
  echo "    - $(basename "$f")"
  "${TPSQL[@]}" -f "$f"
done

echo ""
echo "✅ نجحت كل سيناريوهات الطالب (لا FAIL)"
