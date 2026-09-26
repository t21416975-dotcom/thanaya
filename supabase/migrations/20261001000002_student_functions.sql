-- ============================================================================
-- Migration: Student Auth & Smart Review Functions
-- الملف: supabase/migrations/20261001000002_student_functions.sql
-- الهدف: كل منطق الطالب عبر دوال SECURITY DEFINER — بما فيها التصحيح
--       و"امتحان الأخطاء". العميل لا يملك أي صلاحية كتابة مباشرة.
--
-- الدوال العامة (public):
--   الطالب:  bootstrap_student · update_own_profile · start_exam_attempt ·
--            save_answer · submit_exam_attempt · create_review_exam ·
--            get_attempt_questions · abandon_attempt · get_my_dashboard ·
--            get_my_wrong_questions · delete_my_account
--   الإدارة: list_admin_students · get_admin_student_detail ·
--            get_admin_attempts · get_admin_attempt_detail ·
--            get_question_analytics · admin_set_student_active ·
--            admin_flag_attempt · admin_delete_attempt · admin_delete_student_data
--
-- ★ كل الدوال: SET search_path = '' + REVOKE ... FROM PUBLIC, anon
--   + GRANT EXECUTE TO authenticated. لا استدعاء مجهول الهوية أبدًا.
--
-- Idempotent: يمكن تشغيله أكثر من مرة بأمان.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 3.0) مفتاح التحقق من سلامة المحاولة
--      لا نستخدم environment variable لأن الـ RPC تعمل داخل Postgres،
--      فنخزّن سرًا عشوائيًا في جدول داخل مخطط private.
--
--      ★ نستخدم sha256() المدمج في PostgreSQL 11+ بدل hmac() من pgcrypto،
--        لأن pgcrypto على Supabase يقع في مخطط 'extensions' ويحتاج
--        qualification، ولا نريد اعتمادًا على امتداد غير مضمون.
--        الحماية من length-extension تتحقق بتغليف السر على الجانبين:
--            H(secret || payload || secret)
--        وهو آمن لأن السر مجهول للعميل ولا يمكن تمديد هذه التجزئة.
--
--      ★ نبني السر من gen_random_uuid() (مدمج في PG13+) لا من
--        gen_random_bytes الذي يتطلب pgcrypto.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS private.app_secrets (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON private.app_secrets FROM PUBLIC;
REVOKE ALL ON private.app_secrets FROM anon;

-- مولّد عشوائي (32 بايت = 64 حرف hex) بدون أي امتداد
CREATE OR REPLACE FUNCTION private.random_secret()
RETURNS TEXT
LANGUAGE sql
VOLATILE
AS $$
    SELECT replace(
        gen_random_uuid()::text || gen_random_uuid()::text
        || gen_random_uuid()::text || gen_random_uuid()::text,
        '-', '');
$$;

CREATE OR REPLACE FUNCTION private.app_secret(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v TEXT;
BEGIN
    SELECT s.value INTO v FROM private.app_secrets s WHERE s.key = p_key;
    IF v IS NULL THEN
        v := private.random_secret();
        INSERT INTO private.app_secrets (key, value) VALUES (p_key, v)
        ON CONFLICT (key) DO NOTHING;
        SELECT s.value INTO v FROM private.app_secrets s WHERE s.key = p_key;
    END IF;
    RETURN v;
END;
$$;

INSERT INTO private.app_secrets (key, value)
VALUES ('answer_token', private.random_secret())
ON CONFLICT (key) DO NOTHING;

-- دالة التجزئة الوحيدة — أي تغيير في طريقة الحساب يبقى في مكان واحد
CREATE OR REPLACE FUNCTION private.token_hash(p_payload TEXT)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT encode(
        sha256(convert_to(
            private.app_secret('answer_token')
            || coalesce(p_payload, '')
            || private.app_secret('answer_token'),
            'utf8')),
        'hex');
$$;

-- ---------------------------------------------------------------------------
-- 3.1) أدوات خاصة
-- ---------------------------------------------------------------------------

-- صف الطالب النشط (NULL إن لم يسجّل الدخول أو كان معطّلًا).
-- لا ترمي استثناء — تُستخدم في سياسات RLS وفي الفحوص غير المميّزة.
CREATE OR REPLACE FUNCTION private.current_student_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT s.id
    FROM public.students s
    WHERE s.auth_user_id = (SELECT auth.uid())
      AND s.is_active = true
    LIMIT 1;
$$;

-- نفس الدالة لكن ترمي استثناءً — كل entry point للطالب يستخدمها.
CREATE OR REPLACE FUNCTION private.require_student()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_student UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'يجب تسجيل الدخول أولاً' USING ERRCODE = '42501';
    END IF;

    SELECT s.id INTO v_student
    FROM public.students s
    WHERE s.auth_user_id = (SELECT auth.uid())
      AND s.is_active = true;

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'الحساب غير موجود أو معطّل' USING ERRCODE = '42501';
    END IF;

    RETURN v_student;
END;
$$;

-- حد المعدّل: يعيد true إذا ما زلنا ضمن الحد.
CREATE OR REPLACE FUNCTION private.rate_check(p_bucket TEXT, p_max INTEGER, p_window INTERVAL)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_hits INTEGER;
BEGIN
    INSERT INTO public.rate_limits AS rl (bucket, hits, window_start)
         VALUES (p_bucket, 1, now())
    ON CONFLICT (bucket) DO UPDATE
        SET hits = CASE
                      WHEN rl.window_start < now() - p_window THEN 1
                      ELSE rl.hits + 1
                    END,
            window_start = CASE
                      WHEN rl.window_start < now() - p_window THEN now()
                      ELSE rl.window_start
                    END
    RETURNING rl.hits INTO v_hits;

    RETURN v_hits <= p_max;
END;
$$;

-- درجة الإتقان (0..1) — بسيطة وقابلة للتفسير للطالب
CREATE OR REPLACE FUNCTION private.mastery_score(p_seen INTEGER, p_correct INTEGER)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN COALESCE(p_correct,0) >= 2 THEN 1.000
        WHEN COALESCE(p_seen,0)   >= 3 THEN 0.850
        WHEN COALESCE(p_seen,0)   = 2 THEN 0.700
        WHEN COALESCE(p_seen,0)   = 1 THEN 0.500
        ELSE 0.000
    END::NUMERIC;
$$;

-- إتقان السؤال = إجابتين صحيحتين
CREATE OR REPLACE FUNCTION private.is_mastered(p_times_correct INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(p_times_correct, 0) >= 2;
$$;

-- قراءة إعداد نظامي نصي بقيمة افتراضية
CREATE OR REPLACE FUNCTION private.setting_text(p_key TEXT, p_default TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        (SELECT s.value FROM public.system_settings s WHERE s.key = p_key),
        p_default);
$$;

CREATE OR REPLACE FUNCTION private.setting_int(p_key TEXT, p_default INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN COALESCE(private.setting_text(p_key, p_default::text)::int, p_default);
EXCEPTION WHEN OTHERS THEN
    RETURN p_default;
END;
$$;

-- تسجيل في admin_activity_log — الفشل هنا لا يُسقط العملية الأصلية
CREATE OR REPLACE FUNCTION private.log_activity(
    p_action TEXT, p_entity TEXT, p_entity_id TEXT, p_diff JSONB DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.admin_activity_log (action, entity, entity_id, diff)
    VALUES (p_action, p_entity, p_entity_id, p_diff);
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.2) compute_attempt_token — HMAC على (المحاولة + القائمة + مفاتيح الإجابة)
--      ★ تجزئة واحدة تغطي كل أسئلة المحاولة — عمدًا. لو وزّعنا هاش لكل سؤال
--        على حدة، كانت 4 محاولات لكل هاش كافية لكشف كل الإجابات.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.compute_attempt_token(p_attempt_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT private.token_hash(
        concat_ws('|',
            a.id::text,
            a.student_id::text,
            COALESCE(string_agg(
                q.id::text || ':' || q.correct_option_index::text,
                ',' ORDER BY q.question_number, q.id::text
            ), 'EMPTY')
        ))
    FROM public.exam_attempts a
    JOIN public.attempt_answers aa ON aa.attempt_id = a.id
    JOIN public.exam_questions q  ON q.id = aa.question_id
    WHERE a.id = p_attempt_id
    GROUP BY a.id, a.student_id;
$$;

-- ---------------------------------------------------------------------------
-- 3.3) recompute_student_performance — إعادة بناء إحصاءات طالب من محاولاته
--      تُستخدم بعد حذف محاولة يدويًا حتى لا تبقى أرقام خاطئة.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.recompute_student_performance(p_student_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- 1) كل إجابة مؤرَّخة، مع عدّاد الأخطاء المتتالية من آخر محاولة.
    --    المجموع التراكمي (+1 للخطأ و-1 للصحيح) يصل للصفر عند أول إجابة صحيحة،
    --    لذا قيمته عند أحدث صف هي بالضبط عدد الأخطاء المتتالية.
    CREATE TEMP TABLE _recomp ON COMMIT DROP AS
    SELECT aa.question_id,
           a.subject_id,
           a.exam_id,
           aa.is_correct,
           aa.answered_at,
           a.submitted_at,
           sum(CASE WHEN aa.is_correct THEN -1 ELSE 1 END) OVER win AS trailing_wrong
    FROM public.attempt_answers aa
    JOIN public.exam_attempts a ON a.id = aa.attempt_id
    WHERE a.student_id = p_student_id
      AND a.status = 'submitted'
      AND aa.is_correct IS NOT NULL
    WINDOW win AS (PARTITION BY aa.question_id
                   ORDER BY a.submitted_at DESC, aa.answered_at DESC
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW);

    -- 2) إعادة بناء question_performance
    DELETE FROM public.question_performance WHERE student_id = p_student_id;

    INSERT INTO public.question_performance (
        student_id, question_id, subject_id, exam_id,
        times_seen, times_correct, times_wrong, consecutive_wrong,
        last_wrong_at, last_seen_at, is_mastered, mastery_confidence, first_attempted_at)
    SELECT
        p_student_id,
        r.question_id,
        (array_agg(r.subject_id    ORDER BY r.submitted_at DESC))[1],
        (array_agg(r.exam_id       ORDER BY r.submitted_at DESC))[1],
        count(*)::int,
        count(*) FILTER (WHERE r.is_correct)::int,
        count(*) FILTER (WHERE NOT r.is_correct)::int,
        GREATEST(0, (array_agg(r.trailing_wrong
                               ORDER BY r.submitted_at DESC, r.answered_at DESC))[1]),
        max(r.answered_at) FILTER (WHERE NOT r.is_correct),
        max(r.answered_at),
        private.is_mastered(count(*) FILTER (WHERE r.is_correct)::int),
        private.mastery_score(count(*)::int, count(*) FILTER (WHERE r.is_correct)::int),
        min(r.answered_at)
    FROM _recomp r
    GROUP BY r.question_id;

    -- 3) عدّادات الطالب الإجمالية
    UPDATE public.students s
       SET total_exams_taken = COALESCE(agg.attempts, 0),
           total_questions   = COALESCE(agg.questions, 0),
           total_correct     = COALESCE(agg.correct, 0),
           total_wrong       = COALESCE(agg.wrong, 0),
           updated_at        = now()
    FROM (
        SELECT count(*)::int AS attempts,
               COALESCE(sum(a.total_questions), 0)::int AS questions,
               COALESCE(sum(a.correct_count), 0)::int  AS correct,
               COALESCE(sum(a.wrong_count), 0)::int    AS wrong
        FROM public.exam_attempts a
        WHERE a.student_id = p_student_id AND a.status = 'submitted'
    ) agg
    WHERE s.id = p_student_id;

    -- 4) تجميع المواد
    DELETE FROM public.student_subject_stats WHERE student_id = p_student_id;

    INSERT INTO public.student_subject_stats (
        student_id, subject_id, attempts_count, total_questions, total_correct,
        avg_score, best_score, last_attempt_at)
    SELECT
        p_student_id, a.subject_id,
        count(*)::int,
        COALESCE(sum(a.total_questions), 0)::int,
        COALESCE(sum(a.correct_count), 0)::int,
        round(avg(a.score_percentage), 2),
        max(a.score_percentage),
        max(a.submitted_at)
    FROM public.exam_attempts a
    WHERE a.student_id = p_student_id AND a.status = 'submitted'
    GROUP BY a.subject_id;

    -- 5) عدّادات الغلط/الإتقان لكل مادة
    UPDATE public.student_subject_stats ss
       SET wrong_questions_count    = COALESCE(agg.wrong_cnt, 0),
           mastered_questions_count = COALESCE(agg.mastered_cnt, 0)
    FROM (
        SELECT qp.subject_id,
               count(*) FILTER (WHERE NOT qp.is_mastered AND qp.times_wrong > 0)::int AS wrong_cnt,
               count(*) FILTER (WHERE qp.is_mastered)::int AS mastered_cnt
        FROM public.question_performance qp
        WHERE qp.student_id = p_student_id
        GROUP BY qp.subject_id
    ) agg
    WHERE ss.student_id = p_student_id AND ss.subject_id = agg.subject_id;

    DROP TABLE IF EXISTS _recomp;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.4) bootstrap_student — إنشاء/تحديث صف الطالب بعد تسجيل دخول Google
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bootstrap_student()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid       UUID := auth.uid();
    v_email     TEXT;
    v_meta      JSONB;
    v_confirmed TIMESTAMPTZ;
    v_provider  TEXT;
    v_name      TEXT;
    v_avatar    TEXT;
    v_result    JSONB;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'يجب تسجيل الدخول أولاً' USING ERRCODE = '42501';
    END IF;

    SELECT u.email, u.raw_user_meta_data, u.email_confirmed_at
      INTO v_email, v_meta, v_confirmed
    FROM auth.users u
    WHERE u.id = v_uid;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'لا يوجد بريد إلكتروني للحساب' USING ERRCODE = '22023';
    END IF;

    -- المزوّد: نفحص identities إن أمكن، وإلا نفترض google
    BEGIN
        SELECT i.provider INTO v_provider
        FROM auth.identities i
        WHERE i.user_id = v_uid
        ORDER BY (i.provider = 'google') DESC
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_provider := NULL;
    END;
    v_provider := COALESCE(v_provider, 'google');

    v_name   := NULLIF(trim(COALESCE(v_meta ->> 'full_name', v_meta ->> 'name', '')), '');
    v_avatar := NULLIF(trim(COALESCE(v_meta ->> 'picture', v_meta ->> 'avatar_url', '')), '');

    -- ON CONFLICT لا يمسّ is_active: الحساب المعطّل يبقى معطّلًا دائمًا.
    INSERT INTO public.students AS s (
        auth_user_id, email, full_name, avatar_url,
        oauth_provider, email_verified, is_active, last_seen_at, last_login_provider)
    VALUES (
        v_uid, lower(v_email), v_name, v_avatar,
        v_provider, (v_confirmed IS NOT NULL), true, now(), v_provider)
    ON CONFLICT (auth_user_id) DO UPDATE
        SET full_name           = COALESCE(EXCLUDED.full_name, s.full_name),
            avatar_url          = COALESCE(EXCLUDED.avatar_url, s.avatar_url),
            email               = EXCLUDED.email,
            email_verified      = s.email_verified OR EXCLUDED.email_verified,
            last_seen_at        = now(),
            last_login_provider = EXCLUDED.last_login_provider,
            updated_at          = now()
    RETURNING jsonb_build_object(
        'student_id', s.id,
        'email',      s.email,
        'full_name',  s.full_name,
        'avatar_url', s.avatar_url,
        'is_active',  s.is_active,
        'provider',   s.oauth_provider
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.5) update_own_profile — قائمة بيضاء صريحة
--      is_active و total_* مستبعدة بنيويًا (غير موجودة في التوقيع).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_own_profile(
    p_full_name  TEXT DEFAULT NULL,
    p_phone      TEXT DEFAULT NULL,
    p_grade      TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_locale     TEXT DEFAULT NULL)
