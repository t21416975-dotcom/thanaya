# خطة: تسجيل دخول جوجل + حفظ بيانات الطلاب والامتحانات + "امتحان الأخطاء" الذكي

> **الحالة:** تخطيط فقط — لم يتم تعديل أي سطر كود.
> **النطاق:** `apps/web` (Astro SSR) · `apps/admin` (React SPA) · `packages/types` · `supabase/migrations` + `supabase/functions`
> **المرجع:** يتبع أسلوب `admin-permissions-plan.md` و `geo-audit-plan.md` (مخطط تفصيلي +hlcPhaseed plan)
> **لغة الواجهة:** عربية / RTL — كل النصوص والتسميات нов�� بالعربية.

---

## 0. TL;DR

| المحور | الوضع الحالي | بعد التنفيذ |
|---|---|---|
| تسجيل دخول الطلاب | **غير موجود نهائياً** — `apps/web/src/lib/supabase.ts:19` يضبط `persistSession: false` | Google OAuth + Email عبر `@supabase/ssr` + كوكي `sb-access-token` |
| حساب الطالب في القاعدة | **لا يوجد** — لا `students` ولا `profiles` | `students` مرتبط بـ `auth.users` + صف `admins` عند الترقية |
| محاولة الامتحان | **لا تُحفظ** — الحالة في `sessionStorage` فقط (`exams/[id].astro:331-378`) | `exam_attempts` + `attempt_answers` في Supabase |
| تصحيح الامتحان | **كله في المتصفح** ومفتاح الإجابات مكشوف في HTML (`exams/[id].astro:20`) | تصحيح **على السيرفر** عبر `SECURITY DEFINER` RPC +-row-level security |
| "امتحان الأخطاء" | غير موجود | `question_performance` + RPC `create_review_exam()` |
| الطلاب في لوحة التحكم | غير موجود (12 تبويب كلها محتوى) | تبويبان: `students` + `attempts` + تقارير في `analytics` |
| الصلاحيات | 22 مفتاح RBAC ناضجة | +4 مفاتيح جديدة في نفس النظام (`students.*`, `attempts.view`) |

**الأهم أمنياً:** إجابة امتحان يجب أن تُحسب في Postgres. المفتاح الحالي في الـ HTML يعني أن أي طالب يقدر يفتح View Source ويعرف الإجابات — وهذا ينهار تماماً مع "امتحان الأخطاء" لأن الطالب سيعرف لماذا أخطأ.

---

## 1. تحليل الحالة الراهنة (أدلة من الكود)

### 1.1 لا يوجد مصادقة في `apps/web`

- `apps/web/src/lib/supabase.ts:19-23` — `persistSession: false, autoRefreshToken: false, detectSessionInUrl: false`.
  الـ client الوحيد في السيرفر **بلا جلسة**، مصمم لاستعلامات المحتوى العام فقط.
- `apps/web/src/middleware.ts` — يضيف هيدرز أمان فقط، **لا يفحص `context.cookies` ولا يحمي أي مسار**.
- `apps/web/src/pages/exams/[id].astro:20` — كامل مصفوفة الأسئلة بما فيها `correct_option_index` و `explanation` تُحقن في
  `<script type="application/json" id="exam-data">`.
- `apps/web/src/pages/exams/[id].astro:567-717` — `submitExam()` يحسب النتيجة بمقارنة `userAnswers[idx] === q.correct_option_index` في المتصفح، **ولا يوجد أي `fetch` عند التسليم**.

**النتيجة:** لا يمكن معرفة من答题، ولا ماذا أخطأ، ولا كم مرة رسب — لا شيء يُحفظ.

### 1.2 لا يوجد نموذج بيانات للطالب

grep على كامل `supabase/migrations` و `packages/types/src/database.ts`:
`students` ❌ · `profiles` ❌ · `attempts` ❌ · `answers` ❌ · `results` ❌ · `scores` ❌ · `question bank مستقل` ❌.

الأسئلة تعيش فقط داخل `exam_questions` مرتبطة بـ `exam_id` واحد — **لا يوجد بنك أسئلة عام** يمكن البناء عليه.

### 1.3 البنية التحتية RBAC جاهزة وقابلة لإعادة الاستخدام ✅

هذه أقوى نقطة في المشروع — نظام الصلاحيات مبني في Postgres أصلاً:

- مخطط `private` غير مكشوف + دوال `SECURITY DEFINER` بـ `search_path=''` (migration ⑥).
- 22 مفتاح في `permissions` + `admin_role_presets` + `admin_permissions` مع `effect: allow|deny` و `scope_type` ستيني.
- `get_my_permissions()` RPC جاهز للاستعمال من أي واجهة.
- نظام موافقات `change_requests` يعمل بالكامل عبر RPCs (لا كتابة مباشرة).
- `supabase/tests/rbac/run.sh` — 7 ملفات SQL اختبار حقيقية تعمل على PostgreSQL حقيقي. **سنضيف لها ملفات اختبار جديدة بنفس النمط.**

**قرار معماري:** نظام الطلاب **لا يلمس** `admins` ولا `private.*` ولا `admins.role`. الطالب =
`auth.users` + صف في `students`. الترقية إلى أدمن = صف في `admins` (يطلبه super_admin) — مساران منفصلان تماماً.

### 1.4 ر Inheritance خطير يجب معالجته

`20260926000000_revoke_anon_select.sql:4`:
```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;
```
أي **كل جدول جديد** لا يُمنح لـ `anon` تلقائياً — ممتاز. لكن هذا يعني أن كل GRANT مطلوب لـ
`students` / `exam_attempts` / `attempt_answers` / `question_performance` يجب أن يكون **صريحاً ومكتوباً يدوياً** في الميجريشن.

### 1.5 نمط مصادقة جاهز للنقل

`apps/web/src/pages/api/push-send.ts:50-71` — دالة `isAuthorizedAdmin()`:
`Authorization: Bearer` → `supabase.auth.getUser()` → `rpc('get_my_permissions')` → فحص.
هذا بالضبط النمط الذي سنعممه في مسارات API الجديدة، لكن **أقوى**: سنقرأ من كوكي `sb-access-token` عبر
`@supabase/ssr` (`createServerClient`) بدل bearer header من العميل.

### 1.6 thrombosis لوحات التحكم

`apps/admin/src/App.tsx:24-99` — 12 تبويب في `useState<TabId>`، كل تبويب له `perm` و `superOnly`.
إضافة تبويب جديد = **سطر في مصفوفة `NAV`** + ملف component + مفتاح في `api/`. لا router ولا مسارات جديدة.

---

## 2. القرارات المعمارية (قرارات قبل التنفيذ)

### 2.1 ✅ كيف نحافظ على كود الامتحان الحالي؟

الصفحة `exams/[id].astro` (743 سطر) هي cœur المنتج. **لا نعيد كتابتها.** strategy:

```
المرحلة 1 (تشغيلي، تغيير سلوك فقط):
  exam_questions + correct_option_index  ← كما هي
  exam_attempts ينشأ عند الضغط على "ابدأ"
  attempt_answers يُحفظ (upsert) كل 10 إجابات أو عند تغيير السؤال
  عند التسليم: POST /api/exams/[id]/submit
    → السيرفر يحسب النتيجة (RPC grade_attempt)
    → RPC يسجّل question_performance
    → RPC grade_attempt يعيد النتيجة + التصحيح
  الواجهة: تُمرر questions بلا correct_option_index/explanation (stripe)
 結果 phase تُصيّر من استجابة السيرفر لا من المتصفح
  الوضع القديم (زائر بدون تسجيل دخول) يبقى يعمل 100% client-side
```

**النتيجة:** زائر مجهول يرى نفس التجربة الحالية بالضبط. طالب مسجّل يحصل على حفظ كامل + تصحيح سيرفري.
كود واحد يخدم الحالتين عبر分支 واحد (conditional fetch) في دالة التسليم.

### 2.2 ✅ بنك الأسئلة: Denormalize بدل Refactor

**الخيار A (مُرشَّح):** `exam_questions.subject_id` (denormalized، يُملأ بـ trigger من `exams.subject_id`)
+ `question_performance` (جدول إحصاء).

**الخيار B:** استخراج جدول `questions` مستقل وربط `exam_questions.question_id` — أنظف نظرياً لكنه
يكسر كل الكود الحالي (`exams.ts:105` bulk insert، `ExamCreator.tsx` 936 سطر، `geo.ts` buildQuizSchema).
**مرفوض في المرحلة الأولى.**

الخيار A يسمح بإعادة استخدام سؤال عبر امتحانات مختلفة لاحقاً عبر `question_performance` المفتاح
`(question_id, student_id)` — ولماذا لا نخزن `question_fingerprint` (hash نصي للسؤال)؟ نعم — نضيفه:
يسمح بكشف التكرار وكشف ورود نفس السؤال في امتحان آخر لاحقاً.

### 2.3 ✅ Google OAuth: Supabase ولا ن reinvent

- `signInWithOAuth({ provider: 'google', options: { redirectTo } })` — Supabase يتولى البروتوكول.
- **لا نخزّن أي Google token عندنا.** `auth.users.identities` يحتفظ بالربط.
- `students.oauth_provider = 'google' | 'email'` + `students.oauth_avatar_url`.
- **السماح بالبريد غير الموثّق (unverified)**: طالب في مصر قد gmail بدون توثيق. الموثّق = حساب أكاديمي.
  القرار: نسمح，但不 نستخدم `is_email_confirmed` كشرط، ونخزّن `students.email_verified` للعرض.

### 2.4 ✅ جلسة Astro: `@supabase/ssr` (حزمة جديدة واحدة)

الحزمة `auth` الأصلية في المتصفح تستخدم localStorage — لا يصل للكوكي في SSR.
`@supabase/ssr` هو الحل الرسمي، يقرأ/يكتب كوكيز على `Astro.locals`، ويجعل `getUser()` على السيرفر
أماناً (يتحقق من التوقيع + revalidates عبر Auth API).

**مفتاح جديد في `.env.example`:**
```
SUPABASE_SERVICE_ROLE_KEY=...   # مطلوب فقط في Edge Functions، لا يُستخدم أبداً في apps/web
```

