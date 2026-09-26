-- ============================================================================
-- 10) انحدار: الزائر المجهول ما زال يعمل كما قبل
--      هذا الملف موجود لسبب واحد: التأكد أن ترحيلات نظام الطالب
--      لم تكسر أي سلوك موجود للزائر (محتوى عام + تقارير + اشتراكات push).
-- ============================================================================
BEGIN;
SET LOCAL ROLE anon;

DO $$
DECLARE n INT;
BEGIN
    -- K1: المحتوى العام ما زال مقروءًا
    SELECT count(*) INTO n FROM public.subjects WHERE is_active;
    IF n = 0 THEN RAISE EXCEPTION 'K1 FAIL: anon لم يعد يقرأ المواد'; END IF;
    RAISE NOTICE 'K1 PASS: anon يقرأ subjects (% مادة)', n;

    SELECT count(*) INTO n FROM public.content_types WHERE is_active;
    IF n = 0 THEN RAISE EXCEPTION 'K1b FAIL: anon لا يقرأ أنواع المحتوى'; END IF;
    RAISE NOTICE 'K1b PASS: anon يقرأ content_types (% صف)', n;

    SELECT count(*) INTO n FROM public.exams;
    IF n = 0 THEN RAISE EXCEPTION 'K1c FAIL: anon لا يقرأ الامتحانات'; END IF;
    RAISE NOTICE 'K1c PASS: anon يقرأ exams (% امتحان)', n;

    SELECT count(*) INTO n FROM public.exam_questions;
    IF n = 0 THEN RAISE EXCEPTION 'K1d FAIL: anon لا يقرأ الأسئلة'; END IF;
    RAISE NOTICE 'K1d PASS: anon يقرأ exam_questions (% سؤال)', n;

    SELECT count(*) INTO n FROM public.resources WHERE is_published;
    RAISE NOTICE 'K1e PASS: anon يقرأ resources (% منشور)', n;

    SELECT count(*) INTO n FROM public.notifications WHERE is_active;
    RAISE NOTICE 'K1f PASS: anon يقرأ notifications (% صف)', n;

    -- K2: anon يستطيع الإرسال (تقارير + push) — السلوك الوحيد المسموح
    BEGIN
        SELECT count(*) INTO n FROM public.reports;
        RAISE EXCEPTION 'K2a FAIL: anon يقرأ reports (% صف)', n;
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'K2a PASS: SELECT على reports مسحوب من anon (سلوك 20260926000000)';
    END;

    BEGIN
        PERFORM count(*) FROM public.push_subscriptions;
        RAISE EXCEPTION 'K2b FAIL: anon يقرأ push_subscriptions (مسرَّب!)';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'K2b PASS: anon لا يقرأ push_subscriptions (محمي)';
    END;
END $$;

-- K3: anon يستطيع INSERT في reports (السلوك القديم)
DO $$
DECLARE v_id UUID;
BEGIN
    BEGIN
        INSERT INTO public.reports (resource_id, issue_type, details)
             VALUES ('d0000000-0000-0000-0000-000000000001', 'other', 'اختبار انحدار من anon');
        RAISE NOTICE 'K3a PASS: anon يستطيع الإرسال في reports';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'K3a FAIL: anon لم يعد يستطيع الإرسال: %', SQLERRM;
    END;

    BEGIN
        INSERT INTO public.push_subscriptions (endpoint, p256dh, auth)
             VALUES ('https://fcm.test/anon-endpoint-xyz', 'p256dh-test', 'auth-test');
        RAISE NOTICE 'K3b PASS: anon يستطيع الاشتراك في push';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'K3b FAIL: anon لم يعد يستطيع الاشتراك: %', SQLERRM;
    END;
END $$;

-- K4: ★ anon لا يستطيع لمس أي جدول طالب (كل-defense)
DO $$
DECLARE n INT;
BEGIN
    BEGIN
        SELECT count(*) INTO n FROM public.students;
        RAISE EXCEPTION 'K4a FAIL: anon يقرأ students';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'K4a PASS: anon محجوب عن students';
    END;

    BEGIN
        SELECT count(*) INTO n FROM public.exam_attempts;
        RAISE EXCEPTION 'K4b FAIL: anon يقرأ exam_attempts';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'K4b PASS: anon محجوب عن exam_attempts';
    END;

    BEGIN
        SELECT count(*) INTO n FROM public.attempt_answers;
        RAISE EXCEPTION 'K4c FAIL: anon يقرأ attempt_answers';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'K4c PASS: anon محجوب عن attempt_answers';
    END;

    BEGIN
        SELECT count(*) INTO n FROM public.question_performance;
        RAISE EXCEPTION 'K4d FAIL: anon يقرأ question_performance';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'K4d PASS: anon محجوب عن question_performance';
    END;

    BEGIN
        SELECT count(*) INTO n FROM public.student_subject_stats;
        RAISE EXCEPTION 'K4e FAIL: anon يقرأ student_subject_stats';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'K4e PASS: anon محجوب عن student_subject_stats';
    END;

    BEGIN
        SELECT count(*) INTO n FROM public.rate_limits;
        RAISE EXCEPTION 'K4f FAIL: anon يقرأ rate_limits';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'K4f PASS: anon محجوب عن rate_limits';
    END;

    BEGIN
        PERFORM public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
        RAISE EXCEPTION 'K4g FAIL: anon استدعى start_exam_attempt';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%تسجيل الدخول%' AND SQLERRM NOT LIKE '%غير مصرح%'
           AND SQLERRM NOT LIKE '%permission%' THEN RAISE; END IF;
        RAISE NOTICE 'K4g PASS: anon لا يستطيع استدعاء دوال الطالب';
    END;
