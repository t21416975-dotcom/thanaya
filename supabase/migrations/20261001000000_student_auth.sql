-- ============================================================================
-- Migration: Student Accounts, Exam Attempts & Smart Review Foundation
-- الملف: supabase/migrations/20261001000000_student_auth.sql
-- الهدف: إضافة نموذج بيانات الطالب ومحاولات الامتحان و"امتحان الأخطاء".
--
--   1. students              - حساب الطالب (مرتبط بـ auth.users عبر Google OAuth)
--   2. exam_questions (+col)  - denormalize subject_id + fingerprint + عدّادات
--   3. exam_attempts         - محاولة امتحان (exam / review / mock)
--   4. attempt_answers       - إجابة واحدة داخل محاولة
--   5. question_performance  - ★ مفتاح "امتحان الأخطاء": إحصاء إجابة الطالب per سؤال
--   6. student_subject_stats - تجميع per مادة (للوحة الطالب ولوحة التحكم)
--   7. rate_limits           - حماية من إساءة الاستخدام
--
-- ملاحظات معمارية:
--   - لا نلمس admins ولا مخطط private. الطالب مفهوم مستقل تماماً.
--   - exam_id في exam_attempts يقبل NULL لأن "امتحان الأخطاء" ليس صفاً في exams
--     (يبقى exams بمعناها: امتحان ثابت معروف لكل الطلاب → لا ينكسر SEO في geo.ts).
--   - correct_option_index يبقى في exam_questions كما هو (لا ترحيل) — الحجب
--     يتم على مستوى طبقة التسريب في apps/web وليس هنا.
--
-- Idempotent: يمكن تشغيله أكثر من مرة بأمان.
-- ملاحظة: لا تُعدّل أي migration قديمة — هذا ملف جديد فقط.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1.1) جدول الطلاب
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.students (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id          UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email                 TEXT NOT NULL,
    full_name             TEXT,
    avatar_url            TEXT,
    grade                 TEXT,
    phone                 TEXT,
    oauth_provider        TEXT NOT NULL DEFAULT 'google',
    email_verified        BOOLEAN NOT NULL DEFAULT false,
    is_active             BOOLEAN NOT NULL DEFAULT true,
    preferred_locale      TEXT NOT NULL DEFAULT 'ar',
    total_exams_taken     INTEGER NOT NULL DEFAULT 0,
    total_questions       INTEGER NOT NULL DEFAULT 0,
    total_correct         INTEGER NOT NULL DEFAULT 0,
    total_wrong           INTEGER NOT NULL DEFAULT 0,
    last_seen_at          TIMESTAMPTZ,
    last_login_provider   TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT students_grade_ck CHECK (grade IS NULL OR grade IN ('third','second','first'))
);

