-- ============================================================================
-- 1) عزل بيانات الطالب (RLS) — الطالب يرى ملفه فقط ولا يكتب شيئًا مباشرة
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000010', true);  -- سارة

DO $$
DECLARE n INT;
BEGIN
    -- A1: يقرأ صفه فقط
    SELECT count(*) INTO n FROM public.students;
    IF n <> 1 THEN RAISE EXCEPTION 'A1 FAIL: يرى % صفوف طلاب (يجب 1)', n; END IF;
    RAISE NOTICE 'A1 PASS: الطالب يرى صفه فقط';

    -- A2: لا يكتب في students مباشرة (حتى لو كان صفه)
    BEGIN
        UPDATE public.students SET is_active = false WHERE email = 'sara@student.test';
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n <> 0 THEN RAISE EXCEPTION 'A2 FAIL: سمح بتعديل is_active مباشرة (% صفوف)', n; END IF;
        RAISE NOTICE 'A2 PASS: لا UPDATE مباشر على students';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'A2 PASS: لا UPDATE مباشر على students (الصلاحية مسحوبة)';
    END;

    -- A3: لا يكتب في students مباشرة (الجدول مسحوب منه INSERT)
    BEGIN
        INSERT INTO public.students (auth_user_id, email)
             VALUES (gen_random_uuid(), 'fake@evil.test');
        RAISE EXCEPTION 'A3 FAIL: سمح بـ INSERT في students';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'A3 PASS: لا INSERT مباشر في students';
    END;

    -- A4: لا ينشئ محاولة يدويًا بمحتوى مزيّف (الجدول مسحوب منه INSERT)
    BEGIN
        INSERT INTO public.exam_attempts (student_id, subject_id, total_questions, correct_count, score_percentage)
        SELECT s.id, 'b0000000-0000-0000-0000-000000000001', 100, 100, 100.00
        FROM public.students s LIMIT 1;
        RAISE EXCEPTION 'A4 FAIL: سمح بإنشاء محاولة بصحيحة=100 مباشرة';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'A4 PASS: لا INSERT مباشر في exam_attempts (مزوّج)';
    END;

    -- A5: ★ لا صلاحية كتابة أصلًا على attempt_answers (وليس فقط RLS)
    -- نتحقق من كتالوج الصلاحيات مباشرة: هذا ما يمنع INSERT حتى لو أُسقطت
    -- someday سياسة RLS بالخطأ (دفاع على مستويين).
    SELECT count(*) INTO n
    FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name IN ('attempt_answers','exam_attempts','students',
                         'question_performance','student_subject_stats','rate_limits')
      AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER');
    IF n <> 0 THEN RAISE EXCEPTION 'A5 FAIL: % صلاحيات كتابة على جداول الطالب لـ authenticated', n; END IF;
    RAISE NOTICE 'A5 PASS: ★ authenticated: قراءة فقط على كل جداول الطالب (0 صلاحية كتابة)';

    -- A6: لا يكتب في question_performance إطلاقًا (تلميع الإحصاء)
    BEGIN
        INSERT INTO public.question_performance (student_id, question_id, subject_id, times_seen, times_correct, times_wrong)
        SELECT s.id, q.id, q.subject_id, 10, 10, 0
        FROM public.students s, public.exam_questions q LIMIT 1;
        RAISE EXCEPTION 'A6 FAIL: سمح بتعديل question_performance مباشرة';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'A6 PASS: لا INSERT مباشر في question_performance';
    END;

    -- A7: question_performance فارغة (لا تسريب)
    SELECT count(*) INTO n FROM public.question_performance;
    IF n <> 0 THEN RAISE EXCEPTION 'A7 FAIL: يرى % صفوف performance (يجب 0 قبل أي تسليم)', n; END IF;
    RAISE NOTICE 'A7 PASS: question_performance فارغة (لا تسريب)';
END $$;

-- A7: طالب آخر لا يرى (سيُختبر في 02) — نتحقق هنا أن anon لا يرى شيئًا
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE n INT;
BEGIN
    BEGIN
        SELECT count(*) INTO n FROM public.students;
        RAISE EXCEPTION 'A7 FAIL: anon رأى % صفوف طلاب', n;
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'A7 PASS: anon لا يقرأ students';
    END;

    BEGIN
        SELECT count(*) INTO n FROM public.exam_attempts;
        RAISE EXCEPTION 'A7b FAIL: anon رأى % محاولات', n;
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'A7b PASS: anon لا يقرأ exam_attempts';
    END;

    BEGIN
        SELECT count(*) INTO n FROM public.question_performance;
        RAISE EXCEPTION 'A7c FAIL: anon رأى % صفوف performance', n;
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'A7c PASS: anon لا يقرأ question_performance';
    END;

    BEGIN
        SELECT count(*) INTO n FROM public.student_subject_stats;
        RAISE EXCEPTION 'A7d FAIL: anon رأى % صفوف subject_stats', n;
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'A7d PASS: anon لا يقرأ student_subject_stats';
    END;
END $$;
RESET ROLE;
ROLLBACK;
