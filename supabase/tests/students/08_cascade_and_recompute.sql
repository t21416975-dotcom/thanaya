-- ============================================================================
-- 8) حذف البيانات (GDPR) + cascade + إعادة الحساب
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000010', true);  -- سارة

DO $$
DECLARE v JSONB; v_n INT; r RECORD;
BEGIN
    -- تبني تاريخ سارة: امتحان كامل + مراجعة
    v := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
    FOR r IN SELECT aa.question_id, q.correct_option_index
             FROM public.attempt_answers aa
             JOIN public.exam_questions q ON q.id = aa.question_id
             WHERE aa.attempt_id = (v->>'attempt_id')::uuid
    LOOP
        PERFORM public.save_answer((v->>'attempt_id')::uuid, r.question_id,
                                   r.correct_option_index::smallint, 5);
    END LOOP;
    PERFORM public.submit_exam_attempt((v->>'attempt_id')::uuid, v->>'answer_token', 30);

    v := public.create_review_exam('b0000000-0000-0000-0000-000000000001', 5, true, true);
    FOR r IN SELECT aa.question_id, q.correct_option_index
             FROM public.attempt_answers aa
             JOIN public.exam_questions q ON q.id = aa.question_id
             WHERE aa.attempt_id = (v->>'attempt_id')::uuid
    LOOP
        PERFORM public.save_answer((v->>'attempt_id')::uuid, r.question_id,
                                   r.correct_option_index::smallint, 5);
    END LOOP;
    PERFORM public.submit_exam_attempt((v->>'attempt_id')::uuid, v->>'answer_token', 30);
    RAISE NOTICE 'I0 PASS: سارة لها محاولتان مسلّمتان';
END $$;

-- I1: cascade يحذف كل شيء عند حذف الطالب
-- (الحذف يتم كـ postgres — الطالب نفسه لا يملك صلاحية DELETE وهذا هو المطلوب)
RESET ROLE;
DO $$
DECLARE v_n INT;
BEGIN
    SELECT count(*) INTO v_n FROM public.exam_attempts WHERE student_id =
        (SELECT id FROM public.students WHERE email='sara@student.test');
    IF v_n <> 2 THEN RAISE EXCEPTION 'I1 SETUP FAIL: % محاولات', v_n; END IF;

    DELETE FROM public.students WHERE email = 'sara@student.test';

    SELECT count(*) INTO v_n FROM public.exam_attempts
     WHERE student_id NOT IN (SELECT id FROM public.students);
    IF v_n <> 0 THEN RAISE EXCEPTION 'I1 FAIL: % محاولة معلّقة', v_n; END IF;

    SELECT count(*) INTO v_n FROM public.attempt_answers aa
      WHERE NOT EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.id = aa.attempt_id);
    IF v_n <> 0 THEN RAISE EXCEPTION 'I1b FAIL: % إجابة معلّقة', v_n; END IF;

    SELECT count(*) INTO v_n FROM public.question_performance
     WHERE student_id NOT IN (SELECT id FROM public.students);
    IF v_n <> 0 THEN RAISE EXCEPTION 'I1c FAIL: % صف performance معلّق', v_n; END IF;

    SELECT count(*) INTO v_n FROM public.student_subject_stats
     WHERE student_id NOT IN (SELECT id FROM public.students);
    IF v_n <> 0 THEN RAISE EXCEPTION 'I1d FAIL: % صف subject_stats معلّق', v_n; END IF;

    RAISE NOTICE 'I1 PASS: ★ cascade حذف المحاولات + الإجابات + performance + stats';
END $$;

-- I2: حذف auth user يزيل صف الطالب (حذف من جهة auth)
RESET ROLE;
DO $$
DECLARE v_n INT;
BEGIN
    -- I1 حذف صف الطالب فقط (auth.users ما زال موجودًا) — نُعيد الحساب
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('a0000000-0000-0000-0000-000000000010','sara@student.test',
            '{"full_name":"سارة أحمد"}', now())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    INSERT INTO auth.identities (user_id, provider)
    VALUES ('a0000000-0000-0000-0000-000000000010','google')
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'I2a INFO: حساب سارة موجود للاختبار';
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000010', true);
DO $$ BEGIN
    PERFORM public.bootstrap_student();
    RAISE NOTICE 'I2b PASS: bootstrap بعد إعادة الحساب يعمل';
END $$;

