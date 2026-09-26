# إعداد نظام الطالب وتسجيل الدخول بحساب Google

دليل خطوة بخطوة لتشغيل نظام الطالب في بيئة جديدة أو على الإنتاج.

> **الحالة:** الترجيلات جاهزة ومُختبَرة (128 تحقّقًا على PostgreSQL 17.5).
> يلزم فقط ضبط Google OAuth وضبط البيئة.

---

## 1) متغيّرات البيئة

### `apps/web/.env` (أضف إلى الموجود)

```bash
# مستخدمة أصلًا للمحتوى العام — لا جديد
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# جديد: يجب أن يطابق Site URL في Supabase (يُستخدم في redirectTo)
PUBLIC_SITE_URL=https://thanaya.dpdns.org
```

> **لا تضف `SUPABASE_SERVICE_ROLE_KEY` إلى `apps/web`.**
> لا يحتاجه: كل دوال الطالب تعمل بـ `anon key` + كوكي الجلسة.
> المفتاح مخصص لـ Edge Functions فقط (مثل `admin-invite`).

### `apps/admin/.env`

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_WEB_URL=https://thanaya.dpdns.org    # مطلوب لبثّ الإشعارات
```

---

## 2) تفعيل مزوّد Google

### 2.1) في Google Cloud Console

1. أنشئ مشروعًا (أو استخدم موجودًا).
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
3. النوع: **Web application**
4. **Authorized redirect URIs** — أضف:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
5. **Authorized domains** — أضف:
   ```
   thanaya.dpdns.org
   supabase.co
   ```
6. احفظ **Client ID** و **Client Secret**.

### 2.2) في Supabase Dashboard

1. **Authentication → Providers → Google**
2. فعّل المزوّد.
3. الصق **Client ID** و **Client Secret**.
4. فعّل **Skip nonce check** فقط إن ظهر خطأ nonce (نادر).

### 2.3) نطاقات إعادة التوجيه

**Authentication → URL Configuration → Redirect URLs** — أضف:

```
https://thanaya.dpdns.org/auth/callback
http://localhost:4321/auth/callback
```

> `localhost:4321` هو منفذ `npm run dev:web` (مضبوط في `apps/web/package.json`).

**Site URL**: `https://thanaya.dpdns.org`

---

## 3) تطبيق الترحيلات

```bash
# من جذر المستودع
supabase db push
# أو يدويًا عبر SQL Editor بالترتيب:
#   20261001000000_student_auth.sql
#   20261001000001_student_rls.sql
#   20261001000002_student_functions.sql
#   20261001000003_student_permissions.sql
#   20261001000004_backfill.sql
```

⚠️ **خذ نسخة احتياطية أولًا** — `20261001000004_backfill.sql` يعمل `UPDATE` على
`exam_questions` (يملأ `subject_id` و `fingerprint`).

### التحقق بعد التطبيق

```sql
-- 1) الجداول موجودة
SELECT count(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
  ('students','exam_attempts','attempt_answers','question_performance','student_subject_stats','rate_limits');
-- المتوقع: 6

-- 2) RLS مفعّل على الكل
SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity
  AND c.relname IN ('students','exam_attempts','attempt_answers',
                    'question_performance','student_subject_stats','rate_limits');
-- المتوقع: 0

-- 3) anon لا يملك شيئًا
SELECT count(*) FROM information_schema.role_table_grants
WHERE grantee='anon' AND table_name IN ('students','exam_attempts');
-- المتوقع: 0

-- 4) مفاتيح الصلاحيات موجودة وفي الكتالوج
SELECT key, label_ar FROM public.permissions
WHERE key LIKE 'students.%' OR key LIKE 'attempts.%' ORDER BY key;

-- 5) ولا مسرب في القوالب
SELECT count(*) FROM public.admin_role_presets
WHERE permission_key LIKE 'students.%' OR permission_key LIKE 'attempts.%';
-- المتوقع: 0   ← مهم جدًا
```

> **ملاحظة عن الفقرة 5:** الـ migration `20260920000000` يسند *كل* مفتاح في
> الكتالوج إلى قالب `admin` عدا مفتاحين. لذلك `20261001000003` **يحذف** أي
> تسرب صراحةً. إن رأيت أرقامًا غير صفرية بعد التطبيق، أعد تشغيل
> `20261001000003`.

