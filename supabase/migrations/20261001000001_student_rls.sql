-- ============================================================================
-- Migration: RLS for Student Auth & Exam Attempts
-- الملف: supabase/migrations/20261001000001_student_rls.sql
-- الهدف: قصر كل بيانات الطلبة على صاحبها، وفتح قراءة إدارية عبر الصلاحيات.
--
-- المبادئ (مطابقة لـ 20260920000000 و 20260921000000):
--   1. anon لا يملك أي صلاحية على أي جدول طالب — ولا SELECT.
--   2. الطالب يقرأ ملفه فقط (auth_user_id = auth.uid()).
--   3. ★ لا INSERT ولا UPDATE مباشرة للطالب على أي جدول محاولات/إجابات.
--      كل الكتابة عبر RPCs من نوع SECURITY DEFINER (start/save/submit).
--      السبب: لو سمحنا بـ INSERT المباشر لأرسل الطالب correct_count = 99
--      أو is_correct = true. الـ RPCs هي وحدها من تكتب خانات النتيجة.
--   4. question_performance قراءة فقط — مصدره الوحيد submit_exam_attempt.
--   5. students: لا UPDATE عام — التحديث عبر RPC بقائمة بيضاء (5 حقول).
--   6. الطواقم تقرأ عبر الصلاحيات (private.has_any_scope) لا عبر is_admin.
--
-- Idempotent: يمكن تشغيله أكثر من مرة بأمان.
-- ملاحظة: لا تُعدّل أي migration قديمة — هذا ملف جديد فقط.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2.0) دالة مساعدة: student_id المقابل لـ auth.uid() الحالي
--     تستخدمها كل سياسات الطالب. STABLE + SECURITY DEFINER حتى لا نكرر
--     قراءة جدول students في كل صف.
-- ---------------------------------------------------------------------------

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

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_student_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2.1) تفعيل RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.students              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_performance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subject_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2.2) سحب كل الصلاحيات من anon و authenticated و public
--
--      ★ نبدأ بـ REVOKE ALL ... FROM authenticated وليس مجرد GRANT SELECT.
--        السبب: Supabase يمنح authenticated كل الصلاحيات افتراضيًا على أي
--        جدول جديد، و migration 20260920000000 سحب الكتابة عن anon فقط.
--        لو اكتفينا بـ GRANT SELECT لَبقي INSERT/UPDATE/DELETE ضمنيًا —
--        وكان الطالب يستطيع إنشاء محاولة بـ correct_count = 99.
--        الـ REVOKE صريح هو ما يجعل "قراءة فقط" عقدًا لا مجرّد نية.
--
--      تذكير: 20260926000000 فعّل ALTER DEFAULT PRIVILEGES revocations لـ anon،
--      لكننا نكتب كل المنح صراحةً ليكون العقد واضحًا وآمنًا عند إعادة التشغيل.
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.students              FROM anon;
REVOKE ALL ON public.exam_attempts         FROM anon;
REVOKE ALL ON public.attempt_answers       FROM anon;
REVOKE ALL ON public.question_performance  FROM anon;
REVOKE ALL ON public.student_subject_stats FROM anon;
REVOKE ALL ON public.rate_limits           FROM anon;

REVOKE ALL ON public.students              FROM PUBLIC;
REVOKE ALL ON public.exam_attempts         FROM PUBLIC;
REVOKE ALL ON public.attempt_answers       FROM PUBLIC;
REVOKE ALL ON public.question_performance  FROM PUBLIC;
REVOKE ALL ON public.student_subject_stats FROM PUBLIC;
REVOKE ALL ON public.rate_limits           FROM PUBLIC;

-- authenticated: نبدأ من الصفر ثم نمنح القراءة فقط
REVOKE ALL ON public.students              FROM authenticated;
REVOKE ALL ON public.exam_attempts         FROM authenticated;
REVOKE ALL ON public.attempt_answers       FROM authenticated;
REVOKE ALL ON public.question_performance  FROM authenticated;
REVOKE ALL ON public.student_subject_stats FROM authenticated;
REVOKE ALL ON public.rate_limits           FROM authenticated;