RESET ROLE;
DO $$
DECLARE v_n INT;
BEGIN
    DELETE FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000010';
    SELECT count(*) INTO v_n FROM public.students
     WHERE auth_user_id = 'a0000000-0000-0000-0000-000000000010';
    IF v_n <> 0 THEN RAISE EXCEPTION 'I2c FAIL: صف الطالب بقي بعد حذف auth user'; END IF;
    RAISE NOTICE 'I2c PASS: حذف auth.users يحذف صف الطالب تلقائيًا';
END $$;

-- I3: ★ إعادة الحساب بعد حذف محاولة (admin_delete_attempt)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000011', true);  -- عمر
DO $$
DECLARE v JSONB; v_a UUID; r RECORD; v_n INT;
BEGIN
    v := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
    v_a := (v->>'attempt_id')::uuid;
    FOR r IN SELECT aa.question_id, q.correct_option_index
             FROM public.attempt_answers aa
             JOIN public.exam_questions q ON q.id = aa.question_id
             WHERE aa.attempt_id = v_a
    LOOP
        PERFORM public.save_answer(v_a, r.question_id, r.correct_option_index::smallint, 5);
    END LOOP;
    PERFORM public.submit_exam_attempt(v_a, v->>'answer_token', 30);

    -- إجابة صحيحة واحدة لكل سؤال → times_correct=1 وليس متقنًا (يحتاج 2)
    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.students s ON s.id = qp.student_id
    WHERE s.email = 'omar@student.test' AND qp.times_correct = 1 AND NOT qp.is_mastered;
    IF v_n <> 6 THEN RAISE EXCEPTION 'I3 SETUP FAIL: % صف times_correct=1', v_n; END IF;
    RAISE NOTICE 'I3a PASS: عمر 6 أسئلة صحيحة من أول مرة (ليس متقنًا بعد)';
END $$;

-- المدير العام يحذف المحاولة → يجب أن تتراجع أرقام الإتقان
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
DO $$
BEGIN
    PERFORM public.set_staff_permissions(
        'a0000000-0000-0000-0000-000000000001',
        jsonb_build_array(jsonb_build_object('key', 'attempts.manage')));
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000011', true);
DO $$
DECLARE v_n INT;
BEGIN
    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.students s ON s.id = qp.student_id
    WHERE s.email = 'omar@student.test';
    IF v_n <> 6 THEN RAISE EXCEPTION 'I3 SETUP2 FAIL: % صف performance', v_n; END IF;
    RAISE NOTICE 'I3b PASS: performance فيها 6 صفوف قبل الحذف';
END $$;

-- ننفّذ الحذف كمدير عام
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE v_n INT; v_target UUID;
BEGIN
    SELECT a.id INTO v_target FROM public.exam_attempts a
      JOIN public.students s ON s.id = a.student_id
     WHERE s.email = 'omar@student.test' AND a.status = 'submitted' LIMIT 1;

    PERFORM public.admin_delete_attempt(v_target);

    -- ★ كل الإحصاءات تتراجع: لا محاولات → لا performance إطلاقًا
    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.students s ON s.id = qp.student_id
    WHERE s.email = 'omar@student.test';
    IF v_n <> 0 THEN
        RAISE EXCEPTION 'I3c FAIL: % صف performance بقي بعد حذف المحاولة (لم تُعد الحسابات)', v_n;
    END IF;
    RAISE NOTICE 'I3c PASS: ★ admin_delete_attempt أعاد حساب question_performance (0 صف)';

    SELECT count(*) INTO v_n FROM public.students
     WHERE email='omar@student.test' AND total_exams_taken = 0 AND total_correct = 0;
    IF v_n <> 1 THEN RAISE EXCEPTION 'I3d FAIL: عدّادات students لم تُعد'; END IF;
    RAISE NOTICE 'I3d PASS: عدّادات students.total_* أُعيدت إلى الصفر';

    -- تجميع المواد اختفى أيضًا
    SELECT count(*) INTO v_n FROM public.student_subject_stats ss
     JOIN public.students s ON s.id = ss.student_id
    WHERE s.email = 'omar@student.test';
    IF v_n <> 0 THEN RAISE EXCEPTION 'I3e FAIL: % صف subject_stats بقي', v_n; END IF;
    RAISE NOTICE 'I3e PASS: تجميع المواد أُعيد بنجاح';
END $$;
ROLLBACK;