RETURNS public.students
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_student UUID; v_row public.students%ROWTYPE;
BEGIN
    v_student := private.require_student();

    UPDATE public.students s
       SET full_name        = COALESCE(NULLIF(trim(p_full_name), ''), s.full_name),
           phone            = COALESCE(NULLIF(trim(p_phone), ''), s.phone),
           grade            = COALESCE(NULLIF(trim(p_grade), ''), s.grade),
           avatar_url       = COALESCE(NULLIF(trim(p_avatar_url), ''), s.avatar_url),
           preferred_locale = COALESCE(NULLIF(trim(p_locale), ''), s.preferred_locale),
           updated_at       = now()
     WHERE s.id = v_student
    RETURNING s.* INTO v_row;

    RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.6) start_exam_attempt — بدء/استئناف محاولة
--      يرجع attempt_id + questions (بلا correct_index ولا explanation)
--            + answer_token + expires_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_exam_attempt(
    p_exam_id UUID,
    p_mode    TEXT DEFAULT 'exam')
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student    UUID := private.require_student();
    v_exam       public.exams%ROWTYPE;
    v_existing   UUID;
    v_attempt    UUID;
    v_token      TEXT;
    v_questions  JSONB;
    v_created    BOOLEAN := false;
BEGIN
    IF p_mode IS NULL OR p_mode NOT IN ('exam','mock') THEN
        RAISE EXCEPTION 'نوع المحاولة غير صالح' USING ERRCODE = '22023';
    END IF;

    SELECT e.* INTO v_exam FROM public.exams e WHERE e.id = p_exam_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الامتحان غير موجود' USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_exam.is_published THEN
        RAISE EXCEPTION 'الامتحان غير منشور' USING ERRCODE = '42501';
    END IF;

    -- استئناف محاولة مفتوحة سابقة إن وُجدت (بدل إنشاء جديد)
    SELECT a.id INTO v_existing
    FROM public.exam_attempts a
    WHERE a.student_id = v_student
      AND a.exam_id = p_exam_id
      AND a.status = 'in_progress'
      AND (a.expires_at IS NULL OR a.expires_at > now())
    ORDER BY a.started_at DESC
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
        v_attempt := v_existing;
    ELSE
        INSERT INTO public.exam_attempts (
            student_id, exam_id, mode, subject_id, status, expires_at, total_questions)
        VALUES (
            v_student, v_exam.id, p_mode, v_exam.subject_id, 'in_progress',
            now() + make_interval(mins => v_exam.time_limit_minutes),
            (SELECT count(*)::int FROM public.exam_questions q
              WHERE q.exam_id = v_exam.id AND q.is_deleted = false))
        RETURNING id INTO v_attempt;

        -- حجز صف لكل سؤال: هذا يثبّت مجموعة الأسئلة التي سيُحسب عليها التوكن
        INSERT INTO public.attempt_answers (attempt_id, question_id, is_blank)
        SELECT v_attempt, q.id, true
        FROM public.exam_questions q
        WHERE q.exam_id = v_exam.id AND q.is_deleted = false
        ON CONFLICT (attempt_id, question_id) DO NOTHING;

        v_created := true;
    END IF;

    v_token := private.compute_attempt_token(v_attempt);
    UPDATE public.exam_attempts SET answer_token = v_token WHERE id = v_attempt;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', q.id,
               'number', q.question_number,
               'text', q.question_text,
               'options', q.options,
               'image_url', q.image_url
           ) ORDER BY q.question_number), '[]'::jsonb)
    INTO v_questions
    FROM public.attempt_answers aa
    JOIN public.exam_questions q ON q.id = aa.question_id
    WHERE aa.attempt_id = v_attempt;

    RETURN jsonb_build_object(
        'attempt_id', v_attempt,
        'exam_id', v_exam.id,
        'exam_title', v_exam.title,
        'subject_id', v_exam.subject_id,
        'mode', p_mode,
        'is_new', v_created,
        'started_at', a.started_at,
        'expires_at', a.expires_at,
        'time_limit_minutes', v_exam.time_limit_minutes,
        'total_questions', a.total_questions,
        'answer_token', v_token,
        'questions', v_questions
    )
    FROM public.exam_attempts a
    WHERE a.id = v_attempt;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.7) save_answer — حفظ إجابة واحدة (sendBeacon أثناء الامتحان)