-- البريد غير حساس لحالة الأحرف في التطبيق → نطبّعه في الفهارس والدوال
CREATE UNIQUE INDEX IF NOT EXISTS students_auth_user_id_key
    ON public.students (auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS students_email_lower_key
    ON public.students (lower(email));
CREATE INDEX IF NOT EXISTS students_active_idx
    ON public.students (is_active, last_seen_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS students_created_idx
    ON public.students (created_at DESC);

DROP TRIGGER IF EXISTS set_students_updated_at ON public.students;
CREATE TRIGGER set_students_updated_at
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 1.2) denormalize على exam_questions
--      subject_id: يسمح بفلترة الأسئلة حسب المادة بدون JOIN على exams
--                 (أساس "امتحان الأخطاء" الذي لا يرتبط بامتحان واحد).
--      fingerprint: بصمة نصية للسؤالnormalized — تكشف التكرار بين الامتحانات.
--      times_*: إحصاء المنصة (لصف "أصعب الأسئلة" في لوحة التحكم).
-- ---------------------------------------------------------------------------

ALTER TABLE public.exam_questions
    ADD COLUMN IF NOT EXISTS subject_id      UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS fingerprint     TEXT,
    ADD COLUMN IF NOT EXISTS times_attempted INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS times_correct   INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_deleted      BOOLEAN NOT NULL DEFAULT false;

-- إصلاح drift قديم: exam_questions.image_url مستخدم في الواجهة
-- (packages/types + apps/admin/src/api/exams.ts + apps/web/src/pages/exams/[id].astro)
-- لكنه لم يُضَف في أي migration — أي أنه موجود في الإنتاج يدويًا فقط،
-- وقواعد جديدة لا تنشئه. نضيفه هنا بـ IF NOT EXISTS:
--   - على قواعد فيها العمود: لا شيء يتغير.
--   - على قواعد جديدة: يُنشأ، فتكتمل صورة السؤال في "امتحان الأخطاء".
ALTER TABLE public.exam_questions
    ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE INDEX IF NOT EXISTS exam_questions_subject_idx
    ON public.exam_questions (subject_id)
    WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS exam_questions_fingerprint_idx
    ON public.exam_questions (fingerprint)
    WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS exam_questions_hard_idx
    ON public.exam_questions (subject_id, times_correct ASC)
    WHERE is_deleted = false AND times_attempted > 0;

-- تطبيع النص العربي قبل البصمة: توحيد الألف والياء والتاء المربوطة وإخفاء
-- التشكيل والمسافات المكررة. لا نغيّر النص الأصلي المعروض للطالب.
CREATE OR REPLACE FUNCTION private.normalize_question_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    -- ★ نستخدم literal Unicode characters وليس \x{...} أو \p{L}:
    --   PostgreSQL لا تدعم هذين النمطين (ترمي خطأ invalid escape).
    --   ما تدعمه: POSIX classes [[:alnum:]] و \s.
    -- الخطوة 1: حذف التشكيل والتطويل (U+064B..U+0652, U+0670, U+0640)
    -- الخطوة 2: توحيد الهمزات والياء والألف
    -- الخطوة 3: حذف كل ما ليس حرفًا أو رقمًا أو مسافة
    -- الخطوة 4: دمج المسافات
    SELECT trim(regexp_replace(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(lower(coalesce(p_text, '')),
                            '[ً-ْٰـ]', '', 'g'),   -- تشكيل + تطويل
                        '[أإآٱ]', 'ا', 'g'),  -- أ إ آ ٱ -> ا
                    '[ىي]', 'ي', 'g'),                 -- ى ي -> ي
                '[ؤئ]', 'ء', 'g'),                     -- ؤ ئ -> ء
            '[^[:alnum:]\s]', '', 'g'),                             -- ترقيم ورموز
        '\s+', ' ', 'g'));
$$;

DROP TRIGGER IF EXISTS sync_question_subject ON public.exam_questions;
CREATE OR REPLACE FUNCTION private.sync_question_subject()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.exam_id IS NOT NULL THEN
        SELECT e.subject_id INTO NEW.subject_id
        FROM public.exams e
        WHERE e.id = NEW.exam_id;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER sync_question_subject
    BEFORE INSERT OR UPDATE OF exam_id ON public.exam_questions
    FOR EACH ROW
    EXECUTE FUNCTION private.sync_question_subject();

DROP TRIGGER IF EXISTS set_question_fingerprint ON public.exam_questions;
CREATE OR REPLACE FUNCTION private.set_question_fingerprint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- OLD غير مُعرَّف في triggers على INSERT، فنفحص العملية صراحةً
    IF TG_OP = 'INSERT'
       OR NEW.fingerprint IS NULL
       OR NEW.question_text IS DISTINCT FROM OLD.question_text THEN
        NEW.fingerprint := encode(
            sha256(convert_to(private.normalize_question_text(NEW.question_text), 'utf8')),
            'hex');
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER set_question_fingerprint
    BEFORE INSERT OR UPDATE OF question_text ON public.exam_questions
    FOR EACH ROW
    EXECUTE FUNCTION private.set_question_fingerprint();