### 2.5 ✅ защита من إساءة الاستخدام (Cheating)

تسليم الامتحان في `exams/[id].astro` يتم من المتصفح — أي طالب يستطيع نداء `submit` بإجابات صحيحة
مسروقة. الحماية:

1. **تصحيح سيرفري** — الإجابة الصحيحة لا تغادر Postgres.
2. **`answer_hash`** في `attempt_answers` = HMAC من `question_id + student_id + correct_index`
   بمفتاح في السيرفر. عند التسليم نتحقق أن كل إجابة مُرسلة تطابق الهاش المتوقع.
3. **rate limit** على `submit_attempt` (حد N محاولات في الدقيقة عبر جدول `rate_limits`).
4. **questionPerformance لا يُحدَّث إلا عند التسليم الناجح** — لا من الـ client.

### 2.6 ⚠️ قرارات تحتاج موافقتك قبل التنفيذ

| # | السؤال | الخيار A | الخيار B | توصياتي |
|---|---|---|---|---|
| Q1 | هل الامتحان يتطلّب تسجيل دخول؟ | إلزامي | اختياري (وضع زائر) | **B** — يحوّل الـ traffic الحالي إلى DB ويكسر conversion |
| Q2 | إظهار الإجابات بعد التسليم؟ | دائماً | حسب صلاحية/إعداد | **B** مع开关 في `system_settings` |
| Q3 | هل الطالب يمكنه رؤية أخطاؤه السابقة؟ | نعم | لا | **B** — نحتاجهم أصلاً لـ "امتحان الأخطاء" |
| Q4 | في "امتحان الأخطاء" ما نص الأسئلة الغلط؟ | كل الأسئلة | 100% | قابل للاختيار (نص/كل) |
| Q5 | هل الأسئلة الغلط محفوظة بوقت؟ | دائم | تختفي بعد X محاولة ناجحة | **دائم** + scientist "أُتقنت" بعد إجابتين صحيحتين |
| Q6 | bank إنشاء حساب طالب من الأدمن يدوياً؟ | لا | نعم | **لا** — فقط تسجيل دخول ذاتي |

---

## 3. نموذج البيانات (Schema)

### 3.1 `students` — حساب الطالب

```sql
-- الميجريشن: 20261001000000_student_auth.sql
CREATE TABLE IF NOT EXISTS public.students (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id        UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT UNIQUE NOT NULL,
  full_name           TEXT,
  avatar_url          TEXT,
  grade               TEXT,                  -- 'third' | 'second' | 'first' | null
  phone               TEXT,
  oauth_provider      TEXT NOT NULL DEFAULT 'google',
  email_verified      BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,   -- kill switch (يبقى v3, §11)
  preferred_locale    TEXT NOT NULL DEFAULT 'ar',
  total_exams_taken   INTEGER NOT NULL DEFAULT 0,
  total_questions     INTEGER NOT NULL DEFAULT 0,
  total_correct       INTEGER NOT NULL DEFAULT 0,
  total_wrong         INTEGER NOT NULL DEFAULT 0,
  last_seen_at        TIMESTAMPTZ,
  last_login_provider TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX students_auth_user_id_key ON public.students(auth_user_id);
CREATE INDEX students_email_lower_idx ON public.students (lower(email));
CREATE INDEX students_active_idx ON public.students(is_active) WHERE is_active;
```

**لماذا `auth_user_id` وليس `id` = auth.users.id؟** لأننا نحتاج بيانات وصفية (اسم، صورة) و RLS
`students.id = auth.uid()` أبسط للطلاء. لكن في RLS سنستخدم `auth_user_id = auth.uid()`.

**فكّر في:** `total_*` أعمدة cache — denormalized للوحة التحكم. تُحدَّث بـ trigger على
`submit_attempt`. تحقّق: `total_correct / total_questions` يساوي `overall_accuracy` من attempts
(فيRecompute كامل شهرياً أو via cron).

### 3.2 `exam_attempts` — محاولة امتحان

```sql
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id           UUID REFERENCES public.exams(id) ON DELETE SET NULL,  -- NULL للتوليد من الأخطاء
  mode              TEXT NOT NULL DEFAULT 'exam'
                      CHECK (mode IN ('exam','review','mock')),          -- review = امتحان أخطائي
  subject_id        UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  source_attempt_id UUID REFERENCES public.exam_attempts(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress','submitted','abandoned','expired')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ,             -- started_at + time_limit
  submitted_at      TIMESTAMPTZ,
  time_spent_seconds   INTEGER NOT NULL DEFAULT 0,
  total_questions      INTEGER NOT NULL DEFAULT 0,
  answered_count       INTEGER NOT NULL DEFAULT 0,
  correct_count        INTEGER NOT NULL DEFAULT 0,
  wrong_count          INTEGER NOT NULL DEFAULT 0,
  blank_count          INTEGER NOT NULL DEFAULT 0,
  score_percentage     NUMERIC(5,2),          -- يُملأ عند التسليم
  ip_address        INET,
  user_agent        TEXT,
  -- ربط المجهر
  question_set      JSONB,                   -- snapshot بمعرّفات الأسئلة لو offline
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exam_attempts_subject_mode_ck CHECK (subject_id IS NOT NULL)
);

CREATE INDEX exam_attempts_student_started_idx ON public.exam_attempts(student_id, started_at DESC);
CREATE INDEX exam_attempts_subject_started_idx ON public.exam_attempts(subject_id, started_at DESC);
CREATE INDEX exam_attempts_exam_idx ON public.exam_attempts(exam_id) WHERE exam_id IS NOT NULL;
CREATE INDEX exam_attempts_review_idx ON public.exam_attempts(source_attempt_id) WHERE mode = 'review';
CREATE INDEX exam_attempts_pending_idx  ON public.exam_attempts(status, expires_at)
                                      WHERE status = 'in_progress';
```

**قرار: `exam_id` nullable + `mode='review'`.** "امتحان الأخطاء" ليس `exams` row — هو `exam_attempts`
يرث `subject_id` من جدار الأخطاء ولا يرث من `exam`. هذا يحافظ على `exams` بمعناها "امتحان ثابت معروف
لكل الطلاب" ولا نضطر لإنشاء exam rows ديناميكياً (وإلا ينهار `buildQuizSchema` في geo.ts و SEO).

### 3.3 `attempt_answers` — إجابة واحدة

```sql
CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id         UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id        UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  selected_index     SMALLINT CHECK (selected_index >= 0 AND selected_index <= 3),
  is_correct         BOOLEAN,
  is_blank           BOOLEAN NOT NULL DEFAULT true,
  answer_hash        TEXT,        -- HMAC للتحقق من نزاهة الإجابة (§2.5)
  answered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_taken_seconds INTEGER,
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX attempt_answers_question_idx ON public.attempt_answers(question_id);
CREATE INDEX attempt_answers_correct_idx  ON public.attempt_answers(question_id) WHERE is_correct = false;
```

**قرار: `answer_hash`** — يُحسب في السيرفر ويُرسل للـ client كـ opaque token مع كل سؤال. عند التسليم
نتحقق أن `answer_hash` المُرسل يطابق المحسوب → يمنع تخمين إجابة صحيحة من question_id.

### 3.4 `question_performance` — إحصاء إجابة (مفتاح "امتحان الأخطاء")

هذا هو **الجدول الأهم في المشروع** — هو ما يجعل "امتحان الأخطاء" ممكناً.

```sql
CREATE TABLE IF NOT EXISTS public.question_performance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  question_id       UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  subject_id        UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  exam_id           UUID REFERENCES public.exams(id) ON DELETE SET NULL,  -- آخر مصدر

  times_seen        SMALLINT NOT NULL DEFAULT 0,
  times_correct     SMALLINT NOT NULL DEFAULT 0,
  times_wrong       SMALLINT NOT NULL DEFAULT 0,
  consecutive_wrong SMALLINT NOT NULL DEFAULT 0,
  last_wrong_at     TIMESTAMPTZ,
  last_seen_at      TIMESTAMPTZ,
  is_mastered       BOOLEAN NOT NULL DEFAULT false,     -- times_correct >= 2
  mastery_confidence NUMERIC(4,3) NOT NULL DEFAULT 0,     -- العحسب (انظر §6.2)
  difficulty_ratio  NUMERIC(4,3) GENERATED ALWAYS AS
                    (times_wrong::NUMERIC / NULLIF(times_seen, 0)) STORED,

  first_attempted_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, question_id)
);

CREATE INDEX question_perf_wrong_idx
  ON public.question_performance (student_id, subject_id, last_wrong_at DESC NULLS LAST)
  WHERE is_mastered = false;
CREATE INDEX question_perf_mastered_idx
  ON public.question_performance (student_id, subject_id) WHERE is_mastered = true;
CREATE INDEX question_perf_hot_idx
  ON public.question_performance (subject_id, times_wrong DESC);   -- "أصعب الأسئلة" للإدارة
```

**هذا الجدول يجيب على ثلاثة أسئلة مختلفة:**
1. "ما الأسئلة التي أخطأت فيها؟" → `WHERE is_mastered=false AND times_wrong>0`
2. "ما أضعف مادتي؟" → `GROUP BY subject_id` مع `SUM(times_wrong)/SUM(times_seen)`
3. "ما أصعب سؤال في المنصة؟" → الإحصاء الكلي `question_perf_hot_idx` (للإدارة)

### 3.5 (اختياري) `student_subject_stats` — تجميع سريع

```sql
CREATE TABLE IF NOT EXISTS public.student_subject_stats (
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  attempts_count  INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  total_correct   INTEGER NOT NULL DEFAULT 0,
  avg_score       NUMERIC(5,2),
  best_score      NUMERIC(5,2),
  last_attempt_at TIMESTAMPTZ,
  wrong_questions_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, subject_id)
);
```
يُملى بـ trigger بعد كل `submit_attempt`. يجعل صفحة "ملفي" والـ dashboard استعلامين بسيطين
بدل `SUM` على آلاف الصفوف. يمكن تأجيله لـ v2.

### 3.6 (اختياري) `rate_limits`