---

## 4) منح صلاحيات البيانات

**افتراضيًا:** المدير العام (`super_admin`) فقط sees بيانات الطلبة — لأن
المفاتيح الأربعة خارج قوالب الأدوار عمدًا (بيانات شخصية: بريد + درجات).

### لمنح أدمن واحد صلاحية العرض فقط

**لوحة التحكم → الفريق والصلاحيات →** اختر العضو ← `students.view`

الخيارات المتاحة:

| المفتاح | ما يفتح |
|---|---|
| `students.view` | تبويب «الطلاب» + ملف كل طالب + قائمة أسئلته الخاطئة |
| `students.manage` | تعطيل/تنشيط الحساب، حذف بيانات الطالب (GDPR) |
| `attempts.view` | تبويب «الامتحانات والنتائج» + تفاصيل كل محاولة |
| `attempts.manage` | تعليم كاشتباه غش، حذف محاولة |

**الحصر (اختياري):** المفاتيح تدعم `scope`، فبإمكان منح `students.view`
بنطاق مادة واحدة: «طلاب الرياضيات فقط».

> `get_question_analytics` (تبويب «تحليل الأسئلة») متاح لكل أدمن عبر
> `analytics.view` من القالب — لأنه **تجميعي** (صعوبة السؤال) لا شخصي.

---

## 5) التشغيل

```bash
npm run dev:web     # http://localhost:4321
npm run dev:admin   # http://localhost:5173
```

### المسارات الجديدة في `apps/web`

| المسار | الحماية | الوصف |
|---|---|---|
| `/auth/login` | عامة | زر Google |
| `/auth/callback` | عامة | نقطة استقبال OAuth (endpoint) |
| `/api/auth/google` | عامة | يبدأ التدفق؛ `POST` = تسجيل خروج |
| `/account` | جلسة | لوحة الطالب |
| `/account/wrong-questions` | جلسة | الأسئلة الخاطئة ( paginated ) |
| `/review` | جلسة | إنشاء امتحان أخطاء |
| `/review/attempt/[id]` | جلسة | تشغيل محاولة الأخطاء |
| `/api/exams/start` | جلسة | بدء محاولة عادية |
| `/api/exams/attempt/answer` | جلسة | حفظ إجابة (يقبل `sendBeacon`) |
| `/api/exams/attempt/submit` | جلسة | ★ التصحيح الرسمي |
| `/api/exams/review/create` | جلسة | إنشاء امتحان أخطاء |

الحماية تُطبَّق في `apps/web/src/middleware.ts` عبر
`PROTECTED_PREFIXES = ['/account', '/review']` — أضف مسارًا محميًا جديدًا
يكفي سطر واحد في المصفوفة.

---

## 6) السلوك حسب حالة المستخدم

| الحالة | النتيجة في `/exams/[id]` | تُحفظ؟ | تصحيح |
|---|---|---|---|
| **زائر** | مفتاح الإجابة في HTML (سلوك قديم) | ❌ | في المتصفح |
| **طالب مسجّل** | **بلا** مفتاح إجابة في HTML | ✅ | **على السيرفر** |

هذا مقصود: الزائر يستطيع تجربة المنصة بلا احتكاك، والطالب يحصل على
تصحيح لا يمكن التلاعب به.

> **لجعل التسجيل إلزاميًا** (يلغي وضع الزائر كليًا): احذف فرع
> `isSignedIn` في `apps/web/src/pages/exams/[id].astro` واجعل
> `/exams/[id]` محميًا في `middleware.ts`. غير مستحسَن — يكسر التحويل.

---

## 7) «امتحان الأخطاء» — كيف يعمل

```
امتحان عادي يُسلَّم
        ↓
submit_exam_attempt (سيرفر) يصحّح ويسجّل في question_performance
        ↓
question_performance: times_wrong / times_correct / consecutive_wrong / is_mastered
        ↓
/review: يختار Server الأسئلة غير المتقنة في المادة، بترجيح:
   times_wrong × (1 + consecutive_wrong×0.4) × decay(آخر خطأ)
        ↓
create_review_exam → attempt جديد (mode='review', exam_id=NULL)
```