-- ---------------------------------------------------------------------------
-- 1.3) محاولات الامتحان
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    exam_id             UUID REFERENCES public.exams(id) ON DELETE SET NULL,
    mode                TEXT NOT NULL DEFAULT 'exam'
                        CHECK (mode IN ('exam','review','mock')),
    subject_id          UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    source_attempt_id   UUID REFERENCES public.exam_attempts(id) ON DELETE SET NULL,
    status              TEXT NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress','submitted','abandoned','expired')),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ,
    submitted_at        TIMESTAMPTZ,
    time_spent_seconds  INTEGER NOT NULL DEFAULT 0,
    total_questions     INTEGER NOT NULL DEFAULT 0,
    answered_count      INTEGER NOT NULL DEFAULT 0,
    correct_count       INTEGER NOT NULL DEFAULT 0,
    wrong_count         INTEGER NOT NULL DEFAULT 0,
    blank_count         INTEGER NOT NULL DEFAULT 0,
    score_percentage    NUMERIC(5,2),
    flagged_suspicious  BOOLEAN NOT NULL DEFAULT false,
    flag_reason         TEXT,
    -- answer_token: بصمة HMAC واحدة لكل المحاولة، مربوطة بمعرّفات الأسئلة
    -- ومفاتيح إجاباتها. تُولَّد عند start وتُطلب عند submit.
    -- ★ تجزئة واحدة للمحاولة كلها (وليس لكل سؤال) عمدًا: لو وزّعنا هاش
    --   لكل سؤال، كانت 4 محاولات لكل هاش كافية لكشف كل الإجابات.
    answer_token        TEXT,
    ip_address          INET,
    user_agent          TEXT,
    question_set        JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT exam_attempts_counts_ck CHECK (
        answered_count >= 0 AND correct_count >= 0 AND wrong_count >= 0 AND blank_count >= 0
        -- ★ القيد الذهبي يسري عند التسليم فقط. أثناء المحاولة (in_progress)
        --   لم تُحسب الإجابات بعد، فالزام answered+blank = total
        --   كان يمنع إنشاء المحاولة أصلًا.
        AND (status <> 'submitted' OR answered_count + blank_count = total_questions)
    ),
    CONSTRAINT exam_attempts_score_ck CHECK (
        score_percentage IS NULL OR (score_percentage >= 0 AND score_percentage <= 100)
    )
);