جدول بسيط للحماية من الإساءة:
```sql
CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket      TEXT PRIMARY KEY,     -- md5(action + identifier)
  hits        INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
أو أبسط — نُبقي عدّاد في الذاكرة على السيرفر (Vercel lambda غير مشترك، غير موثوق) → **الجدول هو الخيار الصحيح**.

### 3.7 تغيير على `exam_questions` (denormalize — §2.2)

```sql
ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS times_attempted INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_correct INTEGER NOT NULL DEFAULT 0;

-- trigger: مزامنة subject_id من exams
CREATE OR REPLACE FUNCTION private.sync_question_subject() RETURNS trigger ...
  -- BEFORE INSERT OR UPDATE ON exam_questions
  -- NEW.subject_id := (SELECT subject_id FROM exams WHERE id = NEW.exam_id);

-- fingerprint: تطبيع النص العربي ثم hash — لكشف التكرار
CREATE OR REPLACE FUNCTION private.set_question_fingerprint() RETURNS trigger ...
  -- NEW.fingerprint := encode(sha256(convert_to(public.normalize_question_text(NEW.question_text), 'utf8')), 'hex');
```

### 3.8 خريطة العلاقات

```
auth.users (1:1) ──> students (1) ──> exam_attempts (N) ──> attempt_answers (N)
                          │                                    │
                          │                                    └──> exam_questions ──> exams ──> subjects
                          │                                                             
                          └──> question_performance (N) ──> exam_questions (1)
                                                                        │
                                                                        └──> subject_id (denormalized)

subjects (1) ──> student_subject_stats (N) ──> students (1)
```

---

## 4. RLS — القاعدة是真 (هيكل مفصّل، يُكتب في الميجريشن)

### 4.1 المبادئ (مطابقة لـ migration ⑥/⑦)

1. **لاClient-side trust** — كل القراءة/الكتابة عبر RLS، و `EXPLAIN` على كل policy.
2. **`REVOKE ALL ... FROM anon`** على كل جدول طالب + **`GRANT` صريح فقط لـ `authenticated`**
   (تذكير: `ALTER DEFAULT PRIVILEGES` الآن يمنع SELECT التلقائي لـ anon).
3. **دوال `SECURITY DEFINER` بـ `search_path=''`** في مخطط `private`، ونسخة عامة محدودة الصلاحيات.
4. **الطلبة لا يكتبون في `exams`/`exam_questions` إطلاقاً** — فقط `attempt_answers` و`exam_attempts`
   لنفسهم، عبر RPCs.
5. **`question_performance` يُكتب فقط من `private.record_submission()`** — لا من الـ client.

### 4.2 جدول السياسات

| الجدول | anon | authenticated (الطالب) | authenticated (staff) |
|---|---|---|---|
| `students` | ❌ لا شيء | `SELECT` لنفسه + `UPDATE` لنفسه (بـ `WITH CHECK` يمنع تعديل `is_active`, `total_*`) | `students.view` (بـ scope) / `students.manage` (إدارة) |
| `exam_attempts` | ❌ | `SELECT` لـ `student_id = auth.uid()` · `INSERT` لنفسه · `UPDATE` لحقول محدودة | `attempts.view` (عام) · `attempts.manage` |
| `attempt_answers` | ❌ | `SELECT` لِما يخصه · `INSERT/UPDATE` لِما يخصه | `attempts.view` |
| `question_performance` | ❌ | `SELECT` لنفسه فقط | `attempts.view` / `analytics.view` (مجمّع) |
| `student_subject_stats` | ❌ | `SELECT` لنفسه | `attempts.view` |
| `rate_limits` | ❌ | ❌ (RPC فقط) | ❌ |

**نقطة أمان حرجة — `students` UPDATE:** لو سمحنا للطالب `UPDATE students SET ...` على صفه مباشرة،
يكتب `total_correct = 99999`. الحل:
- RPC `update_own_profile(p_full_name, p_phone, p_grade, p_avatar_url, p_locale)` —
  قائمة بيضاء صريحة للحقول (5 حقول). **لا يُمنح UPDATE عام على students للطالب إطلاقاً.**
- العمود `is_active` يبقى خارج القائمة البيضاء (kill switch من الإدارة).

### 4.3 الدوال (RPCs)

| الدالة | SECURITY | الصلاحية | الوظيفة |
|---|---|---|---|
| `private.resolve_student_id()` | DEFINER, STABLE | `authenticated` | `auth.uid()` → `students.id` (يوجد/يُنشئ صف عند أول دخول) |
| `public.bootstrap_student()` | DEFINER | `authenticated` | ينشئ/يحدّث صف الطالب بعد أول تسجيل دخول Google |
| `public.update_own_profile(...)` | DEFINER | `authenticated` | تحديث الحقول المسموحة فقط |
| `private.ensure_profile()` | DEFINER, STABLE | — | يُستدعى من `submit` / `create_review_exam` (يضمن وجود صف) |
| `public.start_exam_attempt(p_exam_id, p_mode)` | DEFINER | `authenticated` | ينشئ `in_progress` + يعيد `questions` بلا إجابات + `answer_hash` لكل سؤال + `expires_at` |
| `public.save_answer(p_attempt_id, p_question_id, p_index, p_hash, p_time_taken)` | DEFINER | `authenticated` | upsert في `attempt_answers` (يتحقق إن الـ attempt للطالب + ما انتهى + الهاش) |
| `public.submit_exam_attempt(p_attempt_id, p_answers jsonb, p_time_spent)` | DEFINER | `authenticated` | **التصحيح** + تسجيل `question_performance` + تحديث `students`/`student_subject_stats` + يعيد النتيجة كاملة |
| `public.create_review_exam(p_subject_id, p_count, p_only_wrong, p_include_unseen)` | DEFINER | `authenticated` | §6 — يبني attempt من أخطائي |
| `public.get_my_dashboard()` | DEFINER, STABLE | `authenticated` | ملخّص: إحصاءات عامة + per-subject |
| `public.get_my_wrong_questions(p_subject_id, p_limit)` | DEFINER, STABLE | `authenticated` | قائمتي الغلط لـ subject (بلا correct index) |
| `public.abandon_attempt(p_attempt_id)` | DEFINER | `authenticated` | وضع `abandoned` |
| `public.list_admin_students(p_search, p_subject_id, p_limit, p_offset)` | DEFINER, STABLE | `attempts.view` | جدول الطلاب (server-side pagination) |
| `public.get_admin_student_detail(p_student_id)` | DEFINER, STABLE | `attempts.view` | ملف الطالب: attempts + per-subject stats |
| `public.get_admin_attempts(p_subject_id, p_exam_id, p_student_id, p_from, p_to, p_limit, p_offset)` | DEFINER, STABLE | `attempts.view` | تقرير الامتحانات مع فلاتر |
| `public.get_question_analytics(p_subject_id, p_limit)` | DEFINER, STABLE | `analytics.view` | أصعب الأسئلة على مستوى المنصة |
| `public.admin_set_student_active(p_student_id, p_active)` | DEFINER | `students.manage` | kill/activate |
| `public.admin_delete_student_data(p_student_id)` | DEFINER | `students.manage` | GDPR "احذف بياناتي" |
| `public.admin_upsert_student(p_email, p_full_name, p_note)` | DEFINER | `students.manage` | إنشاء صف يدوي (اختياري Q6) |
| `public.delete_my_account()` | DEFINER | `authenticated` | GDPR: cascaded delete + `auth.users` |

**كل الدوال: `SET search_path = ''` + `REVOKE EXECUTE FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated`**
(except `private.*` التي تبقى `REVOKE ALL FROM PUBLIC`).

---

## 5. المصادقة (Google OAuth) — التدفق الكامل

### 5.1 الإعداد في Supabase Dashboard (مرة واحدة)

```
Authentication → Providers → Google → Enable
  Client ID:     <from Google Cloud Console>
  Client Secret: <from Google Cloud Console>
  (اختياري但موصى به) → Add the domain to an allowlist: thanaya.dpdns.org