--      لا تصحيح هنا: التصحيح كله في submit، حتى لا تُكشف النتيجة تدريجيًا.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_answer(
    p_attempt_id     UUID,
    p_question_id    UUID,
    p_selected_index SMALLINT,
    p_time_taken     INTEGER DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student UUID := private.require_student();
    v_status  TEXT;
    v_expires TIMESTAMPTZ;
    v_ok      BOOLEAN;
    v_reserved BOOLEAN;
BEGIN
    v_ok := private.rate_check(
        'save_answer:' || v_student::text, 600, interval '1 hour');
    IF NOT v_ok THEN
        RAISE EXCEPTION 'تم تجاوز الحد المسموح من طلبات الحفظ' USING ERRCODE = '42901';
    END IF;

    SELECT a.status, a.expires_at INTO v_status, v_expires
    FROM public.exam_attempts a
    WHERE a.id = p_attempt_id AND a.student_id = v_student;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'المحاولة غير موجودة' USING ERRCODE = 'P0002';
    END IF;
    IF v_status <> 'in_progress' THEN
        RAISE EXCEPTION 'المحاولة غير متاحة' USING ERRCODE = '42501';
    END IF;
    IF v_expires IS NOT NULL AND v_expires < now() THEN
        UPDATE public.exam_attempts SET status = 'expired' WHERE id = p_attempt_id;
        RAISE EXCEPTION 'انتهى وقت المحاولة' USING ERRCODE = '42501';
    END IF;

    -- ★ السؤال يجب أن يكون محجوزًا في هذه المحاولة بالذات.
    --   لولا هذا الحارس لـ INSERT إجابة لسؤال خارج المحاولة (من محاولة أخرى
    --   أو سؤال من خارجها) — وهو ما كان سيغيّر مجموعة أسئلة المحاولة
    --   ويُبطل توكن السلامة. الآن نرفضه برسالة واضحة.
    SELECT EXISTS (
        SELECT 1 FROM public.attempt_answers aa
        WHERE aa.attempt_id = p_attempt_id AND aa.question_id = p_question_id
    ) INTO v_reserved;

    IF NOT v_reserved THEN
        RAISE EXCEPTION 'السؤال لا ينتمي لهذه المحاولة' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.attempt_answers AS aa (
        attempt_id, question_id, selected_index, is_blank, is_correct, time_taken_seconds)
    VALUES (
        p_attempt_id, p_question_id, p_selected_index,
        (p_selected_index IS NULL), NULL, p_time_taken)
    ON CONFLICT (attempt_id, question_id) DO UPDATE
        SET selected_index     = EXCLUDED.selected_index,
            is_blank           = EXCLUDED.is_blank,
            is_correct         = NULL,
            time_taken_seconds = EXCLUDED.time_taken_seconds,
            answered_at        = now();
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.8) submit_exam_attempt — ★ التصحيح + performance + الإحصاءات
--      قلب النظام: كل الحسابات هنا (السيرفر). لا شيء في المتصفح.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_exam_attempt(
    p_attempt_id UUID,
    p_token      TEXT,
    p_time_spent INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student   UUID := private.require_student();
    v_attempt   public.exam_attempts%ROWTYPE;
    v_expected  TEXT;
    v_correct   INTEGER := 0;
    v_wrong     INTEGER := 0;
    v_blank     INTEGER := 0;
    v_total     INTEGER := 0;
    v_pct       NUMERIC(5,2);
    v_is_review BOOLEAN;
    v_answers   JSONB;
    v_still_wrong JSONB;
BEGIN
    IF NOT private.rate_check('submit:' || v_student::text, 30, interval '10 minutes') THEN
        RAISE EXCEPTION 'تم تجاوز عدد محاولات التسليم' USING ERRCODE = '42901';
    END IF;

    SELECT a.* INTO v_attempt
    FROM public.exam_attempts a
    WHERE a.id = p_attempt_id AND a.student_id = v_student
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المحاولة غير موجودة' USING ERRCODE = 'P0002';
    END IF;
    IF v_attempt.status <> 'in_progress' THEN
        RAISE EXCEPTION 'تم تسليم هذه المحاولة مسبقًا' USING ERRCODE = '42501';
    END IF;

    -- ★ سلامة الإجابات: التوكن الذي استلمه العميل عند البدء يجب أن يطابق
    --   ما تحسبه القاعدة الآن. يمنع الإرسال بهاش مفقود أو مُزوَّر.
    v_expected := private.compute_attempt_token(p_attempt_id);
    IF v_expected IS NULL
       OR v_expected IS DISTINCT FROM v_attempt.answer_token
       OR p_token IS NULL
       OR p_token IS DISTINCT FROM v_attempt.answer_token THEN
        RAISE EXCEPTION 'تعذّر التحقق من سلامة المحاولة' USING ERRCODE = '42501';
    END IF;

    IF v_attempt.expires_at IS NOT NULL AND v_attempt.expires_at < now() THEN
        UPDATE public.exam_attempts
           SET status = 'expired', submitted_at = now()
         WHERE id = p_attempt_id;
        RAISE EXCEPTION 'انتهى وقت المحاولة' USING ERRCODE = '42501';
    END IF;

    v_is_review := (v_attempt.mode = 'review');

    -- 1) تصحيح كل إجابة + بصمة تدقيق لكل إجابة
    UPDATE public.attempt_answers aa
       SET is_correct  = (q.correct_option_index = aa.selected_index),
           is_blank    = (aa.selected_index IS NULL),
           answer_hash = private.token_hash(
               concat_ws('|', v_attempt.answer_token, aa.question_id::text,
                         COALESCE(aa.selected_index::text, 'blank')))
      FROM public.exam_questions q
     WHERE aa.attempt_id = p_attempt_id
       AND q.id = aa.question_id;

    -- 2) العدّادات
    SELECT count(*) FILTER (WHERE is_correct),
           count(*) FILTER (WHERE is_correct = false),
           count(*) FILTER (WHERE is_blank),
           count(*)::int
    INTO v_correct, v_wrong, v_blank, v_total
    FROM public.attempt_answers
    WHERE attempt_id = p_attempt_id;

    v_pct := CASE WHEN v_total = 0 THEN NULL
                  ELSE round((v_correct::NUMERIC / v_total) * 100, 2) END;

    -- 3) حالة المحاولة
    UPDATE public.exam_attempts
       SET status = 'submitted',
           submitted_at = now(),
           time_spent_seconds = GREATEST(COALESCE(p_time_spent, 0), 0),
           total_questions = v_total,
           answered_count = v_correct + v_wrong,
           correct_count = v_correct,
           wrong_count = v_wrong,
           blank_count = v_blank,
           score_percentage = v_pct
     WHERE id = p_attempt_id;

    -- 4) ★ question_performance — إحصاء كل سؤال
    INSERT INTO public.question_performance AS qp (
        student_id, question_id, subject_id, exam_id,
        times_seen, times_correct, times_wrong, consecutive_wrong,
        last_wrong_at, last_seen_at, is_mastered, mastery_confidence,
        first_attempted_at)
    SELECT
        v_student, aa.question_id, v_attempt.subject_id, v_attempt.exam_id,
        1,
        CASE WHEN aa.is_correct THEN 1 ELSE 0 END,
        CASE WHEN aa.is_correct = false THEN 1 ELSE 0 END,
        CASE WHEN aa.is_correct = false THEN 1 ELSE 0 END,
        CASE WHEN aa.is_correct = false THEN now() END,
        now(),
        false,
        private.mastery_score(1, CASE WHEN aa.is_correct THEN 1 ELSE 0 END),
        now()
    FROM public.attempt_answers aa
    WHERE aa.attempt_id = p_attempt_id
    ON CONFLICT (student_id, question_id) DO UPDATE
        SET times_seen         = qp.times_seen + 1,
            times_correct      = qp.times_correct + EXCLUDED.times_correct,
            times_wrong        = qp.times_wrong + EXCLUDED.times_wrong,
            consecutive_wrong  = CASE WHEN EXCLUDED.times_wrong > 0
                                      THEN qp.consecutive_wrong + 1 ELSE 0 END,
            last_wrong_at      = COALESCE(EXCLUDED.last_wrong_at, qp.last_wrong_at),
            last_seen_at       = now(),
            exam_id            = COALESCE(EXCLUDED.exam_id, qp.exam_id),
            is_mastered        = private.is_mastered(
                                     qp.times_correct + EXCLUDED.times_correct),
            mastery_confidence = private.mastery_score(
                                     (qp.times_seen + 1)::int,
                                     (qp.times_correct + EXCLUDED.times_correct)::int),
            updated_at         = now();

    -- 5) إحصاء المنصة على مستوى كل سؤال (عدد صحيح لكل سؤال على حدة)
    UPDATE public.exam_questions q
       SET times_attempted = q.times_attempted + 1,
           times_correct   = q.times_correct + COALESCE(agg.correct, 0)
      FROM (
          SELECT aa.question_id,
                 count(*) FILTER (WHERE aa.is_correct)::int AS correct
          FROM public.attempt_answers aa
          WHERE aa.attempt_id = p_attempt_id
          GROUP BY aa.question_id
      ) agg
     WHERE q.id = agg.question_id;

    -- 6) عدّادات الطالب الإجمالية
    UPDATE public.students s
       SET total_exams_taken = s.total_exams_taken + 1,
           total_questions   = s.total_questions + v_total,
           total_correct     = s.total_correct + v_correct,
           total_wrong       = s.total_wrong + v_wrong,
           last_seen_at      = now(),
           updated_at        = now()
     WHERE s.id = v_student;

    -- 7) تجميع per مادة
    INSERT INTO public.student_subject_stats AS ss (
        student_id, subject_id, attempts_count, total_questions, total_correct,
        avg_score, best_score, last_attempt_at)
    VALUES (v_student, v_attempt.subject_id, 1, v_total, v_correct, v_pct, v_pct, now())
    ON CONFLICT (student_id, subject_id) DO UPDATE
        SET attempts_count  = ss.attempts_count + 1,
            total_questions = ss.total_questions + EXCLUDED.total_questions,
            total_correct   = ss.total_correct + EXCLUDED.total_correct,
            avg_score       = round(
                                  ((COALESCE(ss.avg_score,0) * ss.attempts_count)
                                   + COALESCE(EXCLUDED.avg_score,0))
                                  / (ss.attempts_count + 1), 2),
            best_score      = GREATEST(COALESCE(ss.best_score,0), COALESCE(EXCLUDED.best_score,0)),
            last_attempt_at = now();

    -- 8) عدّادات الغلط/الإتقان per مادة
    UPDATE public.student_subject_stats ss
       SET wrong_questions_count    = COALESCE(agg.wrong_cnt, 0),
           mastered_questions_count = COALESCE(agg.mastered_cnt, 0)
    FROM (
        SELECT count(*) FILTER (WHERE NOT is_mastered AND times_wrong > 0)::int AS wrong_cnt,
               count(*) FILTER (WHERE is_mastered)::int AS mastered_cnt
        FROM public.question_performance
        WHERE student_id = v_student AND subject_id = v_attempt.subject_id
    ) agg
    WHERE ss.student_id = v_student AND ss.subject_id = v_attempt.subject_id;

    -- 9) الحمولة: تفاصيل كل إجابة (مع الشرح)
    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'question_id', q.id,
               'number', q.question_number,
               'text', q.question_text,
               'options', q.options,
               'image_url', q.image_url,
               'selected_index', aa.selected_index,
               'correct_index', q.correct_option_index,
               'is_correct', aa.is_correct,
               'is_blank', aa.is_blank,
               'explanation', q.explanation,
               'during_review', aa.during_review
           ) ORDER BY q.question_number), '[]'::jsonb)
    INTO v_answers
    FROM public.attempt_answers aa
    JOIN public.exam_questions q ON q.id = aa.question_id
    WHERE aa.attempt_id = p_attempt_id;

    -- 10) إن كانت محاولة "أخطاء": الأسئلة التي ما زالت غلط
    IF v_is_review THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                   'question_id', q.id,
                   'number', q.question_number,
                   'text', q.question_text,
                   'options', q.options,
                   'image_url', q.image_url,
                   'correct_index', q.correct_option_index,
                   'explanation', q.explanation,
                   'times_wrong', COALESCE(qp.times_wrong, 1)
               ) ORDER BY q.question_number), '[]'::jsonb)
        INTO v_still_wrong
        FROM public.attempt_answers aa
        JOIN public.exam_questions q ON q.id = aa.question_id
        LEFT JOIN public.question_performance qp
               ON qp.question_id = q.id AND qp.student_id = v_student
        WHERE aa.attempt_id = p_attempt_id AND aa.is_correct = false;
    END IF;

    RETURN jsonb_build_object(
        'attempt_id', p_attempt_id,
        'score_percentage', v_pct,
        'total_questions', v_total,
        'answered_count', v_correct + v_wrong,
        'correct_count', v_correct,
        'wrong_count', v_wrong,
        'blank_count', v_blank,
        'time_spent_seconds', GREATEST(COALESCE(p_time_spent, 0), 0),
        'submitted_at', now(),
        'mode', v_attempt.mode,
        'subject_id', v_attempt.subject_id,
        'answers', v_answers,
        'still_wrong', COALESCE(v_still_wrong, '[]'::jsonb)
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.9) create_review_exam — ★ "امتحان الأخطاء"
--      ترجيح زمني: الأحدث خطأ + الأكثر تكرارًا + تتابع الأخطاء.
--      إتقان السؤال = إجابتين صحيحتين → يخرج من المرشحين.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_review_exam(
    p_subject_id     UUID,
    p_count          INTEGER DEFAULT NULL,
    p_only_wrong     BOOLEAN DEFAULT true,
    p_include_unseen BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student   UUID := private.require_student();
    v_min       INTEGER := private.setting_int('student_review_min_questions', 5);
    v_max       INTEGER := private.setting_int('student_review_max_questions', 30);
    v_def       INTEGER := private.setting_int('student_review_default_questions', 10);
    v_count     INTEGER;
    v_subject   TEXT;
    v_wrong_total INTEGER;
    v_picked    UUID[] := '{}';
    v_extra     UUID[] := '{}';
    v_needed    INTEGER;
    v_n         INTEGER;
    v_time_limit INTEGER;
    v_attempt   UUID;
    v_token     TEXT;
    v_questions JSONB;
BEGIN
    v_count := COALESCE(p_count, v_def);

    IF NOT private.rate_check('review:' || v_student::text, 30, interval '1 hour') THEN
        RAISE EXCEPTION 'تم تجاوز الحد المسموح لإنشاء امتحانات الأخطاء' USING ERRCODE = '42901';
    END IF;

    SELECT s.name INTO v_subject FROM public.subjects s WHERE s.id = p_subject_id AND s.is_active;
    IF v_subject IS NULL THEN
        RAISE EXCEPTION 'المادة غير موجودة' USING ERRCODE = 'P0002';
    END IF;

    IF v_count < v_min OR v_count > v_max THEN
        RAISE EXCEPTION 'عدد الأسئلة يجب أن يكون بين % و %', v_min, v_max USING ERRCODE = '22023';
    END IF;

    -- عدد الأسئلة المتاحة غير المتقنة
    SELECT count(*)::int INTO v_wrong_total
    FROM public.question_performance qp
    JOIN public.exam_questions q ON q.id = qp.question_id
    WHERE qp.student_id = v_student
      AND qp.subject_id = p_subject_id
      AND qp.is_mastered = false
      AND qp.times_wrong > 0
      AND q.is_deleted = false;

    IF v_wrong_total = 0 AND NOT COALESCE(p_include_unseen, false) THEN
        RAISE EXCEPTION 'لا توجد أسئلة أخطأت فيها في هذه المادة' USING ERRCODE = 'P0002';
    END IF;
    IF COALESCE(p_only_wrong, true) AND NOT COALESCE(p_include_unseen, false)
       AND v_wrong_total < v_min THEN
        RAISE EXCEPTION 'المتاح % سؤال فقط في هذه المادة (الحد الأدنى %)',
            v_wrong_total, v_min USING ERRCODE = '22023';
    END IF;

    -- 1) مرشحون مرتبون بالأولوية
    SELECT coalesce(array_agg(c.qid), '{}'::uuid[]) INTO v_picked
    FROM (
        SELECT qp.question_id AS qid
        FROM public.question_performance qp
        JOIN public.exam_questions q ON q.id = qp.question_id
        WHERE qp.student_id = v_student
          AND qp.subject_id = p_subject_id
          AND qp.is_mastered = false
          AND qp.times_wrong > 0
          AND q.is_deleted = false
        ORDER BY (qp.times_wrong::NUMERIC
                    * (1 + LEAST(qp.consecutive_wrong, 5) * 0.4)
                    * COALESCE(
                        EXP(-EXTRACT(EPOCH FROM (now() - qp.last_wrong_at)) / 2592000.0),
                        0.3)) DESC,
                 qp.question_id
        LIMIT LEAST(v_count, 200)
    ) c;

    v_n := COALESCE(array_length(v_picked, 1), 0);
    v_needed := v_count - v_n;

    -- 2) إكمال من أسئلة لم تُحاول (بوزن منخفض — أولوية أقل من الأخطاء)
    IF COALESCE(p_include_unseen, false) AND v_needed > 0 THEN
        SELECT coalesce(array_agg(u.qid), '{}'::uuid[]) INTO v_extra
        FROM (
            SELECT q.id AS qid
            FROM public.exam_questions q
            WHERE q.subject_id = p_subject_id
              AND q.is_deleted = false
              AND NOT q.id = ANY(v_picked)
              AND NOT EXISTS (
                  SELECT 1 FROM public.question_performance qp
                  WHERE qp.student_id = v_student AND qp.question_id = q.id
              )
            ORDER BY random()
            LIMIT v_needed
        ) u;
        v_picked := v_picked || v_extra;

        -- 2b) ★ ما زال ناقصًا؟ ندخل في أي أسئلة أخرى للمادة (بما فيها المتقنة).
        --     يمنع "امتحان من سؤالين" عندما يكون الطالب قد جرّب كل شيء:
        --     إعادة تدريب على سؤال متقن أفضل من لا شيء.
        v_needed := v_count - COALESCE(array_length(v_picked, 1), 0);
        IF v_needed > 0 THEN
            SELECT coalesce(array_agg(u.qid), '{}'::uuid[]) INTO v_extra
            FROM (
                SELECT q.id AS qid
                FROM public.exam_questions q
                WHERE q.subject_id = p_subject_id
                  AND q.is_deleted = false
                  AND NOT q.id = ANY(v_picked)
                ORDER BY random()
                LIMIT v_needed
            ) u;
            v_picked := v_picked || v_extra;
        END IF;
    END IF;

    v_n := COALESCE(array_length(v_picked, 1), 0);
    IF v_n = 0 THEN
        RAISE EXCEPTION 'لا توجد أسئلة متاحة في هذه المادة' USING ERRCODE = 'P0002';
    END IF;

    -- 3) المؤقت: ~1.5 دقيقة للسؤال، بحد أقصى 30 دقيقة
    v_time_limit := LEAST(30, GREATEST(3, floor(v_n * 1.5)::int));  -- floor لا round

    INSERT INTO public.exam_attempts (
        student_id, exam_id, mode, subject_id, status, expires_at, total_questions)
    VALUES (
        v_student, NULL, 'review', p_subject_id, 'in_progress',
        now() + make_interval(mins => v_time_limit), v_n)
    RETURNING id INTO v_attempt;

    INSERT INTO public.attempt_answers (attempt_id, question_id, is_blank, during_review)
    SELECT v_attempt, u.qid, true, true
    FROM unnest(v_picked) AS u(qid)
    ON CONFLICT (attempt_id, question_id) DO NOTHING;

    v_token := private.compute_attempt_token(v_attempt);
    UPDATE public.exam_attempts SET answer_token = v_token WHERE id = v_attempt;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', q.id, 'number', q.question_number, 'text', q.question_text,
               'options', q.options, 'image_url', q.image_url
           ) ORDER BY q.question_number), '[]'::jsonb)
    INTO v_questions
    FROM public.attempt_answers aa
    JOIN public.exam_questions q ON q.id = aa.question_id
    WHERE aa.attempt_id = v_attempt;

    RETURN jsonb_build_object(
        'attempt_id', v_attempt,
        'subject_id', p_subject_id,
        'subject_name', v_subject,
        'mode', 'review',
        'total_questions', v_n,
        'requested_questions', v_count,
        -- ★ shortfall: عدد أسئلة نقصت عن الطلب. الواجهة تعرض
        --   "سنستخدم N فقط لأنك جرّبت كل أسئلة المادة" بدل أن تفاجئ الطالب
        --   بامتحان أقصر مما طلب.
        'shortfall', GREATEST(v_count - v_n, 0),
        'wrong_questions_available', v_wrong_total,
        'time_limit_minutes', v_time_limit,
        'answer_token', v_token,
        'questions', v_questions
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.10) get_attempt_questions — أسئلة محاولة (مساعدة للصفحات)
--       للطالب: محاولته فقط. للطواقم: أي محاولة (attempts.view).
--       قبل التسليم: بلا إجابات. بعد التسليم: مع التصحيح.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_attempt_questions(p_attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student UUID := private.current_student_id();
    v_attempt public.exam_attempts%ROWTYPE;
    v_allowed BOOLEAN := false;
    v_questions JSONB;
    v_subject  TEXT;
    v_exam     TEXT;
BEGIN
    SELECT a.* INTO v_attempt FROM public.exam_attempts a WHERE a.id = p_attempt_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'المحاولة غير موجودة' USING ERRCODE = 'P0002';
    END IF;

    IF v_student IS NOT NULL AND v_attempt.student_id = v_student THEN
        v_allowed := true;
    ELSIF (SELECT private.is_staff()) AND (SELECT private.has_any_scope('attempts.view')) THEN
        v_allowed := true;
    END IF;

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
    END IF;

    SELECT s.name INTO v_subject FROM public.subjects s WHERE s.id = v_attempt.subject_id;
    SELECT e.title INTO v_exam   FROM public.exams e     WHERE e.id = v_attempt.exam_id;

    IF v_attempt.status = 'in_progress' THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                   'id', q.id, 'number', q.question_number, 'text', q.question_text,
                   'options', q.options, 'image_url', q.image_url
               ) ORDER BY q.question_number), '[]'::jsonb)
        INTO v_questions
        FROM public.attempt_answers aa
        JOIN public.exam_questions q ON q.id = aa.question_id
        WHERE aa.attempt_id = p_attempt_id;
    ELSE
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                   'id', q.id, 'number', q.question_number, 'text', q.question_text,
                   'options', q.options, 'image_url', q.image_url,
                   'selected_index', aa.selected_index,
                   'correct_index', q.correct_option_index,
                   'is_correct', aa.is_correct, 'is_blank', aa.is_blank,
                   'explanation', q.explanation
               ) ORDER BY q.question_number), '[]'::jsonb)
        INTO v_questions
        FROM public.attempt_answers aa
        JOIN public.exam_questions q ON q.id = aa.question_id
        WHERE aa.attempt_id = p_attempt_id;
    END IF;

    RETURN jsonb_build_object(
        'attempt_id', v_attempt.id,
        'exam_id', v_attempt.exam_id,
        'exam_title', v_exam,
        'subject_id', v_attempt.subject_id,
        'subject_name', v_subject,
        'mode', v_attempt.mode,
        'status', v_attempt.status,
        'started_at', v_attempt.started_at,
        'expires_at', v_attempt.expires_at,
        'submitted_at', v_attempt.submitted_at,
        'total_questions', v_attempt.total_questions,
        'score_percentage', v_attempt.score_percentage,
        'correct_count', v_attempt.correct_count,
        'wrong_count', v_attempt.wrong_count,
        'blank_count', v_attempt.blank_count,
        'time_spent_seconds', v_attempt.time_spent_seconds,
        'answer_token', CASE
            -- ★ التوكن يُعاد فقط أثناء المحاولة (in_progress) وصاحبها فقط.
            --   بدونه لا يستطيع العميل تسليم محاولة استأنفها بعد تحديث الصفحة.
            --   بعد التسليم لا فائدة منه (محاولة واحدة فقط).
            WHEN v_attempt.status = 'in_progress' THEN v_attempt.answer_token
            ELSE NULL
        END,
        'questions', v_questions
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.11) abandon_attempt
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.abandon_attempt(p_attempt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_student UUID := private.require_student();
BEGIN
    UPDATE public.exam_attempts
       SET status = 'abandoned'
     WHERE id = p_attempt_id AND student_id = v_student AND status = 'in_progress';
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.12) get_my_dashboard — ملخص حساب الطالب
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student  UUID := private.require_student();
    v_row      public.students%ROWTYPE;
    v_subjects JSONB;
    v_recent   JSONB;