CREATE INDEX IF NOT EXISTS exam_attempts_student_started_idx
    ON public.exam_attempts (student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS exam_attempts_subject_started_idx
    ON public.exam_attempts (subject_id, started_at DESC);
CREATE INDEX IF NOT EXISTS exam_attempts_exam_idx
    ON public.exam_attempts (exam_id, started_at DESC)
    WHERE exam_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS exam_attempts_review_idx
    ON public.exam_attempts (source_attempt_id)
    WHERE mode = 'review';
CREATE INDEX IF NOT EXISTS exam_attempts_status_idx
    ON public.exam_attempts (status, submitted_at DESC)
    WHERE status = 'submitted';
-- نُبقي "المحاولات المفتوحة" قليلة جداً: فهرس جزئي صغير
CREATE INDEX IF NOT EXISTS exam_attempts_open_idx
    ON public.exam_attempts (expires_at)
    WHERE status = 'in_progress';

-- ---------------------------------------------------------------------------
-- 1.4) إجابات المحاولة
--      answer_hash: HMAC يثبت أن الإجابة المُرسلة من طرفنا (النظام) وليست
--      تخميناً من العميل — راجع submit_exam_attempt في migration الوظائف.
--      during_review: هل انتهت الإجابة بتبويب "امتحان الأخطاء".
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attempt_answers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id         UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    question_id        UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    selected_index     SMALLINT CHECK (selected_index >= 0 AND selected_index <= 3),
    is_correct         BOOLEAN,
    is_blank           BOOLEAN NOT NULL DEFAULT true,
    answer_hash        TEXT,
    during_review      BOOLEAN NOT NULL DEFAULT false,
    answered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_taken_seconds INTEGER,
    UNIQUE (attempt_id, question_id),
    CONSTRAINT attempt_answers_ck CHECK (
        (is_blank AND selected_index IS NULL)
        OR (NOT is_blank AND selected_index IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS attempt_answers_question_idx
    ON public.attempt_answers (question_id);
CREATE INDEX IF NOT EXISTS attempt_answers_wrong_idx
    ON public.attempt_answers (question_id, answered_at DESC)
    WHERE is_correct = false;
CREATE INDEX IF NOT EXISTS attempt_answers_review_idx
    ON public.attempt_answers (during_review, is_correct);

-- ---------------------------------------------------------------------------
-- 1.5) ★ question_performance — جدول "امتحان الأخطاء"
--      صف لكل (طالب × سؤال). question_performance هو مصدر الحقيقة الوحيد
--      لخوارزمية اختيار أسئلة المراجعة ولوحة "أخطأت فيها".
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.question_performance (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    question_id         UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    subject_id          UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    exam_id             UUID REFERENCES public.exams(id) ON DELETE SET NULL,

    times_seen          SMALLINT NOT NULL DEFAULT 0,
    times_correct       SMALLINT NOT NULL DEFAULT 0,
    times_wrong         SMALLINT NOT NULL DEFAULT 0,
    consecutive_wrong   SMALLINT NOT NULL DEFAULT 0,
    last_wrong_at       TIMESTAMPTZ,
    last_seen_at        TIMESTAMPTZ,
    is_mastered         BOOLEAN NOT NULL DEFAULT false,
    mastery_confidence  NUMERIC(4,3) NOT NULL DEFAULT 0,
    first_attempted_at  TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (student_id, question_id),
    -- ★ times_seen = عدد مرات ظهور السؤال في محاولات مسلَّمة.
    --   times_correct + times_wrong ≤ times_seen وليس = :
    --   السؤال الذي تُرك بلا إجابة يُحسب "ظهور" لا "خطأ" (is_correct = NULL)،
    --   لأن الطالب لم يخطئ — لم يجب أصلًا. ولا يغذّي امتحان الأخطاء
    --   لأن المرشحون مُفلترون بـ times_wrong > 0.
    CONSTRAINT question_performance_counts_ck CHECK (
        times_seen >= 0 AND times_correct >= 0 AND times_wrong >= 0
        AND times_correct + times_wrong <= times_seen
    ),
    CONSTRAINT question_performance_consecutive_ck CHECK (consecutive_wrong >= 0)
);

-- المرشحون لامتحان الأخطاء: لم يتقن + أخطأ مرة على الأقل
CREATE INDEX IF NOT EXISTS question_perf_review_candidates_idx
    ON public.question_performance (student_id, subject_id, last_wrong_at DESC NULLS LAST)
    WHERE is_mastered = false AND times_wrong > 0;
-- إحصاء المادة عند الطالب
CREATE INDEX IF NOT EXISTS question_perf_by_subject_idx
    ON public.question_performance (student_id, subject_id);
-- أصعب الأسئلة على مستوى المنصة (للوحة التحكم)
CREATE INDEX IF NOT EXISTS question_perf_platform_hard_idx
    ON public.question_performance (question_id, times_wrong DESC);
-- بحث اللوحة التحكم: أخطاء طالب في مادة
CREATE INDEX IF NOT EXISTS question_perf_student_wrong_idx
    ON public.question_performance (student_id, times_wrong DESC)
    WHERE is_mastered = false;

DROP TRIGGER IF EXISTS set_question_performance_updated_at ON public.question_performance;
CREATE TRIGGER set_question_performance_updated_at
    BEFORE UPDATE ON public.question_performance
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 1.6) تجميع per مادة — يملؤه submit_exam_attempt
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_subject_stats (
    student_id           UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id           UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    attempts_count       INTEGER NOT NULL DEFAULT 0,
    total_questions      INTEGER NOT NULL DEFAULT 0,
    total_correct        INTEGER NOT NULL DEFAULT 0,
    avg_score            NUMERIC(5,2),
    best_score           NUMERIC(5,2),
    wrong_questions_count INTEGER NOT NULL DEFAULT 0,
    mastered_questions_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at      TIMESTAMPTZ,
    PRIMARY KEY (student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS student_subject_stats_subject_idx
    ON public.student_subject_stats (subject_id, avg_score DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- 1.7) rate_limits — حماية endpoints من الإرسال المتكرر
--      المفتاح = hash(action + user id) — لا نخزّن IP خامًا.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rate_limits (
    bucket        TEXT PRIMARY KEY,
    hits          INTEGER NOT NULL DEFAULT 0,
    window_start  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON public.rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- 1.8) إعدادات نظامية جديدة (تُقرأ عبر RPC — للمدير فقط)
-- ---------------------------------------------------------------------------

INSERT INTO public.system_settings (key, value, description) VALUES
    ('student_review_min_questions', '5',
     'الحد الأدنى لعدد أسئلة "امتحان الأخطاء" الذي يمكن للطالب اختياره'),
    ('student_review_max_questions', '30',
     'الحد الأقصى لعدد أسئلة "امتحان الأخطاء"'),
    ('student_review_default_questions', '10',
     'العدد الافتراضي لأسئلة "امتحان الأخطاء"'),
    ('student_show_explanations', 'true',
     'إظهار الشروح بعد التسليم (يتحكم فيه المدير من لوحة الإعدادات)')
ON CONFLICT (key) DO NOTHING;