**إتقان السؤال = إجابتان صحيحتان** → `is_mastered = true` → يخرج نهائيًا
من مرشحي الأخطاء. إجابة صحيحة واحدة لا تكفي.

**حدود العدد** (قابلة للضبط من `system_settings`):

| المفتاح | الافتراضي |
|---|---|
| `student_review_min_questions` | 5 |
| `student_review_max_questions` | 30 |
| `student_review_default_questions` | 10 |

**حدود المعدّل:** 30 إنشاء امتحان أخطاء/ساعة لكل طالب، و30 تسليم/10 دقائق.
عند تجاوزها يُرجع `429` برسالة عربية.

---

## 8) الأمان — ملخص ما يفرضه الخادم

| الطبقة | الإجراء |
|---|---|
| HTML | لا `correct_index` ولا `explanation` في حمولة `start_exam_attempt` |
| التصحيح | كله في `submit_exam_attempt` (SQL) — المتصفح لا يصحّح للطالب المسجّل |
| نزاهة | `answer_token` = SHA-256 على (المحاولة + قائمة الأسئلة + مفاتيحها) — تجزئة **واحدة** لكل المحاولة (لو وُزّعت لكل سؤال لَكُشفت الإجابات بـ 4 محاولات لكل هاش) |
| الكتابة | `authenticated` = قراءة فقط على كل جداول الطالب؛ كل الكتابة عبر RPCs |
| RLS | كل جدول عليه RLS؛ `anon` بلا أي صلاحية |
| CSRF | كل endpoints تتحقق من `Origin` + كوكيز `SameSite=Lax` |
| الكوكيز | `httpOnly` + `Secure` في الإنتاج |
| التسريب المؤقت | استعادة جلسة منتهية → أجّل الطالب،  |

### تدقيق سريع بعد النشر

```sql
-- 0) لا جدول بلا RLS
SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;
-- المتوقع: 0

-- 1) anon لا يقرأ شيئًا من جداول الطلبة
SELECT count(*) FROM information_schema.role_table_grants
WHERE grantee='anon' AND table_schema='public' AND table_name IN
  ('students','exam_attempts','attempt_answers','question_performance','student_subject_stats','rate_limits');
-- المتوقع: 0

-- 2) لا دالة private قابلة للتنفيذ من anon
SELECT count(*) FROM information_schema.role_routine_grants
WHERE grantee='anon' AND routine_schema='private';
-- المتوقع: 0
```

---

## 9) GDPR

| الإجراء | من |
|---|---|
| الطالب يحذف ملفه | `delete_my_account()` — غير مربوط بواجهة بعد (v2) |
| الإدارة تحذف بيانات طالب | **الطلاب ← ملف الطالب ← «حذف كل بيانات الطالب»** |
| الإدارة تحذف محاولة واحدة | **الامتحانات ← تفاصيل ← «حذف المحاولة»** (يُعيد حساب الإحصاءات) |

حذف المحاولة **إعادة حساب** لـ `question_performance` و
`student_subject_stats` على الخادم — فلا تبقى أرقام متقنة يتيمة
(مغطّى باختبار `I3c`).

---

## 10) اختبارات

```bash
# نظام الطالب (128 تحقّقًا)
supabase/tests/students/run.sh "postgresql://postgres:postgres@127.0.0.1:5432/postgres"

# RBAC القائم
supabase/tests/rbac/run.sh "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
```

> ⚠️ **قاعدة الاختبار يجب أن تكون UTF-8.** السكربت ينشئها بـ
> `LC_COLLATE 'C.UTF-8'` لأن تطبيع النص العربي يعتمد على character classes
> التي لا تعمل في `SQL_ASCII`.
>
x — يحذف ويعيد بناء `thanaya_students_test`.

### حالة مجموعة `rbac` (ملاحظة)

تفشل حاليًا 5 سيناريوهات: `02`، `03`، `04`، `05`، `06`.
**تحقّقنا أنها تفشل قبل ترحيلات نظام الطالب أيضًا** (شُغِّلت على قاعدة فيها
ترحيلات `202609*` فقط فحدثت نفس الإخفاقات). السبب الأرجح: سيناريوهات
`02/03/05` كُتبت لدلالات migration ⑥، بينما migration ⑦ جعل الكتابة
المباشرة للمدير العام فقط. **لم نلمسها** — تحتاج مراجعة منفصلة.