BEGIN
    SELECT s.* INTO v_row FROM public.students s WHERE s.id = v_student;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'subject_id', ss.subject_id,
               'subject_name', sub.name,
               'subject_slug', sub.slug,
               'attempts_count', ss.attempts_count,
               'total_questions', ss.total_questions,
               'total_correct', ss.total_correct,
               'accuracy', CASE WHEN ss.total_questions > 0
                                THEN round((ss.total_correct::NUMERIC / ss.total_questions) * 100, 1)
                                ELSE NULL END,
               'avg_score', ss.avg_score,
               'best_score', ss.best_score,
               'wrong_questions_count', ss.wrong_questions_count,
               'mastered_questions_count', ss.mastered_questions_count,
               'last_attempt_at', ss.last_attempt_at
           ) ORDER BY ss.last_attempt_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_subjects
    FROM public.student_subject_stats ss
    JOIN public.subjects sub ON sub.id = ss.subject_id
    WHERE ss.student_id = v_student;

    SELECT coalesce(jsonb_agg(t.t ORDER BY t.t->>'started_at' DESC), '[]'::jsonb)
    INTO v_recent
    FROM (
        SELECT jsonb_build_object(
                   'id', a.id,
                   'subject_name', sub.name,
                   'exam_title', e.title,
                   'mode', a.mode,
                   'status', a.status,
                   'score_percentage', a.score_percentage,
                   'correct_count', a.correct_count,
                   'wrong_count', a.wrong_count,
                   'blank_count', a.blank_count,
                   'total_questions', a.total_questions,
                   'started_at', a.started_at,
                   'submitted_at', a.submitted_at
               ) AS t
        FROM public.exam_attempts a
        JOIN public.subjects sub ON sub.id = a.subject_id
        LEFT JOIN public.exams e ON e.id = a.exam_id
        WHERE a.student_id = v_student AND a.status = 'submitted'
        ORDER BY a.submitted_at DESC
        LIMIT 10
    ) t;

    RETURN jsonb_build_object(
        'student', jsonb_build_object(
            'id', v_row.id, 'email', v_row.email, 'full_name', v_row.full_name,
            'avatar_url', v_row.avatar_url, 'grade', v_row.grade, 'phone', v_row.phone,
            'provider', v_row.oauth_provider, 'email_verified', v_row.email_verified,
            'created_at', v_row.created_at, 'last_seen_at', v_row.last_seen_at
        ),
        'summary', jsonb_build_object(
            'attempts', v_row.total_exams_taken,
            'questions', v_row.total_questions,
            'correct', v_row.total_correct,
            'wrong', v_row.total_wrong,
            'accuracy', CASE WHEN v_row.total_questions > 0
                             THEN round((v_row.total_correct::NUMERIC / v_row.total_questions) * 100, 1)
                             ELSE NULL END,
            'wrong_questions', (SELECT count(*)::int FROM public.question_performance qp
                                WHERE qp.student_id = v_student
                                  AND qp.is_mastered = false AND qp.times_wrong > 0),
            'mastered_questions', (SELECT count(*)::int FROM public.question_performance qp
                                   WHERE qp.student_id = v_student AND qp.is_mastered = true)
        ),
        'subjects', v_subjects,
        'recent_attempts', v_recent
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.13) get_my_wrong_questions — أسئلة أخطأ فيها الطالب (بلا مفتاح إجابة)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_wrong_questions(
    p_subject_id UUID DEFAULT NULL,
    p_limit      INTEGER DEFAULT 50,
    p_offset     INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student UUID := private.require_student();
    v_items   JSONB;
    v_total   INTEGER;
    v_lim     INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
    v_off     INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
    SELECT count(*)::int INTO v_total
    FROM public.question_performance qp
    JOIN public.exam_questions q ON q.id = qp.question_id
    WHERE qp.student_id = v_student
      AND qp.is_mastered = false
      AND qp.times_wrong > 0
      AND q.is_deleted = false
      AND (p_subject_id IS NULL OR qp.subject_id = p_subject_id);

    SELECT coalesce(jsonb_agg(t.t ORDER BY t.t->>'last_wrong_at' DESC), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT jsonb_build_object(
                   'question_id', qp.question_id,
                   'subject_id', qp.subject_id,
                   'subject_name', sub.name,
                   'text', q.question_text,
                   'options', q.options,
                   'image_url', q.image_url,
                   'times_seen', qp.times_seen,
                   'times_wrong', qp.times_wrong,
                   'consecutive_wrong', qp.consecutive_wrong,
                   'last_wrong_at', qp.last_wrong_at,
                   'mastery_confidence', qp.mastery_confidence
               ) AS t
        FROM public.question_performance qp
        JOIN public.exam_questions q ON q.id = qp.question_id
        JOIN public.subjects sub ON sub.id = qp.subject_id
        WHERE qp.student_id = v_student
          AND qp.is_mastered = false
          AND qp.times_wrong > 0
          AND q.is_deleted = false
          AND (p_subject_id IS NULL OR qp.subject_id = p_subject_id)
        ORDER BY qp.last_wrong_at DESC NULLS LAST
        LIMIT v_lim OFFSET v_off
    ) t;

    RETURN jsonb_build_object('total', v_total, 'items', v_items,
                              'limit', v_lim, 'offset', v_off);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.14) delete_my_account — حذف كل بيانات الطالب (GDPR)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student UUID;
    v_email   TEXT;