Authentication → URL Configuration
  Site URL:                          https://thanaya.dpdns.org
  Redirect URLs (Add new):
    https://thanaya.dpdns.org/auth/callback
    http://localhost:4321/auth/callback        (للتطوير)
    (اختياري لو Vercel Preview: https://*.vercel.app/auth/callback)
```

**في Google Cloud Console** → Credentials → OAuth consent screen:
- Application type: **External**
- Authorized domains: `thanaya.dpdns.org`
- Scopes: الافتراضي (`openid email profile`) — **لا نطلب أي scope إضافي**

### 5.2 الـ Flow (server-side، عبر `@supabase/ssr`)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1) GET /auth/login                                                 │
│    - server: createServerClient({ cookies })                       │
│    - signInWithOAuth({ provider:'google',                          │
│                        options:{ redirectTo: `${origin}/auth/callback`,
│                                 queryParams:{ access_type:'offline',
│                                              prompt:'select_account' } } }) │
│    → Supabase يبني رابط → 302 إلى accounts.google.com              │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2) Google يعرض شاشة الموافقة → redirect إلى                       │
│    /auth/callback?code=...&state=... (أو #access_token=... إلخ)   │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3) /auth/callback — Astro endpoint (prerender = false)            │
│    a. exchangeCodeForSession(code)  (أو استرجاع من hash للـ implicit)│
│    b. Supabase يضبط كوكيز على ASTRORESPONSE                        │
│       (sb-access-token, sb-refresh-token)                          │
│    c. RPC bootstrap_student() → ينشئ/يحدّث صف students             │
│       (يقرأ user_metadata: full_name, picture, email_verified)     │
│    d. redirect → returnTo param أو '/'                            │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4) /auth/logout (POST) — server: signOut() + مسح الكوكيز +        │
│    redirect '/'                                                   │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5) على كل طلب: apps/web/src/middleware.ts                        │
│    - ينشئ locals.supabase (server client)                          │
│    - getUser() (يتحقق من التوقيع — لا تثق بـ getSession())          │
│    - locals.student = النتيجة من RPC                               │
│    - يحمي: /account/*, /review/*, /api/exams/*/submit              │
│    - Cache-Control: private,no-store للصفحات المحمية               │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 ⚠️ تصادم مع `middleware.ts` الموجود

`apps/web/src/middleware.ts` الحالي يلف كل شيء بـ try/catch ويعيد `next()` عند الخطأ.
**يجب** إضافة خطوة `getUser()` في نفس الملف **بدون المساس بباقي الـ logic** (الـ headers كما هي).
الخيار الأقل خطراً: **ملف middleware منفصل** أو إضافة في أعلى الدالة الحالية مع الحفاظ على
الـ try/catch بشكل صحيح. (تفاصيل في §12 — Phase 1.)

### 5.4 ⚠️ تعارض مع `ClientRouter` (Astro view transitions)

`Layout.astro` يستورد `<ClientRouter />`. التنقل بين الصفحات يتم بدون reload كامل →
كوكيز متاحة لكن `onAuthStateChange` في المتصفح يحتاج إدارة. الحل:
- الاعتماد على **KOOKي فقط** — لا `supabase.auth.onAuthStateChange` في المتصفح.
- كل صفحة تحتاج بيانات طالب تستدعي endpoint/public أو تحقن `isLoggedIn` من السيرفر.
- عند تسجيل الخروج → `location.href = '/auth/logout'` (full reload، لا ClientRouter).

### 5.5 ⚠️ CSP — `vercel.json` و `middleware.ts`

```json
"form-action 'self'; connect-src 'self' https: wss:;"
```
- OAuth يستخدم **redirect كامل (302)** وليس fetch → `form-action` OK.
- `connect-src https:` يسمح بـ `*.supabase.co` (fetch للـ API من المتصفح).
- ⚠️ لكن `signInWithOAuth` من المتصفح يحتاج `redirectTo` OUR domain —وهو ضمن `form-action 'self'`.
- **لا تغيير مطلوب في CSP** — وهذا news جيدة. (نتحقق في Phase 1.)
- إن احتجنا `frame-src` لـ Google → نضيف `https://accounts.google.com` لـ `frame-src` فقط عند الحاجة.

### 5.6 صفحات جديدة في `apps/web/src/pages/`

| الملف | النوع | الوظيفة |
|---|---|---|
| `auth/login.astro` | SSR, prerender=false | زر "سجّل الدخول بجوجل" + تحويل تلقائي لو مسجّل |
| `auth/callback.astro` | SSR, prerender=false | نقطة استقبال OAuth (أعلاه) |
| `auth/logout.ts` | endpoint POST (أو GET) | تسجيل الخروج |
| `account/index.astro` | SSR, محمي | ملفي: الإحصاءات، per-subject، سجل الامتحانات |
| `account/wrong-questions.astro` | SSR, محمي | قائمة الأسئلة الغلط لكل مادة |
| `review/index.astro` | SSR, محمي | صفحة "امتحان الأخطاء": اختر مادة + عدد |
| `review/[attemptId].astro` | SSR, محمي | تشغيل محاولة review (مشترك مع `/exams/[id].astro`) |

⚠️ **`/review/[attemptId].astro` يمكن أن يكون reuse لـ `/exams/[id].astro`** لكن مختلف جوهرياً
(attempt موجود مسبقاً، بدون `exam_id`). خطة مبسطة: نكرر القالب مع تعديلات صغيرة (المshares
ليست components في Astro بدون effort — الـ `exam-questions` view logic هو ~500 سطر
`<script is:inline>` واحد). **نقترح** استخراج `<script>` المكرر إلى ملف مشترك
`apps/web/src/scripts/exam-runner.js` في Phase 3 — هذا **تحسين اختياري**، لا شرط.

---

## 6. "امتحان الأخطاء" —Logic التصميمي (الأهم)

### 6.1 المتطلبات (من طلبك)
- "امكانية انشاء الطلاب امتحان على الاسئلة اللي غلط فيها قبل كده في مادة معينة"
- "ولو الاسئلة كتير يختار عددهم" (الـ count يختاره الطالب)

### 6.2 خوارزمية الاختيار

RPC `create_review_exam(p_subject_id, p_count, p_only_wrong, p_include_unseen)`:

**المرحلة A — مرشحو الأخطاء** (weights):
```sql
WITH candidates AS (
  SELECT qp.question_id, qp.times_wrong, qp.times_seen,
         qp.consecutive_wrong, qp.last_wrong_at, qp.mastery_confidence,
         -- وزن الأولوية: كلما كان الخطأ أحدث وأكثر تكراراً، زادت الأولوية
         (qp.times_wrong::NUMERIC
            * (1 + LEAST(qp.consecutive_wrong, 5) * 0.4)
            * COALESCE(EXP(-EXTRACT(EPOCH FROM (now() - qp.last_wrong_at)) / (86400.0 * 30)), 0.3)
         ) AS priority
  FROM public.question_performance qp
  WHERE qp.student_id = v_student_id
    AND qp.subject_id = p_subject_id
    AND qp.is_mastered = false
    AND qp.times_wrong > 0
    AND q.question_status = 'active'          -- لم يُحذف
  ORDER BY priority DESC
)
```

**المرحلة B — إكمال العدد المطلوب**:
```sql
-- لو p_include_unseen: أكمل من أسئلة المادة غير المحاولة
UNION ALL (
  SELECT eq.id, 0,0,0,0, now(), 0, (0.3) AS priority   -- وزن منخفض جداً
  FROM public.exam_questions eq
  WHERE eq.subject_id = p_subject_id
    AND eq.id NOT IN (SELECT question_id FROM question_performance WHERE student_id = v_student_id)
    AND eq.is_deleted = false
  ORDER BY RANDOM()
  LIMIT (p_count - count_of_A)
)
```

**المرحلة C — التنفيذ:**
```
LIMIT p_count (default 10, min 5, max 50)   → validation في الـ RPC
طلب عشوائي (weighted random) داخل الـ LIMIT
إنشاء exam_attempts row (mode='review', exam_id=NULL, subject_id=…)
إنشاء attempt_answers rows بـ is_correct=NULL, is_blank=true (حجز)
إرجاع attempt_id + list of question_ids (بلا correct index)
```

**انتبه:** `ORDER BY RANDOM()` على 100k صف = بطيء. نقترح:
- `TABLESAMPLE` أو randomization على `hashtext(id::text, seed)` للـ ORDER BY
- أو index على `exam_questions(subject_id)` + `LIMIT` مع `TABLESAMPLE SYSTEM (1)`.
- في القاعدة صغيرة (< 100k سؤال) `ORDER BY RANDOM()` مقبول، لكن نضع **LIMIT داخلي 500** أولاً.

### 6.3 خوارزمية `mastery_confidence` (درجة الإتقان)

```
Simple + explainable:
  times_seen = 1 → 0.5
  times_seen = 2 → 0.7
  times_seen ≥3 → 0.85
  is_mastered (times_correct ≥ 2) → 1.0
```

### 6.4 تحديث `question_performance` عند التسليم

```sql
-- داخل submit_exam_attempt، لكل إجابة:
-- 1) UPSERT مرة أولى
-- 2) إذا times_correct >= 2 → is_mastered = true  (أُتقن السؤال، لا يعود للامتحان)
-- 3) إذا times_wrong > 0 → last_wrong_at = now(), consecutive_wrong++
-- 4) إذا times_correct > 0 → consecutive_wrong = 0 (تقدم)
```

### 6.5 User flow في `apps/web`

```
/account
  "📊 إحصاءاتك"
  [اللغة العربية]  [الرياضيات]  [الفيزياء] ...
  لكل مادة: عدد الامتحانات | avg score | أسئلة أخطأت فيها (متوسط٪) | [امتحان أخطائي]

/review
  "امتحان الأخطاء"
  ┌──────────────────────────────────┐
  │ المادة:  [الرياضيات ▾]         │
  │                            ▼     │
  │ عدد الأسئلة: [slider 5..30]      │
  │ [x] فقط أسئلة أخطأت فيها         │
  │ [ ] إضافة أسئلة لم تُحاول        │
  │ ────────────────────────          │
  │ "لديك 12 سؤال خطأ في الرياضيات" │
  │ [ ابدأ امتحان الأخطاء ]  ← أو    │
  │   "لا يوجد أسئلة خطأ — تفوّق!"   │
  └──────────────────────────────────┘
  → يبدأ attempt →صفحة `/exams/...`  (نفس runner)
  → عند التسليم → نتيجة + "أسئلة أخطأت فيها قبل كده" (تحديث فوري)
```

### 6.6 الحالات الحدّية

| الحالة | السلوك |
|---|---|
| لا توجد أسئلة غلط | "لا توجد أسئلة خطأ. تفوّق 🎉" + CTA "امتحان جديد عادي" |
| أسئلة غلط أقل من العدد المطلوب | "لديك 5 أسئلة خطأ فقط، ستأخذها + 5 جديدة" |
| `# times_seen=0` (include_unseen) | poids منخفض 0.3، لكن تظهر كـ "جديد" (أول مرة) |
| `p_count > available` | validation error: "متاح فقط X سؤال" |
| `p_subject_id` بلا أخطاء | empty result (لا خطأ — راجعه في UI) |
| `p_only_wrong=true` وأخطاء أقل من count | نفس السلوك: "سيقل العدد" |
| السؤال تم حذفه (soft delete) | يُستبعد من المرشحين |
| `time_limit` لـ review | `min(30 min, count * 1.5 min)` |
| Same question in two active attempts | مسموح (لا قيد) — بسجل منفصل |

---

## 7. لوحة التحكم — تبويبات جديدة

### 7.1 التبويبات (3 جديدة)

| TabId | التسمية | perm | superOnly | Component |
|---|---|---|---|---|
| `students` | الطلاب | `students.view` | — | `StudentsManager.tsx` (~600 سطر) |
| `attempts` | الامتحانات والنتائج | `attempts.view` | — | `AttemptsManager.tsx` (~600 سطر) |
| `question_analytics` | تحليل الأسئلة | `analytics.view` | — | `QuestionAnalytics.tsx` (~350 سطر) |

**التعديل في `App.tsx`:**
```
1) NAV array (App.tsx:86-99)  += 3 entries
2) visibleNav filter (App.tsx:~104)  — يعمل تلقائياً (can() + superOnly)
3) tab rendering (App.tsx:272-284) += 3 components
4) TabId type (App.tsx:24) += 3
```
هذا كل شيء — لا router ولا مسارات.

### 7.2 `StudentsManager.tsx` — جدول الطلاب

**الأعمدة:**
```
[الصورة] الاسم | البريد | الحالة (نشط/معطّل) | عدد الامتحانات | avg% | آخر ظهور | [تفاصيل]
```

**Features:**
- **بحث** بالاسم/البريد (server-side مع debounce)
- **فلتر**: الحالة (نشط/معطّل)، المادة (يعرض avg% الخاص بالمادة)
- **ترتيب**: الاسم، آخر ظهور، avg score، عدد الامتحانات
- **صفحة Student Detail** (modal/صفحة):
  - معلومات الحساب: الصورة، الاسم، البريد، `email_verified`، `oauth_provider`، تاريخ التسجيل، آخر ظهور
  - **إحصاءات عامة**: attempts, avg%, عدد الأسئلة، نسبة الإتقان
  - **جدول per-subject**: attempts | avg% | best% | أسئلة غلط
  - **سجل الامتحانات** (30 الأحدث): التاريخ | المادة | نوع (عادي/أخطاء) | النتيجة % | الصحيح/الغلط
  - **أزرار إدارية**: تعطيل/تنشيط ✅ | حذف البيانات ⚠️
- **CSV Export** (كل الفلاتر الحالية)

**الملفات:** `api/students.ts` (جديد) يتبع نمط `api/exams.ts` — كل دالة تتفرع على `isConfigured` وترجع mock.

### 7.3 `AttemptsManager.tsx` — تقرير الامتحانات

**Features:**
- **جدول** (server-side pagination): التاريخ | الطالب | المادة | الامتحان | النوع | النتيجة % | الصحيح/الغلط/الفراغ | الوقت | [عرض]
- **فلاتر**: تاريخ (من-إلى)، طالب، مادة، نوع (عادي/أخطاء)، حالة (مقدم/مستلم/متروك)، نطاق درجة
- **ملخص علوي**: إجمالي المحاولات | avg% | أعلى طالب | أكثر مادة صعبة | عدد停产
- **Actions** (حسب `attempts.manage`): حذف محاولة (GDPR)، تعليم كـ "اشتباه غش"، تصدير CSV
- **ملف محاولة واحدة**: كل إجاباته + timestamp لكل إجابة + `answer_hash` verification status

### 7.4 `QuestionAnalytics.tsx` — أصعب الأسئلة ( قيمة للمدير)

**الجدول:**
```
[صورة السؤال] نص السؤال (مقتطع) | المادة | # مرات ظاهرة | # خطأ | نسبة الخطأ | # طلاب أخطأوا | [تفاصيل]
```
- مرتّب بنسبة الخطأ DESC
- **Distribution histogram** لكل إجابة (النسبة التي اختارها الطلاب) — لكشف سؤال غامض
- فلتر: المادة، "الأخطاء المتكررة فقط"، "الأسئلة الجديدة بلا بيانات"
- **إحصاءات عامة علوية**: # طلبة نشطين | avg attempts/طالب | # محاولات | معدل إتقان الأسئلة

### 7.5 إضافات على `AnalyticsView.tsx` (اختياري)
- قسم "الطلبة": عدد الطلاب الجدد هذا الشهر، المنحنى الزمني، # students مع رسم
- ارتباط: # attempts في كل مادة

### 7.6 مفاتيح الصلاحيات الجديدة

**يُضاف إلى migration جديد (لا نعدّل ⑥):**
```sql
INSERT INTO public.permissions (key, label_ar, category, supports_scope, order_index) VALUES
  ('students.view',   'عرض الطلاب',              'system', true,  100),
  ('students.manage', 'إدارة الطلاب',            'system', true,  101),
  ('attempts.view',   'عرض نتائج الامتحانات',     'system', true,  110),
  ('attempts.manage', 'إدارة نتائج الامتحانات',   'system', true,  111);
```
- `supports_scope = true` → يمكن حصر "طلاب الرياضيات فقط" لـ staff.
- **لا نضيفها لـ `admin_role_presets` للـ `admin`** افتراضياً — لتفادي تسريب بيانات الطلبة.
  فقط `super_admin` يملكها. (نموذج "بعض الصلاحيات تتطلب super").

---

## 8. `apps/web` — التعديلات (مفصّلة بالملف)

⚠️ **هذه خطة، لم تُنفّذ.**

### 8.1 ملفات جديدة

| الملف | الغرض |
|---|---|
| `src/lib/auth-server.ts` | `createServerClient` مع كوكيز Astro + helpers (`getSession`, `requireStudent`, `isStaff`) |
| `src/lib/auth-client.ts` | client المتصفح (session refresh + signInWithOAuth) |
| `src/lib/student-api.ts` | wrappers لـ RPCs (startAttempt, saveAnswer, submitAttempt, createReview, etc.) |
| `src/lib/answer-hash.ts` | HMAC المتوافق بين المتصفح والسيرفر (اختياري — Server only is safer) |
| `src/pages/auth/login.astro` | صفحة دخول Google |
| `src/pages/auth/callback.astro` | استقبال OAuth |
| `src/pages/auth/logout.ts` | تسجيل خروج |
| `src/pages/account/index.astro` | لوحة الطالب |
| `src/pages/account/wrong-questions.astro` | قائمة الغلط |
| `src/pages/review/index.astro` | إنشاء امتحان أخطاء |
| `src/pages/api/exams/[id]/start.ts` | endpoint start (اختياري — يمكن الاعتماد على SSR inline) |
| `src/pages/api/exams/attempt/[id]/answer.ts` | endpoint حفظ إجابة |
| `src/pages/api/exams/attempt/[id]/submit.ts` | endpoint التسليم والتصحيح |
| `src/pages/api/exams/review/create.ts` | endpoint إنشاء امتحان أخطاء |

**عدد endpoints:** 4 (`/api/...`). كلها:
- `export const prerender = false;`
- فحص `locals.student` (RLS يضاعف الحارس)
- `isAuthorizedAdmin`-style CORS: **نفس النمط لكن بدون CORS** (نفس الأصل فقط، form POST)
- size limit على body: `content-length > 256KB → 413`

### 8.2 ملفات معدّلة (تصغير الـ diff)

| الملف | التعديل | الحجم المتوقع |
|---|---|---|
| `src/middleware.ts` | إضافة خطوة `getUser()` (session → locals) + حماية المسارات المحمية | +~40 سطر |
| `src/lib/supabase.ts` | **لا يتغير** (يبقى للمحتوى العام) | 0 |
| `src/pages/exams/[id].astro` | 3 تعديلات صغيرة: (1) `questionsJson` → stripe للمجالات الحساسة, (2) إضافة "سجّل دخول لحفظ نتيجة" inline badge, (3) تعديل `submitExam()` لإضافة fetch مشروط إذا كان `isLoggedIn` | +~80 سطر |
| `src/layouts/Layout.astro` | زر "تسجيل دخول" / "حسابي" في الهيدر (شرطي على `isLoggedIn`) | +~25 سطر |
| `src/lib/geo.ts` | إضافة `WebPage` schema لصفحات الحساب + `noindex` عليها | +~20 سطر |

**لا نلمس:** `src/lib/api.ts` · `src/lib/cache.ts` · كل صفحات المحتوى · كل components الحالية.

### 8.3 crucial: إخفاء الإجابات من HTML

```typescript
// في exams/[id].astro — قبل التسريب للـ HTML
const safeQuestions = exam.questions.map((q) => ({
  id: q.id,
  question_text: q.question_text,
  options: q.options,
  image_url: q.image_url,
  // ❌ لا correct_option_index
  // ❌ لا explanation
}));
```
يُحذف حقلين فقط. **الباقي يبقى كما هو** (المؤقت، التنقل بين الأسئلة،格栅 — كلها بدون تعديل).

### 8.4 crucial: حفظ إجابة أثناء الامتحان

في `exams/[id].astro` (السكربت `<script is:inline>` القائم، نحو 743):
```
عند الاختيار:
  if (isLoggedIn && attemptId) {
    navigator.sendBeacon('/api/exams/attempt/'+attemptId+'/answer',
      JSON.stringify({ question_id, index, hash, time_taken }))
  }
```
**لا ننتظر fetch (sendBeacon)** — والأهم: **حتى لو فشل، النتيجة تُحسب محلياً ونرسلها للتسليم؛ السيرفر يعيد التصحيح النهائي.**

### 8.5 crucial: submit مع Ricorsione غطس

```javascript
// في submitExam() — إضافة في بداية الدالة (قبل التحويل لـ results)
let serverResult = null;
if (isLoggedIn && attemptId) {
  try {
    const resp = await fetch('/api/exams/attempt/'+attemptId+'/submit', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ answers: userAnswers, time_spent: timeSpentSeconds })
    });
    if (resp.ok) serverResult = await resp.json();
  } catch(e) { /* fallback إلى الحساب المحلي */ }
}
// إن serverResult === null → نستخدم الحساب المحلي (current behavior) + "لم نتمكن من الحفظ"
```
**المهم:** الاستخدام المزدوج يعني:
- `questionsJson` السريب قد يبقى (لأغراض SEO/local-fallback) — أو يُحذف (أقوى أمنياً).
- **القرار:** في v1 نُبقيه (لأن الوضع القديم زائر) لكن نضع `# ⚠️` ونضيف migration لـ v2 يحذفه نهائياً عند **إلزام** تسجيل الدخول (Q1 = A).

### 8.6 SEO / noindex

- `/account/*` و `/review/*` و `/auth/*` → `<meta name="robots" content="noindex,nofollow">` + `no-store` cache.
- `getUser()` + `locals` في SSR يجعل هذه صفحات dynamic — Astro يحتاج `export const prerender = false`.

---

## 9. `apps/admin` — التعديلات

⚠️ **هذه خطة، لم تُنفّذ.**

### 9.1 ملفات جديدة

| الملف | الأسطر | الدور |
|---|---|---|
| `src/api/students.ts` | ~150 | `getStudents`, `getStudentDetail`, `setStudentActive`, `deleteStudentData`, `exportStudentsCSV` |
| `src/api/attempts.ts` | ~200 | `getAttempts`, `getAttemptDetail`, `deleteAttempt`, `getAttemptsSummary` |
| `src/api/questionAnalytics.ts` | ~120 | `getQuestionAnalytics`, `getAnswerDistribution` |
| `src/components/StudentsManager.tsx` | ~600 | جدول + فلاتر + detail modal |
| `src/components/StudentDetailModal.tsx` | ~400 | (مكوّن فرعي) |
| `src/components/AttemptsManager.tsx` | ~600 | جدول + فلاتر + summary |
| `src/components/QuestionAnalytics.tsx` | ~350 | جدول + histogram |

### 9.2 ملفات معدّلة

| الملف | التعديل | الحجم |
|---|---|---|
| `src/App.tsx` | NAV += 3، TabId += 3، rendering += 3 | +~25 سطر |
| `src/api/client.ts` | spread += 3 modules | +3 سطر |
| `src/api/_shared.ts` | mock seeds للطلبة/المحاولات (للتطوير بلا Supabase) | +~120 سطر |
| `src/lib/permissions.ts` | إضافة 4 مفاتيح للثوابت (اختياري — النظام يقرأ من DB) | 0 أو +~8 |

### 9.3 نمط التنفيذ في `api/*.ts` (يتبع `api/exams.ts`)

```typescript
// كل دالة تتفرع على isConfigured (mock) أو Supabase (حقيقي)
export async function getStudents(params: StudentFilters): Promise<Student[]> {
  if (!isConfigured) return mockStudents.filter(...);
  const { data, error } = await supabase.rpc('list_admin_students', {...});
  if (error) throw error;
  return data ?? [];
}
```

### 9.4 تفاعل مع نظام الموافقات

- **لا** نضيف `students`/`attempts` لـ `change_requests` — البيانات **قراءة فقط** للإدارة
  (عملياً، الأدمن لا ينشئ طلاب أو محاولات).
- الاستثناء: `admin_set_student_active` و `admin_delete_student_data` — نطلب `students.manage`
  مباشرة (super فقط — ليس في presets).
- لذا **لا نحتاج تعديل `ChangeRequestEntity` type**.

---

## 10. `packages/types` — التحديثات

⚠️ **خطة، لم تُنفّذ.**

`packages/types/src/database.ts`:
1. إضافة `Student`, `StudentSubjectStats`, `ExamAttempt`, `AttemptAnswer`,
   `QuestionPerformance`, `AttemptMode`, `AttemptStatus` (types).
2. إضافة `Row/Insert/Update` لـ 6 جداول جديدة في `Database['public']['Tables']`.
3. إضافة 16 RPC signature جديد في `Database['public']['Functions']`.
4. إضافة `'students' | 'attempts' | 'question_analytics'` إلى أي union لـ TabId (إن وُجد في types — حالياً في App.tsx).

**الأثر:** `apps/web` و `apps/admin` سيحصلان على type-safety تلقائي لأن `@thanaya/types` workspace مشترك.

⚠️ **يجب تقديم `Database` types بعد تطبيق migration** وإلا `tsc` سيفشل على `supabase.from('students')`.

---

## 11. الاختبارات

### 11.1 اختبارات SQL (نفس نمط `supabase/tests/rbac/`)

```
supabase/tests/students/
├── run.sh                    (نفس نمط rbac/run.sh)
├── README.md                 (عربي)
├── 00_bootstrap.sql          (نفس bootstrap، +سطر لـ student)
├── 01_fixtures.sql           (3 طلبة، أسئلة، 3 محاولات سابقة)
├── 02_student_self_access.sql
│   ✓ الطالب يقرأ ملفه فقط
│   ✓ لا يقرأ ملف طالب آخر
│   ✓ لا يكتب exam_questions
│   ✓ لا يكتب question_performance مباشرة (محجوب)
│   ✓ anon لا يرى شيئ
├── 03_start_and_save.sql
│   ✓ start_exam_attempt ينشئ correctly
│   ✓ الإرجاع بلا correct_index/answer_hash صحيح
│   ✓ attempt_id لنفسه
│   ✓ can't start attempt لـ exam غير منشور
│   ✓ p_exam_id=null (review) يحتاج subject_id
├── 04_submit_and_grade.sql
│   ✓ submit correct grade
│   ✓ question_performance محدث
│   ✓ students.total_* محدث
│   ✓ student_subject_stats محدث
│   ✓ is_correctPrecision = p_is_correct
│   ✓ double-submit مرفوض (status Already submitted)
│   ✓ expired attempt (expires_at past) مرفوض
├── 05_review_exam_creation.sql
│   ✓ create_review_exam يعيد p_count أسئلة
│   ✓ لاikoна مرشحة من is_mastered=true
│   ✓ weight trتيب: newest wrong أول
│   ✓ p_count validation (min/max)
│   ✓ unavailable count error
│   ✓ p_include_unseen يضيف غير المحاولة
│   ✓ محاوله واحدة لا تكرر سؤالاً مرتين
├── 06_mastery_progression.sql
│   ✓ times_correct >= 2 → is_mastered=true
│   ✓ is_mastered يخرج من المرشحين
│   ✓ consecutive_wrong يزيد/ينقص
├── 07_rate_limit_and_integrity.sql
│   ✓ answer_hash mismatch مرفوض
│   ✓ rate limit يعمل (10 submits)
│   ✓ unprivileged RPCs REVOKE from anon
├── 08_admin_staff_access.sql
│   ✓ staff without students.view لا يرى
│   ✓ staff with students.view scoped لمادة واحدة
│   ✓ super_admin يرى الكل
│   ✓ attempts.view لا يعطي students.manage
├── 09_cascade_delete.sql
│   ✓ حذف auth.user يحذف student
│   ✓ حذف student يحذف attempts + answers + performance
│   ✓ delete_my_account ينظف auth.users
├── 10_anonymous_regression.sql
│   ✓ كل اختبارات "زائر" قائمة تمر (عدم كسر السلوك الحالي)
│   ✓ anon ما زال يقرأ subjects/exams/resources
```

**التوقع:** ~85+ assertion. `run.sh` Like rbac مع `set -euo pipefail`، وfail واضح.

### 11.2 اختبارات الواجهة (اختيارية — لا يوجد harness حالياً)

```
- Sign in with Google (e2e، يحتاج بيانات حقيقية)
- Start exam → answer → submit → verify result
- Review exam with known wrongs
- Admin: view students table
- Admin: view attempts with filters
```

**ملاحظة:** لا يوجد أي test runner في `apps/web` أو `apps/admin` حالياً
(لا `vitest` ولا `playwright`). إذا أردنا tests للواجهة، سنحتاج إضافة harness
(نرشّح: `vitest` + `@testing-library/react` للـ admin، و `playwright` للـ web مع mock OAuth).

### 11.3 اختبار يدوي (مستحسن قبل كل deploy)

- [ ] تسجيل دخول Google (حساب حقيقي) — يعيد توجيه صحيح
- [ ] `Supabase Dashboard → Authentication → Users` — يظهر المستخدم
- [ ] `students` table — صف موجود، `is_active=true`
- [ ] امتحان بدون تسجيل دخول — يعمل كسابق (fallback)
- [ ] امتحان مع تسجيل دخول — يحفظ، يظهر في `exam_attempts`
- [ ] حساب خاطئ على `answer_hash` — يرفض التصحيح
- [ ] "امتحان الأخطاء" — يختار من الغلط فقط
- [ ] إتقان سؤال (صحيح مرتين) — يختفي من مرشحي الأخطاء
- [ ] الأدمن: جدول الطلاب يعمل
- [ ] الأدمن: تقرير الامتحانات بالفلاتر يعمل
- [ ] أدمن بـ `students.view` scoped — يرى مادة واحدة فقط
- [ ] CSV ي export صحيح
- [ ] حذف `is_active=false` — الطالب من��وع
- [ ] RLS audit: `anon` لا يرى `students`/`exam_attempts`
- [ ] Performance: query `question_performance` في < 100ms

---

## 12. الخطة التنفيذية (Phased)

### Phase 0 — التحضير (0.5 يوم)
- [ ] نسخ احتياطي لقاعدة البيانات (`pg_dump`)
- [ ] فرع جديد: `feat/student-auth`
- [ ] مراجعة Q1-Q6 (§2.6) — **حسم كل قرار**
- [ ] تجهيز Google OAuth credentials (Client ID/Secret)
- [ ] تفعيل Google provider في Supabase
- [ ] إضافة Redirect URLs
- [ ] قياس baseline: `EXPLAIN ANALYZE` على `getPublishedExams`, `getStudentById` (لا يوجد بعد — نضيف)

**شرط الخروج:** القرارات محسومة، credentials جاهزة، backup موجود.

### Phase 1 — قاعدة البيانات (2-3 أيام) — **الأهم**
- [ ] ملف جديد: `20261001000000_student_auth.sql`
  - [ ] `students` + indexes + `updated_at` trigger
  - [ ] `exam_questions`: `subject_id` (denormalized) + `fingerprint` + counters
  - [ ] triggers: `sync_question_subject`, `set_question_fingerprint`, `normalize_question_text`
  - [ ] `exam_attempts` + indexes + constraints
  - [ ] `attempt_answers` + indexes
  - [ ] `question_performance` + indexes
  - [ ] `student_subject_stats` (اختياري)
  - [ ] `rate_limits` (اختياري)
- [ ] ملف جديد: `20261001000001_student_rls.sql`
  - [ ] `ENABLE RLS` على كل جدول
  - [ ] `REVOKE ALL ... FROM anon` + GRANTs صريحة لـ `authenticated`
  - [ ] سياسات `students` (self-read فقط؛ UPDATE عبر RPC)
  - [ ] سياسات `exam_attempts` (self)
  - [ ] سياسات `attempt_answers` (self)
  - [ ] سياسات `question_performance` (self-read فقط)
  - [ ] سياسات `student_subject_stats` (self-read فقط)
- [ ] ملف جديد: `20261001000002_student_functions.sql`
  - [ ] `private.*` helpers (SECURITY DEFINER, `search_path=''`)
  - [ ] `bootstrap_student()`, `update_own_profile()`
  - [ ] `start_exam_attempt()`, `save_answer()`
  - [ ] `submit_exam_attempt()` ← الأهم
  - [ ] `create_review_exam()` ← الأهم
  - [ ] `get_my_dashboard()`, `get_my_wrong_questions()`
  - [ ] `admin.list_*` functions
  - [ ] GRANT/REVOKE على كل دالة
- [ ] ملف جديد: `20261001000003_student_permissions.sql`
  - [ ] INSERT 4 مفاتيح في `permissions`
  - [ ] (اختياري) منح لـ `admin` preset حسب القرار
- [ ] ملف جديد: `20261001000004_backfill.sql`
  - [ ] `UPDATE exam_questions SET subject_id = (SELECT subject_id FROM exams ...)`
  - [ ] حساب `fingerprint` للأسئلة الموجودة
  - [ ] `CREATE INDEX CONCURRENTLY` (إن أمكن)
- [ ] **اختبارات** `supabase/tests/students/` (§11.1) — كلها تمر

**شرط الخروج:** كل الـ tests خضراء. RLS audit:
- 0 جداول بلا RLS
- 0 جداولlacAccessible لـ anon
- 0 دوال `private.*` قابلة للتنفيذ من anon

**⚠️ تنبيه لـ DEPLOYMENT:** migration ⑥ حذف `ALL ON SCHEMA public FROM anon`. هذا آمن.
 لكن تأكد: `student_subject_stats` لا يمنح SELECT لـ anon.

### Phase 2 — Types (0.5 يوم)
- [ ] `packages/types/src/database.ts` — كل الـ types + `Database` interfaces
- [ ] `npm run typecheck` يمر في `packages/types`

**شرط الخروج:** `typecheck` نظيف.

### Phase 3 — المصادقة في `apps/web` (2-3 أيام)
- [ ] `src/lib/auth-server.ts` (server client + helpers)
- [ ] `src/lib/auth-client.ts` (browser client)
- [ ] `src/pages/auth/login.astro`
- [ ] `src/pages/auth/callback.astro`
- [ ] `src/pages/auth/logout.ts`
- [ ] `src/middleware.ts` — إضافة `getUser()` + حماية المسارات
- [ ] تعديل `Layout.astro` — زر تسجيل دخول/حسابي
- [ ] اختبار: تسجيل دخول Google يعمل (فعلي، في `localhost` ثم الإنتاج)

**شرط الخروج:** 
- [ ] تسجيل دخول → يظهر اسم المستخدم في الهيدر
- [ ] `/account` محمي → يعيد توجيه لو مسجّل
- [ ] تسجيل خروج → الهيدر يعود لزائر
- [ ] الصفحات العامة ما زالت تعمل

### Phase 4 — الامتحان مع الحفظ (2-3 أيام)
- [ ] `src/lib/student-api.ts` — wrappers
- [ ] `src/pages/api/exams/attempt/[id]/answer.ts` (save)
- [ ] `src/pages/api/exams/attempt/[id]/submit.ts` (submit + grade)
- [ ] تعديل `exams/[id].astro`:
  - [ ] عند "ابدأ": إذا مسجّل → `start_exam_attempt` (يحصل على `attemptId` + hashes)
  - [ ] عند كل اختيار → `sendBeacon` للإجابة
  - [ ] عند "تسليم" → `fetch` submit (مع fallback على الحالي)
  - [ ] إظهار حالة "تم الحفظ ✓" / "لم يُحفظ"
  - [ ] المواضع: ~5 تعديلات صغيرة في السكربت
- [ ] اختبار: attempt يظهر في DB، النتيجة محفوظة

**شرط الخروج:**
- [ ] امتحان مسجّل → attempt في DB
- [ ] امتحان زائر → لا شيء في DB، يعمل كسابق
- [ ] `correct_option_index` غير موجود في HTML للطلبة المسجلين

### Phase 5 — واجهة "امتحان الأخطاء" (2 أيام)
- [ ] `src/pages/review/index.astro` — اختيار مادة + عدد
- [ ] `src/pages/api/exams/review/create.ts` (أو server action)
- [ ] `src/pages/review/[attemptId].astro` — runner (أو reuse من `/exams/[id]`)
- [ ] ربط من `/account`
- [ ] empty states: "لا أخطاء" / "أخطاء قليلة"

**شرط الخروج:**
- [ ] يختار مادة + عدد → attempt review
- [ ] يعرض فقط أسئلة أخطأ فيها
- [ ] يحترم `is_mastered`

### Phase 6 — حساب الطالب (1 يوم)
- [ ] `src/pages/account/index.astro` — dashboard
- [ ] `src/pages/account/wrong-questions.astro` — قائمة الغلط
- [ ] ربط في `Layout.astro` (قائمة منسدلة)

### Phase 7 — لوحة التحكم (3-4 أيام)
- [ ] `src/api/students.ts`
- [ ] `src/api/attempts.ts`
- [ ] `src/api/questionAnalytics.ts`
- [ ] `src/api/_shared.ts` — mocks
- [ ] `src/components/StudentsManager.tsx`
- [ ] `src/components/StudentDetailModal.tsx`
- [ ] `src/components/AttemptsManager.tsx`
- [ ] `src/components/QuestionAnalytics.tsx`
- [ ] تعديل `src/App.tsx` (NAV += 3)
- [ ] تعديل `src/api/client.ts`
- [ ] wire permissions في `App.tsx`

**شرط الخروج:**
- [ ] 3 تبويبات تظهر لـ super_admin فقط (في البداية)
- [ ] الفلاتر تعمل
- [ ] CSV ي export
- [ ] تفاعل كامل مع `get_my_permissions`

### Phase 8 — الأمان والتدقيق (1 يوم)
- [ ] RLS audit شامل
- [ ] Privilege escalation test (طالب يحاول يعطي نفسه صلاحية)
- [ ] `answer_hash` integrity test
- [ ] Rate limiting test
- [ ] Audit log لـ `students.manage` actions (نضيف في `admin_activity_log`)
- [ ] GDPR: `delete_my_account` UI
- [ ] CSP verification (تأكد أن OAuth redirect يعمل)

### Phase 9 — النشر (0.5 يوم)
- [ ] `npm run typecheck` نظيف في الكل
- [ ] `npm run lint` نظيف
- [ ] `npm run build` نجح
- [ ] تطبيق migrations على الإنتاج (بـ `supabase db push`)
- [ ] Sanity check بعد النشر
- [ ] تحديث `DEPLOYMENT.md` و `README`
- [ ] تحديث `PROJECT_PLAN.md` بمرجع لل新的 features

---

## 13. المخاطر والتخفيف

| # | الخطر | الاحتمال | الأثر | التخفيف |
|---|---|---|---|---|
| R1 | **تسريب بيانات طلبة لـ staff** | متوسط | 🔴 حرج | ① 4 مفاتيح جديدة خارج الـ admin preset ② test: staff without `students.view` لا يرى شيئ ③ `students.view` scope |
| R2 | **إمكانية الغش** (مفتاح في HTML) | مؤكد حالياً | 🔴 حرج | Phase 4 يحذف المفتاح للمسجّلين. Phase 5+ يمكن إلزام التسجيل (Q1=A) لفرض serverside grading 100% |
| R3 | **SQL injection في RPC** | منخفض | 🔴 | كل المعاملات `p_` params مع bind، `search_path=''`، راجع `dynamic SQL` (إن وُجد) — لا نستخدم `EXECUTE format()` إلا مع `quote_ident` |
| R4 | **`question_performance` تنمو بسرعة** | مؤكد | 🟡 | index على `WHERE is_mastered=false`. لو > 1M صف → Quarterly cleanup. Partition by created_at إن لزم |
| R5 | **كلمة مرور `answer_hash` مكشوفة** | متوسط | 🟡 | المفتاح في السيرفر فقط (Edge function أو env). لا يُحفظ في DB. HMAC-SHA256 معpepper |
| R6 | **حجم الجلسات في كوكي** | مؤكد | 🟡 | `answer_hash` 64 hex chars. Supabase access_token في كوكي httpOnly — لا مشكلة. لكن نراقب |
| R7 | **`ORDER BY RANDOM()` بطيء** | متوسط | 🟡 | لو > 50k سؤال → `TABLESAMPLE` أو randomization عبر `hashtext()` |
| R8 | **Google OAuth rate limit** | منخفض | 🟡 | Supabase يدير. `prompt: 'select_account'` لتجنب silent re-login |
| R9 | **`/api/exams/attempt/[id]/submit` محمي بمSid فقط** | مؤكد | 🟡 | submission = POST فقط، `status` check في الـRPC → replay مرفوض |
| R10 | **`students`表的 UPDATE spoofing** | مؤكد | 🟡 | لا UPDATE عام — RPC بقائمة بيضاء صريحة (5 حقول فقط) |
| R11 | **توافق `ClientRouter` مع logout** | مؤكد | 🟡 | `location.href = '/auth/logout'` بدل ClientRouter nav |
| R12 | **محتوى SEO يتأثر بـ caching** | مؤكد | 🟡 | `Cache-Control: private,no-store` للصفحات المحمية. المحتوى العام يبقى cached |
| R13 | **هجوم CSRF على submit** | مؤكد | 🔴 | Supabase RLS + cookies SameSite=Lax (default). نتحقق. يضاف Origin check في endpoints |
| R14 | **تسرب `correct_index` عبر search snippets** | مؤكد | 🟡 | `noindex` على صفحات الحساب. مفتاح الإجابة ما كان أصلاً في index عبر exam data |
| R15 | **تعارض `admins.role` مع `students`** | مؤكد | 🟡 | لا تعامل مختلط. الترقية إلى أدمن = صف في `admins` منفصل. `students` لا تعرف `admins` |

---

## 14. معايير القبول (Acceptance Criteria)

### المصادقة
- [ ] AC1. يمكنني تسجيل الدخول بحساب Google من `/auth/login` — ينقلني `/` مع اسم المستخدم
- [ ] AC2. `/account` محمي — زائر يُعاد توجيهه `/auth/login`
- [ ] AC3. تسجيل خروج يمسح الكوكيز ويعود زائر
- [ ] AC4. `students` row يُنشأ تلقائياً عند أول login مع `oauth_provider='google'`
- [ ] AC5. لا يمكن لـ student تسجيل الدخول كـ admin في `apps/admin` (يُرفض بـ `is_staff=false`)

### حفظ البيانات
- [ ] AC6. امتحان مكتمل كطالب مسجّل → صف في `exam_attempts` (status='submitted')
- [ ] AC7. `attempt_answers` صف لكل سؤال
- [ ] AC8. `question_performance` صف لكل سؤال خطأ (أو صحيح) في محاولة
- [ ] AC9. `students.total_*` محدّثة
- [ ] AC10. امتحان كزائر → لا يتأثر السلوك (يعمل client-side فقط)

### الأمان
- [ ] AC11. `correct_option_index` غير موجود في HTML للطلبة المسجّلين
- [ ] AC12. `anon` لا يقرأ `students`/`exam_attempts`/`question_performance`
- [ ] AC13. طالب لا يقرأ `exam_questions` المعدّلة (لا كتابة)
- [ ] AC14. `submit` بـ `answer_hash` خاطئ → 400 مع رسالة
- [ ] AC15. replay لـ `submit` لنفس الـattempt → 400 (Already submitted)

### امتحان الأخطاء
- [ ] AC16. طالب عنده 10 أسئلة غلط في الرياضيات → `create_review_exam(رياضيات, 5)` يرجع 5 منها
- [ ] AC17. بعد إجابة سؤال خاطئ مرتين صحيحاً → `is_mastered=true` ويختفي من مرشحي الأخطاء
- [ ] AC18. `p_count=3` (أقل من 5) → validation error
- [ ] AC19. `p_count=100` (أكبر من 50) → validation error
- [ ] AC20. طالب بلا أخطاء → `create_review_exam` يرجع 0 + رسالة واضحة
- [ ] AC21. `p_include_unseen=true` يضيف أسئلة لم تُحاول

### لوحة التحكم
- [ ] AC22. تبويب "الطلاب" يظهر لـ super_admin ويعرض كل الطلاب
- [ ] AC23. البحث بالاسم/البريد يعمل
- [ ] AC24. Student Detail يعرض attempts + per-subject stats
- [ ] AC25. تعطيل طالب (`is_active=false`) → `requireStudent` يرفضه
- [ ] AC26. تبويب "الامتحانات والنتائج" يعرض كل المحاولات مع فلاتر
- [ ] AC27. تصدير CSV يعمل
- [ ] AC28. staff without `students.view` لا يرى التبويب ولا البيانات
- [ ] AC29. staff with `students.view` scoped لمادة واحدة يرى طلاب تلك المادة فقط

### جودة
- [ ] AC30. `npm run typecheck` يمر في `packages/types` + `apps/web` + `apps/admin`
- [ ] AC31. `npm run build` يمر في `apps/web` + `apps/admin`
- [ ] AC32. `supabase/tests/students/run.sh` يمر (كل assertions)
- [ ] AC33. RLS audit: 0 جداول بلا RLS، 0 anon grants على جداول الطلبة
- [ ] AC34. الصفحات المحمية ترجع `Cache-Control: private,no-store`
- [ ] AC35. `robots.txt` + meta `noindex` على صفحات الحساب

---

## 15. الملفات المعدّلة/المضافة (ملخص كامل)

###-phase 1-2: قاعدة البيانات + Types
```
+ supabase/migrations/20261001000000_student_auth.sql          (جديد)
+ supabase/migrations/20261001000001_student_rls.sql            (جديد)
+ supabase/migrations/20261001000002_student_functions.sql      (جديد)
+ supabase/migrations/20261001000003_student_permissions.sql    (جديد)
+ supabase/migrations/20261001000004_backfill.sql               (جديد)
+ supabase/tests/students/                                      (مجلد جديد)
    ├── run.sh
    ├── README.md
    ├── 00_bootstrap.sql
    ├── 01_fixtures.sql
    ├── 02_student_self_access.sql
    ├── 03_start_and_save.sql
    ├── 04_submit_and_grade.sql
    ├── 05_review_exam_creation.sql
    ├── 06_mastery_progression.sql
    ├── 07_rate_limit_and_integrity.sql
    ├── 08_admin_staff_access.sql
    ├── 09_cascade_delete.sql
    └── 10_anonymous_regression.sql
~ packages/types/src/database.ts                                (معدّل)
```

### phase 3-6: apps/web
```
+ apps/web/src/lib/auth-server.ts
+ apps/web/src/lib/auth-client.ts
+ apps/web/src/lib/student-api.ts
+ apps/web/src/pages/auth/login.astro
+ apps/web/src/pages/auth/callback.astro
+ apps/web/src/pages/auth/logout.ts
+ apps/web/src/pages/account/index.astro
+ apps/web/src/pages/account/wrong-questions.astro
+ apps/web/src/pages/review/index.astro
+ apps/web/src/pages/review/[attemptId].astro
+ apps/web/src/pages/api/exams/attempt/[id]/answer.ts
+ apps/web/src/pages/api/exams/attempt/[id]/submit.ts
+ apps/web/src/pages/api/exams/review/create.ts
~ apps/web/src/middleware.ts                                    (معدّل: +~40)
~ apps/web/src/pages/exams/[id].astro                          (معدّل: +~80)
~ apps/web/src/layouts/Layout.astro                             (معدّل: +~25)
~ apps/web/src/lib/geo.ts                                       (معدّل: +~20)
```

### phase 7: apps/admin
```
+ apps/admin/src/api/students.ts
+ apps/admin/src/api/attempts.ts
+ apps/admin/src/api/questionAnalytics.ts
+ apps/admin/src/components/StudentsManager.tsx
+ apps/admin/src/components/StudentDetailModal.tsx
+ apps/admin/src/components/AttemptsManager.tsx
+ apps/admin/src/components/QuestionAnalytics.tsx
~ apps/admin/src/App.tsx                                        (معدّل: +~25)
~ apps/admin/src/api/client.ts                                  (معدّل: +3)
~ apps/admin/src/api/_shared.ts                                 (معدّل: +~120)
```

### phase 8-9: توثيق
```
~ DEPLOYMENT.md                                               (معدّل: new env vars, migrations)
~ PROJECT_PLAN.md                                             (معدّل: link to new features)
+ STUDENT_AUTH_SETUP.md                                        (جديد: Google OAuth setup steps)
```

**إجمالي:** 25 ملف جديد، 9 ملف معدّل، 0 سطر كود محذوف من البنية الحالية.

---

## 16. Dependencies جديدة (npm)

| الحزمة | التطبيق | السبب | حجم |
|---|---|---|---|
| `@supabase/ssr` | `apps/web` | كوكي-based session في Astro SSR | ~10KB |
| ~~`@tanstack/react-query`~~ | موجودة في admin | — | — |
| ~~`@supabase/supabase-js`~~ | موجودة في كل مكان | — | — |

**لا حاجة لأي حزمة أخرى.** لا React في web (Astro components فقط) — التصميم vanilla JS مثل الموجود.

---

## 17. متغيرات البيئة الجديدة

### `apps/web/.env.example` (إضافة)
```bash
# Supabase (للـ SSR session فقط — لا يضيف صلاحية)
# نفس PUBLIC_SUPABASE_URL و PUBLIC_SUPABASE_ANON_KEY الموجودان
# لا نستخدم service_role من apps/web إطلاقاً
```

### `apps/admin/.env.example`
```bash
VITE_WEB_URL=http://localhost:4321   # موجود (used in push.ts)
# لا تغيير
```

### Supabase Dashboard → Edge Functions → admin-invite (إضافة)
```bash
ADMIN_INVITE_REDIRECT=https://admin.thanaya.com/#type=invite   # موجود
# لا تغيير
```

### Google Cloud Console
```
OAuth Client ID / Secret → تُدخل في Supabase Dashboard فقط
# لا تُخزَّن في أي .env
```

**ملاحظة:** **لا متغيرات بيئة جديدة مطلوبة** — فقط OAuth credentials في Supabase Dashboard (خارج الكود).

---

## 18. ملاحظات نهائية

### نمط الكود (.Code Style)
- SQL: lowercase, `if not exists`, تعليقات عربية على الأقسام المهمة, `set search_path = ''` لكل `SECURITY DEFINER`
- TypeScript: strict, named exports, arrow functions في `.astro` scripts
- عربي/إنجليزي: أسماء المتغيرات snake_case في SQL، camelCase في TS
- Frontend: vanilla JS في `.astro` (لا React في web), React hooks في admin, Tailwind 3

### تسمية قاعدة البيانات
- جداول الطالب: **جمع** (`students`, `exam_attempts`, `attempt_answers`)
- جداول المحتوى: **مفرد**现状 (`exams`, `resources`, `subjects`) — نحترم هذا
- دوال: snake_case مع بادئة `private.` للدوال الداخلية
- RPCs: snake_case عامة (مثل `get_my_permissions`)

### التزام الـ migrations
- **لا تعدّل migrations قائمة أبداً** (كما نص migration ⑧: "do not modify old migrations — this is a new file only")
- كل عملة جديدة = ملف جديد بعد `20260926000000`
- نضيف `IF NOT EXISTS` / `DROP ... IF EXISTS` → **idempotent**

### التوثيق
- نضيف كل الـ SQL comments بالعربي (مثل migration ⑧)
- `supabase/tests/students/README.md` يشرح كل سيناريو
- `STUDENT_AUTH_SETUP.md` يشرح خطوات إعداد Google خطوة بخطوة

---

## 19. الخطوات التالية المقترحة (ابدأ من هنا)

1. **اقرأ §2.6** (القرارات) وحسم Q1-Q6
2. **راجع §3 (Schema)** — هل التصميم يناسب؟ خصوصاً `question_performance` و `exam_attempts.mode='review'`
3. **راجع §6.2 (خوارزمية الاختيار)** — هل weight priority مناسب؟
4. **راجع §7 (لوحة التحكم)** — هل التبويبات الثلاثة كافية؟ تريد رابعاً (مثلاً "اشتباه غش")؟
5. **إذا موافق**: ابدأ بـ Phase 0 (backup + credentials) ثم Phase 1 (الـ migrations + tests)

---

*تم إنشاؤه Sep 2026. لم يُعدَّل أي سطر كود.*
*متوافق مع `admin-permissions-plan.md` و `geo-audit-plan.md` و `DEPLOYMENT.md`.*