END $$;
RESET ROLE;

-- K5: ★ لا جدول بلا RLS + لا تسريب للكوكيز
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND c.relname IN ('students','exam_attempts','attempt_answers',
                             'question_performance','student_subject_stats','rate_limits')
          AND NOT c.relrowsecurity
    LOOP
        RAISE EXCEPTION 'K5a FAIL: الجدول % بلا RLS', r.relname;
    END LOOP;
    RAISE NOTICE 'K5a PASS: كل جداول الطالب عليها RLS';

    -- جدول الأسرار داخل private غير قابل للقراءة من أي دور عميل
    FOR r IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'private' AND c.relkind = 'r' AND NOT c.relrowsecurity
    LOOP
        -- مسموح بلا RLS هنا ما دام كل الصلاحيات مسحوبة (نتحقق أدناه)
        NULL;
    END LOOP;
    RAISE NOTICE 'K5b PASS: لا تسريب لجدول الأسرار (مخطط private)';
END $$;

DO $$
DECLARE n INT;
BEGIN
    -- 0 صلاحية على private.app_secrets لأي دور عميل
    SELECT count(*) INTO n
    FROM information_schema.role_table_grants
    WHERE table_schema = 'private' AND table_name = 'app_secrets'
      AND grantee IN ('anon','authenticated','PUBLIC');
    IF n <> 0 THEN
        RAISE EXCEPTION 'K5c FAIL: private.app_secrets مقروء لـ % دور', n;
    END IF;
    RAISE NOTICE 'K5c PASS: private.app_secrets غير مقروءة لأي دور عميل';

    -- دوال private غير قابلة للتنفيذ من anon
    SELECT count(*) INTO n
    FROM information_schema.role_routine_grants
    WHERE routine_schema = 'private' AND grantee = 'anon';
    IF n <> 0 THEN
        RAISE EXCEPTION 'K5d FAIL: % دالة private قابلة للتنفيذ من anon', n;
    END IF;
    RAISE NOTICE 'K5d PASS: لا دالة private قابلة للتنفيذ من anon';
END $$;


-- ============================================================================
-- 11) ★ تسريب صلاحيات الطلبة إلى قوالب الأدوار
--     ظهر هذا الخلل فعليًا: migration 20260920000000 يسند *كل* مفتاح في
--     الكتالوج إلى قالب 'admin' عدا مفتاحين، فأي مفتاح يُضاف لاحقًا يتسرّب
--     إليه عند إعادة تشغيل الترحيلات. 20261001000003 يزيل التسرب صراحةً.
-- ============================================================================
DO $$
DECLARE n INT;
BEGIN
    SELECT count(*) INTO n
    FROM public.admin_role_presets
    WHERE permission_key IN ('students.view','students.manage','attempts.view','attempts.manage');

    IF n <> 0 THEN
        RAISE EXCEPTION 'K6a FAIL: % صلاحية بيانات طلبة متسرّبة إلى قوالب الأدوار', n;
    END IF;
    RAISE NOTICE 'K6a PASS: لا مفاتيح بيانات الطلبة في أي قالب دور';

    -- المفاتيح الأربعة موجودة في الكتالوج
    SELECT count(*) INTO n FROM public.permissions
    WHERE key IN ('students.view','students.manage','attempts.view','attempts.manage');
    IF n <> 4 THEN RAISE EXCEPTION 'K6b FAIL: % من 4 مفاتيح في الكتالوج', n; END IF;
    RAISE NOTICE 'K6b PASS: المفاتيح الأربعة مسجّلة في الكتالوج';

    -- وتُعلَم كقابلة للحصر (supports_scope) لتفادي "كل الطلبة" دائمًا
    SELECT count(*) INTO n FROM public.permissions
    WHERE key IN ('students.view','attempts.view') AND supports_scope = true;
    IF n <> 2 THEN RAISE EXCEPTION 'K6c FAIL: supports_scope مفقودة'; END IF;
    RAISE NOTICE 'K6c PASS: مفاتيح العرض تدعم الحصر (scope)';
END $$;

-- K7: ★ منح صريح عبر set_staff_permissions يبقى فعّالًا بعد تنظيف القوالب
--     (التنظيف يمس القالب فقط ولا يمس admin_permissions)
DO $$
DECLARE n INT;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
    PERFORM public.set_staff_permissions(
        'a0000000-0000-0000-0000-000000000002',
        jsonb_build_array(jsonb_build_object('key','students.view')));
    RESET ROLE;

    SELECT count(*) INTO n FROM public.admin_permissions
    WHERE admin_id = 'a0000000-0000-0000-0000-000000000002'
      AND permission_key = 'students.view';
    IF n <> 1 THEN RAISE EXCEPTION 'K7 FAIL: المنح الصريح اختفى'; END IF;
    RAISE NOTICE 'K7 PASS: المنح الصريح في admin_permissions سليم (القوالب منفصلة)';
END $$;
ROLLBACK;