BEGIN
    SELECT s.id, s.email INTO v_student, v_email
    FROM public.students s WHERE s.auth_user_id = auth.uid();

    IF v_student IS NULL THEN
        RETURN jsonb_build_object('deleted', false, 'reason', 'no_profile');
    END IF;

    -- cascade ينظّف attempts + answers + performance + stats
    DELETE FROM public.students WHERE id = v_student;

    BEGIN
        DELETE FROM auth.users WHERE id = auth.uid();
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('deleted', true, 'auth_user_deleted', false, 'email', v_email);
    END;

    RETURN jsonb_build_object('deleted', true, 'auth_user_deleted', true, 'email', v_email);
END;
$$;

-- ===========================================================================
-- 3.15) دوال الإدارة
--       كل واحدة تفحص الصلاحية داخل الدالة (الـ Definer يتجاوز RLS → لا بد).
-- ===========================================================================

-- 3.15.1) قائمة الطلاب (server-side pagination + بحث + فلاتر)
CREATE OR REPLACE FUNCTION public.list_admin_students(
    p_search     TEXT DEFAULT NULL,
    p_subject_id UUID DEFAULT NULL,
    p_active     BOOLEAN DEFAULT NULL,
    p_sort       TEXT DEFAULT 'recent',
    p_limit      INTEGER DEFAULT 25,
    p_offset     INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_items   JSONB;
    v_lim     INTEGER := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200);
    v_off     INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
    v_total   INTEGER;
    v_ordered JSONB;