-- ★ authenticated: قراءة فقط على كل جداول الطالب. لا INSERT ولا UPDATE ولا DELETE.
--   كل الكتابة تمر عبر SECURITY DEFINER RPCs (start/save/submit/create_review).
GRANT SELECT ON public.students              TO authenticated;
GRANT SELECT ON public.exam_attempts         TO authenticated;
GRANT SELECT ON public.attempt_answers       TO authenticated;
GRANT SELECT ON public.question_performance  TO authenticated;
GRANT SELECT ON public.student_subject_stats TO authenticated;
-- rate_limits: لا منحنى لـ authenticated إطلاقًا (يصل إليه RPC فقط)

-- ---------------------------------------------------------------------------
-- 2.3) students
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Students can view own profile" ON public.students;
CREATE POLICY "Students can view own profile"
    ON public.students
    FOR SELECT
    TO authenticated
    USING (auth_user_id = (SELECT auth.uid()));

-- لا INSERT (الصف يُنشأ بـ bootstrap_student)
-- لا UPDATE (قائمة بيضاء عبر update_own_profile)
-- لا DELETE (عبر delete_my_account)

-- ---------------------------------------------------------------------------
-- 2.4) exam_attempts — قراءة محاولات الطالب فقط
--      كل الكتابة (إنشاء/تحديث/تسليم) عبر SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Students can view own attempts" ON public.exam_attempts;
CREATE POLICY "Students can view own attempts"
    ON public.exam_attempts
    FOR SELECT
    TO authenticated
    USING (student_id = (SELECT private.current_student_id()));

-- ---------------------------------------------------------------------------
-- 2.5) attempt_answers — قراءة إجابات الطالب فقط
--      note: answered_at موجود في attempt_answers (وقت الإجابة) لا في المحاولة.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Students can view own answers" ON public.attempt_answers;
CREATE POLICY "Students can view own answers"
    ON public.attempt_answers
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.exam_attempts a
            WHERE a.id = attempt_answers.attempt_id
              AND a.student_id = (SELECT private.current_student_id())
        )
    );

-- ---------------------------------------------------------------------------
-- 2.6) question_performance — قراءة فقط
--      لا INSERT ولا UPDATE للطالب إطلاقًا: مصدره الوحيد submit_exam_attempt.
--      (يمنع الطالب من "تلميع" إحصاءاته قبل طلب امتحان الأخطاء.)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Students can view own question performance" ON public.question_performance;
CREATE POLICY "Students can view own question performance"
    ON public.question_performance
    FOR SELECT
    TO authenticated
    USING (student_id = (SELECT private.current_student_id()));

-- ---------------------------------------------------------------------------
-- 2.7) student_subject_stats — قراءة فقط
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Students can view own subject stats" ON public.student_subject_stats;
CREATE POLICY "Students can view own subject stats"
    ON public.student_subject_stats
    FOR SELECT
    TO authenticated
    USING (student_id = (SELECT private.current_student_id()));

-- ---------------------------------------------------------------------------
-- 2.8) الطواقم — قراءة إدارية عبر الصلاحيات
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff with students.view can read students" ON public.students;
CREATE POLICY "Staff with students.view can read students"
    ON public.students
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_staff())
        AND (SELECT private.has_any_scope('students.view'))
    );

DROP POLICY IF EXISTS "Staff with attempts.view can read attempts" ON public.exam_attempts;
CREATE POLICY "Staff with attempts.view can read attempts"
    ON public.exam_attempts
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_staff())
        AND (SELECT private.has_any_scope('attempts.view'))
    );

DROP POLICY IF EXISTS "Staff with attempts.view can read attempt answers" ON public.attempt_answers;
CREATE POLICY "Staff with attempts.view can read attempt answers"
    ON public.attempt_answers
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_staff())
        AND (SELECT private.has_any_scope('attempts.view'))
    );

-- question_performance على مستوى المنصة (أصعب الأسئلة) — للقراءة فقط،
-- عبر analytics.view (إحصاء عام) أو students.view (مرتبط بطلاب).
DROP POLICY IF EXISTS "Staff can read question performance" ON public.question_performance;
CREATE POLICY "Staff can read question performance"
    ON public.question_performance
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_staff())
        AND (
            (SELECT private.has_any_scope('analytics.view'))
            OR (SELECT private.has_any_scope('students.view'))
        )
    );

DROP POLICY IF EXISTS "Staff with attempts.view can read subject stats" ON public.student_subject_stats;
CREATE POLICY "Staff with attempts.view can read subject stats"
    ON public.student_subject_stats
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_staff())
        AND (SELECT private.has_any_scope('attempts.view'))
    );

-- rate_limits: لا سياسات — الوصول حصري عبر RPC، ولا readable من أي عميل.