BEGIN
    IF NOT (SELECT private.is_staff()) OR NOT (SELECT private.has_any_scope('students.view')) THEN
        RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
    END IF;

    -- الترتيب يتم في استعلام فرعي بأنواع متجانسة، ثم يُجمَّع JSON
    SELECT coalesce(jsonb_agg(t.t), '[]'::jsonb) INTO v_ordered
    FROM (
        SELECT jsonb_build_object(
                   'id', s.id,
                   'email', s.email,
                   'full_name', s.full_name,
                   'avatar_url', s.avatar_url,
                   'grade', s.grade,
                   'provider', s.oauth_provider,
                   'email_verified', s.email_verified,
                   'is_active', s.is_active,
                   'attempts', s.total_exams_taken,
                   'questions', s.total_questions,
                   'correct', s.total_correct,
                   'wrong', s.total_wrong,
                   'accuracy', CASE WHEN s.total_questions > 0
                                    THEN round((s.total_correct::NUMERIC / s.total_questions) * 100, 1)
                                    ELSE NULL END,
                   'wrong_questions', (SELECT count(*)::int FROM public.question_performance qp
                                       WHERE qp.student_id = s.id
                                         AND qp.is_mastered = false AND qp.times_wrong > 0),
                   'created_at', s.created_at,
                   'last_seen_at', s.last_seen_at
               ) AS t
        FROM public.students s
        WHERE (p_search IS NULL
               OR s.email ILIKE '%' || p_search || '%'
               OR COALESCE(s.full_name, '') ILIKE '%' || p_search || '%')
          AND (p_active IS NULL OR s.is_active = p_active)
          AND (p_subject_id IS NULL OR EXISTS (
                  SELECT 1 FROM public.student_subject_stats ss
                  WHERE ss.student_id = s.id AND ss.subject_id = p_subject_id))
        ORDER BY
            CASE p_sort
                WHEN 'name'     THEN COALESCE(s.full_name, s.email)
                WHEN 'attempts' THEN lpad(s.total_exams_taken::text, 12, '0')
                WHEN 'accuracy' THEN lpad(
                        CASE WHEN s.total_questions > 0
                             THEN round((s.total_correct::NUMERIC / s.total_questions) * 100, 1)::text
                             ELSE '0' END, 12, '0')
                ELSE to_char(COALESCE(s.last_seen_at, s.created_at), 'YYYYMMDDHH24MISS')
            END DESC,
            s.id
        LIMIT v_lim OFFSET v_off
    ) t;

    SELECT v_ordered INTO v_items;

    SELECT count(*)::int INTO v_total
    FROM public.students s
    WHERE (p_search IS NULL
           OR s.email ILIKE '%' || p_search || '%'
           OR COALESCE(s.full_name, '') ILIKE '%' || p_search || '%')
      AND (p_active IS NULL OR s.is_active = p_active)
      AND (p_subject_id IS NULL OR EXISTS (
              SELECT 1 FROM public.student_subject_stats ss
              WHERE ss.student_id = s.id AND ss.subject_id = p_subject_id));

    RETURN jsonb_build_object(
        'total', v_total, 'limit', v_lim, 'offset', v_off, 'items', v_items,
        'overall', jsonb_build_object(
            'students', (SELECT count(*)::int FROM public.students),
            'active', (SELECT count(*)::int FROM public.students WHERE is_active),
            'inactive', (SELECT count(*)::int FROM public.students WHERE NOT is_active),
            'attempts', (SELECT count(*)::int FROM public.exam_attempts WHERE status = 'submitted'),
            'answers', (SELECT count(*)::int FROM public.attempt_answers WHERE is_correct IS NOT NULL),
            'accuracy', (SELECT CASE WHEN count(*) FILTER (WHERE is_correct IS NOT NULL) > 0
                                     THEN round((count(*) FILTER (WHERE is_correct)::NUMERIC
                                                 / count(*) FILTER (WHERE is_correct IS NOT NULL)) * 100, 1)
                                     ELSE NULL END
                         FROM public.attempt_answers),
            'new_this_week', (SELECT count(*)::int FROM public.students
                              WHERE created_at > now() - interval '7 days')
        )
    );
END;
$$;

-- 3.15.2) تفاصيل طالب واحد
CREATE OR REPLACE FUNCTION public.get_admin_student_detail(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student public.students%ROWTYPE;
    v_subjects JSONB;
    v_attempts JSONB;
    v_perf    JSONB;
BEGIN
    IF NOT (SELECT private.is_staff()) OR NOT (SELECT private.has_any_scope('students.view')) THEN
        RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
    END IF;

    SELECT s.* INTO v_student FROM public.students s WHERE s.id = p_student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الطالب غير موجود' USING ERRCODE = 'P0002';
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'subject_id', ss.subject_id, 'subject_name', sub.name,
               'attempts_count', ss.attempts_count,
               'total_questions', ss.total_questions, 'total_correct', ss.total_correct,
               'accuracy', CASE WHEN ss.total_questions > 0
                                THEN round((ss.total_correct::NUMERIC / ss.total_questions) * 100, 1) END,
               'avg_score', ss.avg_score, 'best_score', ss.best_score,
               'wrong_questions_count', ss.wrong_questions_count,
               'mastered_questions_count', ss.mastered_questions_count,
               'last_attempt_at', ss.last_attempt_at
           ) ORDER BY ss.attempts_count DESC), '[]'::jsonb)
    INTO v_subjects
    FROM public.student_subject_stats ss
    JOIN public.subjects sub ON sub.id = ss.subject_id
    WHERE ss.student_id = p_student_id;

    SELECT coalesce(jsonb_agg(t.t ORDER BY t.t->>'started_at' DESC), '[]'::jsonb)
    INTO v_attempts
    FROM (
        SELECT jsonb_build_object(
                   'id', a.id, 'mode', a.mode, 'status', a.status,
                   'subject_name', sub.name, 'exam_title', e.title,
                   'score_percentage', a.score_percentage,
                   'correct_count', a.correct_count, 'wrong_count', a.wrong_count,
                   'blank_count', a.blank_count, 'total_questions', a.total_questions,
                   'time_spent_seconds', a.time_spent_seconds,
                   'flagged_suspicious', a.flagged_suspicious,
                   'started_at', a.started_at, 'submitted_at', a.submitted_at
               ) AS t
        FROM public.exam_attempts a
        JOIN public.subjects sub ON sub.id = a.subject_id
        LEFT JOIN public.exams e ON e.id = a.exam_id
        WHERE a.student_id = p_student_id
        ORDER BY a.started_at DESC
        LIMIT 50
    ) t;

    SELECT jsonb_build_object(
        'questions_seen', COALESCE(sum(qp.times_seen), 0)::int,
        'mastered', count(*) FILTER (WHERE qp.is_mastered)::int,
        'still_wrong', count(*) FILTER (WHERE NOT qp.is_mastered AND qp.times_wrong > 0)::int
    ) INTO v_perf
    FROM public.question_performance qp
    WHERE qp.student_id = p_student_id;

    RETURN jsonb_build_object(
        'student', to_jsonb(v_student),
        'summary', jsonb_build_object(
            'attempts', v_student.total_exams_taken,
            'questions', v_student.total_questions,
            'correct', v_student.total_correct,
            'wrong', v_student.total_wrong,
            'accuracy', CASE WHEN v_student.total_questions > 0
                             THEN round((v_student.total_correct::NUMERIC / v_student.total_questions) * 100, 1) END
        ),
        'performance', v_perf,
        'subjects', v_subjects,
        'attempts', v_attempts
    );
END;
$$;

-- 3.15.3) تقرير الامتحانات (فلاتر متعددة)
CREATE OR REPLACE FUNCTION public.get_admin_attempts(
    p_subject_id   UUID DEFAULT NULL,
    p_student_id   UUID DEFAULT NULL,
    p_exam_id      UUID DEFAULT NULL,
    p_mode         TEXT DEFAULT NULL,
    p_status       TEXT DEFAULT NULL,
    p_from         TIMESTAMPTZ DEFAULT NULL,
    p_to           TIMESTAMPTZ DEFAULT NULL,
    p_min_score    NUMERIC DEFAULT NULL,
    p_max_score    NUMERIC DEFAULT NULL,
    p_only_flagged BOOLEAN DEFAULT false,
    p_limit        INTEGER DEFAULT 25,
    p_offset       INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_items JSONB;
    v_total INTEGER;
    v_lim   INTEGER := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200);
    v_off   INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
    IF NOT (SELECT private.is_staff()) OR NOT (SELECT private.has_any_scope('attempts.view')) THEN
        RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
    END IF;

    SELECT count(*)::int INTO v_total
    FROM public.exam_attempts a
    WHERE (p_subject_id IS NULL OR a.subject_id = p_subject_id)
      AND (p_student_id IS NULL OR a.student_id = p_student_id)
      AND (p_exam_id   IS NULL OR a.exam_id = p_exam_id)
      AND (p_mode      IS NULL OR a.mode = p_mode)
      AND (p_status    IS NULL OR a.status = p_status)
      AND (p_from      IS NULL OR a.started_at >= p_from)
      AND (p_to        IS NULL OR a.started_at <= p_to)
      AND (p_min_score IS NULL OR a.score_percentage >= p_min_score)
      AND (p_max_score IS NULL OR a.score_percentage <= p_max_score)
      AND (NOT COALESCE(p_only_flagged, false) OR a.flagged_suspicious);

    SELECT coalesce(jsonb_agg(t.t), '[]'::jsonb) INTO v_items
    FROM (
        SELECT jsonb_build_object(
                   'id', a.id, 'student_id', a.student_id,
                   'student_name', s.full_name, 'student_email', s.email,
                   'subject_name', sub.name, 'exam_title', e.title,
                   'mode', a.mode, 'status', a.status,
                   'score_percentage', a.score_percentage,
                   'correct_count', a.correct_count, 'wrong_count', a.wrong_count,
                   'blank_count', a.blank_count, 'total_questions', a.total_questions,
                   'time_spent_seconds', a.time_spent_seconds,
                   'flagged_suspicious', a.flagged_suspicious, 'flag_reason', a.flag_reason,
                   'started_at', a.started_at, 'submitted_at', a.submitted_at
               ) AS t
        FROM public.exam_attempts a
        JOIN public.students s ON s.id = a.student_id
        JOIN public.subjects sub ON sub.id = a.subject_id
        LEFT JOIN public.exams e ON e.id = a.exam_id
        WHERE (p_subject_id IS NULL OR a.subject_id = p_subject_id)
          AND (p_student_id IS NULL OR a.student_id = p_student_id)
          AND (p_exam_id   IS NULL OR a.exam_id = p_exam_id)
          AND (p_mode      IS NULL OR a.mode = p_mode)
          AND (p_status    IS NULL OR a.status = p_status)
          AND (p_from      IS NULL OR a.started_at >= p_from)
          AND (p_to        IS NULL OR a.started_at <= p_to)
          AND (p_min_score IS NULL OR a.score_percentage >= p_min_score)
          AND (p_max_score IS NULL OR a.score_percentage <= p_max_score)
          AND (NOT COALESCE(p_only_flagged, false) OR a.flagged_suspicious)
        ORDER BY a.started_at DESC
        LIMIT v_lim OFFSET v_off
    ) t;

    RETURN jsonb_build_object(
        'total', v_total, 'limit', v_lim, 'offset', v_off, 'items', v_items,
        'summary', jsonb_build_object(
            'attempts', (SELECT count(*)::int FROM public.exam_attempts WHERE status='submitted'),
            'avg_score', (SELECT round(avg(score_percentage), 2) FROM public.exam_attempts
                          WHERE status='submitted' AND score_percentage IS NOT NULL),
            'review_attempts', (SELECT count(*)::int FROM public.exam_attempts WHERE mode='review'),
            'in_progress', (SELECT count(*)::int FROM public.exam_attempts WHERE status='in_progress'),
            'abandoned', (SELECT count(*)::int FROM public.exam_attempts WHERE status='abandoned'),
            'expired', (SELECT count(*)::int FROM public.exam_attempts WHERE status='expired'),
            'flagged', (SELECT count(*)::int FROM public.exam_attempts WHERE flagged_suspicious),
            'active_students', (SELECT count(DISTINCT student_id)::int FROM public.exam_attempts)
        )
    );
END;
$$;

-- 3.15.4) تفاصيل محاولة واحدة (مع كل الإجابات)
CREATE OR REPLACE FUNCTION public.get_admin_attempt_detail(p_attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_attempt JSONB; v_answers JSONB;
BEGIN
    IF NOT (SELECT private.is_staff()) OR NOT (SELECT private.has_any_scope('attempts.view')) THEN
        RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'id', a.id,
        'student', jsonb_build_object('id', s.id, 'full_name', s.full_name, 'email', s.email),
        'subject_name', sub.name, 'exam_title', e.title,
        'mode', a.mode, 'status', a.status, 'score_percentage', a.score_percentage,
        'correct_count', a.correct_count, 'wrong_count', a.wrong_count, 'blank_count', a.blank_count,
        'total_questions', a.total_questions, 'time_spent_seconds', a.time_spent_seconds,
        'flagged_suspicious', a.flagged_suspicious, 'flag_reason', a.flag_reason,
        'started_at', a.started_at, 'expires_at', a.expires_at, 'submitted_at', a.submitted_at
    ) INTO v_attempt
    FROM public.exam_attempts a
    JOIN public.students s ON s.id = a.student_id
    JOIN public.subjects sub ON sub.id = a.subject_id
    LEFT JOIN public.exams e ON e.id = a.exam_id
    WHERE a.id = p_attempt_id;

    IF v_attempt IS NULL THEN
        RAISE EXCEPTION 'المحاولة غير موجودة' USING ERRCODE = 'P0002';
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'number', q.question_number, 'text', q.question_text, 'options', q.options,
               'image_url', q.image_url, 'selected_index', aa.selected_index,
               'correct_index', q.correct_option_index, 'is_correct', aa.is_correct,
               'is_blank', aa.is_blank, 'explanation', q.explanation,
               'answered_at', aa.answered_at, 'time_taken_seconds', aa.time_taken_seconds,
               'answer_hash', aa.answer_hash
           ) ORDER BY q.question_number), '[]'::jsonb) INTO v_answers
    FROM public.attempt_answers aa
    JOIN public.exam_questions q ON q.id = aa.question_id
    WHERE aa.attempt_id = p_attempt_id;

    RETURN jsonb_build_object('attempt', v_attempt, 'answers', v_answers);
END;
$$;

-- 3.15.5) تحليل الأسئلة على مستوى المنصة (أصعب الأسئلة)
CREATE OR REPLACE FUNCTION public.get_question_analytics(
    p_subject_id UUID DEFAULT NULL,
    p_limit      INTEGER DEFAULT 25,
    p_offset     INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_items JSONB;
    v_lim   INTEGER := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200);
    v_off   INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
    IF NOT (SELECT private.is_staff()) OR NOT (SELECT private.has_any_scope('analytics.view')) THEN
        RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
    END IF;

    SELECT coalesce(jsonb_agg(t.t ORDER BY (t.t->>'error_rate')::numeric DESC), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT jsonb_build_object(
                   'question_id', q.id,
                   'subject_id', q.subject_id,
                   'subject_name', sub.name,
                   'text', q.question_text,
                   'image_url', q.image_url,
                   'attempts', agg.attempts,
                   'wrong', agg.wrong,
                   'error_rate', CASE WHEN agg.attempts > 0
                                      THEN round((agg.wrong::NUMERIC / agg.attempts) * 100, 1) END,
                   'blank', agg.blank,
                   'students_wrong', agg.students_wrong,
                   'options_distribution', agg.options_distribution
               ) AS t
        FROM public.exam_questions q
        JOIN public.subjects sub ON sub.id = q.subject_id
        JOIN LATERAL (
            SELECT count(*)::int AS attempts,
                   count(*) FILTER (WHERE aa.is_correct = false)::int AS wrong,
                   count(*) FILTER (WHERE aa.is_blank)::int AS blank,
                   count(DISTINCT aa_att.student_id)
                       FILTER (WHERE aa.is_correct = false)::int AS students_wrong,
                   (SELECT jsonb_object_agg(d.k, d.v) FROM (
                        SELECT aa2.selected_index::text AS k, count(*)::int AS v
                        FROM public.attempt_answers aa2
                        WHERE aa2.question_id = q.id AND aa2.selected_index IS NOT NULL
                        GROUP BY aa2.selected_index
                    ) d) AS options_distribution
            FROM public.attempt_answers aa
            JOIN public.exam_attempts aa_att ON aa_att.id = aa.attempt_id
            WHERE aa.question_id = q.id AND aa.is_correct IS NOT NULL
        ) agg ON true
        WHERE q.is_deleted = false
          AND agg.attempts > 0
          AND (p_subject_id IS NULL OR q.subject_id = p_subject_id)
        ORDER BY (agg.wrong::NUMERIC / agg.attempts) DESC, q.id
        LIMIT v_lim OFFSET v_off
    ) t;

    RETURN jsonb_build_object(
        'items', v_items, 'limit', v_lim, 'offset', v_off,
        'overall', jsonb_build_object(
            'students', (SELECT count(*)::int FROM public.students),
            'questions_answered', (SELECT count(*)::int FROM public.attempt_answers
                                   WHERE is_correct IS NOT NULL),
            'accuracy', (SELECT CASE WHEN count(*) FILTER (WHERE is_correct IS NOT NULL) > 0
                                     THEN round((count(*) FILTER (WHERE is_correct)::NUMERIC
                                                 / count(*) FILTER (WHERE is_correct IS NOT NULL)) * 100, 1)
                                     ELSE NULL END
                         FROM public.attempt_answers),
            'mastered_rate', (SELECT CASE WHEN count(*) > 0
                                           THEN round((count(*) FILTER (WHERE is_mastered)::NUMERIC / count(*)) * 100, 1)
                                           ELSE NULL END
                               FROM public.question_performance)
        )
    );
END;
$$;

-- 3.15.6) تفعيل/تعطيل طالب (kill switch) — students.manage
CREATE OR REPLACE FUNCTION public.admin_set_student_active(p_student_id UUID, p_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_email TEXT;
BEGIN
    IF NOT (SELECT private.is_staff()) OR NOT (SELECT private.has_any_scope('students.manage')) THEN
        RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
    END IF;

    UPDATE public.students
       SET is_active = COALESCE(p_active, false), updated_at = now()
     WHERE id = p_student_id
    RETURNING email INTO v_email;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'الطالب غير موجود' USING ERRCODE = 'P0002';
    END IF;

    PERFORM private.log_activity('student.set_active', 'students', p_student_id::text,
        jsonb_build_object('is_active', COALESCE(p_active, false), 'email', v_email));
END;
$$;

-- 3.15.7) تعليم/إلغاء تعليم محاولة كاشتباه غش — attempts.manage
CREATE OR REPLACE FUNCTION public.admin_flag_attempt(
    p_attempt_id UUID, p_flagged BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT (SELECT private.is_staff()) OR NOT (SELECT private.has_any_scope('attempts.manage')) THEN
        RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
    END IF;

    UPDATE public.exam_attempts
       SET flagged_suspicious = COALESCE(p_flagged, false),
           flag_reason = CASE WHEN COALESCE(p_flagged, false) THEN p_reason ELSE NULL END
     WHERE id = p_attempt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المحاولة غير موجودة' USING ERRCODE = 'P0002';
    END IF;

    PERFORM private.log_activity('attempt.flag', 'exam_attempts', p_attempt_id::text,
        jsonb_build_object('flagged', COALESCE(p_flagged, false), 'reason', p_reason));
END;
$$;

-- 3.15.8) حذف محاولة + إعادة حساب إحصاءات الطالب — attempts.manage
CREATE OR REPLACE FUNCTION public.admin_delete_attempt(p_attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student UUID;
    v_score   NUMERIC;
BEGIN
    IF NOT (SELECT private.is_staff()) OR NOT (SELECT private.has_any_scope('attempts.manage')) THEN
        RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
    END IF;

    SELECT a.student_id, a.score_percentage INTO v_student, v_score
    FROM public.exam_attempts a WHERE a.id = p_attempt_id;

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'المحاولة غير موجودة' USING ERRCODE = 'P0002';
    END IF;

    PERFORM private.log_activity('attempt.delete', 'exam_attempts', p_attempt_id::text,
        jsonb_build_object('student_id', v_student, 'score', v_score));

    DELETE FROM public.exam_attempts WHERE id = p_attempt_id;

    -- لا نُبقي أرقامًا خاطئة في question_performance / student_subject_stats
    PERFORM private.recompute_student_performance(v_student);

    RETURN jsonb_build_object('deleted', true, 'student_id', v_student, 'recomputed', true);
END;
$$;

-- 3.15.9) حذف كل بيانات طالب (GDPR) — students.manage
CREATE OR REPLACE FUNCTION public.admin_delete_student_data(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_email  TEXT;
    v_uid    UUID;
    v_counts JSONB;
BEGIN
    IF NOT (SELECT private.is_staff()) OR NOT (SELECT private.has_any_scope('students.manage')) THEN
        RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
    END IF;

    SELECT s.email, s.auth_user_id INTO v_email, v_uid
    FROM public.students s WHERE s.id = p_student_id;

    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'الطالب غير موجود' USING ERRCODE = 'P0002';
    END IF;

    SELECT jsonb_build_object(
        'attempts', (SELECT count(*)::int FROM public.exam_attempts WHERE student_id = p_student_id),
        'answers', (SELECT count(*)::int FROM public.attempt_answers aa
                    JOIN public.exam_attempts a ON a.id = aa.attempt_id
                    WHERE a.student_id = p_student_id),
        'performance', (SELECT count(*)::int FROM public.question_performance
                        WHERE student_id = p_student_id)
    ) INTO v_counts;

    PERFORM private.log_activity('student.delete_data', 'students', p_student_id::text,
        jsonb_build_object('email', v_email, 'counts', v_counts));

    -- cascade ينظّف attempts + answers + performance + stats
    DELETE FROM public.students WHERE id = p_student_id;

    BEGIN
        DELETE FROM auth.users WHERE id = v_uid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('deleted', true, 'auth_user_deleted', false,
                                  'email', v_email, 'counts', v_counts);
    END;

    RETURN jsonb_build_object('deleted', true, 'auth_user_deleted', true,
                              'email', v_email, 'counts', v_counts);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3.16) منح التنفيذ
--      ملاحظة: 20260920000000 استخدم GRANT ... ON ALL FUNCTIONS IN SCHEMA
--      private، وهو لا يغطي الدوال الجديدة. نكرّره هنا.
--      ملاحظة 2: لا نمنح sequences لـ authenticated — كل جداولنا تستخدم
--      gen_random_uuid() فلا حاجة لأي تسلسل.
-- ---------------------------------------------------------------------------

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

REVOKE ALL ON TABLE private.app_secrets FROM PUBLIC;
REVOKE ALL ON TABLE private.app_secrets FROM anon;

DO $$
DECLARE v_fn TEXT;
BEGIN
    FOREACH v_fn IN ARRAY ARRAY[
        'bootstrap_student()',
        'update_own_profile(text,text,text,text,text)',
        'start_exam_attempt(uuid,text)',
        'save_answer(uuid,uuid,smallint,integer)',
        'submit_exam_attempt(uuid,text,integer)',
        'create_review_exam(uuid,integer,boolean,boolean)',
        'get_attempt_questions(uuid)',
        'abandon_attempt(uuid)',
        'get_my_dashboard()',
        'get_my_wrong_questions(uuid,integer,integer)',
        'delete_my_account()',
        'list_admin_students(text,uuid,boolean,text,integer,integer)',
        'get_admin_student_detail(uuid)',
        'get_admin_attempts(uuid,uuid,uuid,text,text,timestamptz,timestamptz,numeric,numeric,boolean,integer,integer)',
        'get_admin_attempt_detail(uuid)',
        'get_question_analytics(uuid,integer,integer)',
        'admin_set_student_active(uuid,boolean)',
        'admin_flag_attempt(uuid,boolean,text)',
        'admin_delete_attempt(uuid)',
        'admin_delete_student_data(uuid)'
    ]
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', v_fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', v_fn);
    END LOOP;
END $$;
