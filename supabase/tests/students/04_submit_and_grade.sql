-- ============================================================================
-- 3) التسليم والتصحيح + تسجيل question_performance + الإحصاءات
--    سارة تجيب: 1 صحيح، 2 صحيح، 3 غلط، 4 صحيح، 5 غلط، 6 فارغ  → 3/6 = 50%
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000010', true);

DO $$
DECLARE
    v_start   JSONB;
    v_attempt UUID;
    v_token   TEXT;
    v_res     JSONB;
    v_n       INT;
    v_num     NUMERIC;
BEGIN
    v_start := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
    v_attempt := (v_start->>'attempt_id')::uuid;
    v_token   := v_start->>'answer_token';

    PERFORM public.save_answer(v_attempt,'f0000000-0000-0000-0000-000000000001',0::smallint,10); -- ✓
    PERFORM public.save_answer(v_attempt,'f0000000-0000-0000-0000-000000000002',1::smallint,12); -- ✓
    PERFORM public.save_answer(v_attempt,'f0000000-0000-0000-0000-000000000003',0::smallint,8);  -- ✗ (الصحيح 2)
    PERFORM public.save_answer(v_attempt,'f0000000-0000-0000-0000-000000000004',0::smallint,9);  -- ✓
    PERFORM public.save_answer(v_attempt,'f0000000-0000-0000-0000-000000000005',0::smallint,11); -- ✗ (الصحيح 1)
    -- 6: بلا إجابة

    -- C1: ★ التسليم بتوكن صحيح
    v_res := public.submit_exam_attempt(v_attempt, v_token, 50);

    IF (v_res->>'correct_count')::int <> 3 THEN
        RAISE EXCEPTION 'C1 FAIL: correct_count=% (المتوقع 3)', v_res->>'correct_count';
    END IF;
    IF (v_res->>'wrong_count')::int <> 2 THEN
        RAISE EXCEPTION 'C1 FAIL: wrong_count=% (المتوقع 2)', v_res->>'wrong_count';
    END IF;
    IF (v_res->>'blank_count')::int <> 1 THEN
        RAISE EXCEPTION 'C1 FAIL: blank_count=% (المتوقع 1)', v_res->>'blank_count';
    END IF;
    IF (v_res->>'total_questions')::int <> 6 THEN
        RAISE EXCEPTION 'C1 FAIL: total=%', v_res->>'total_questions';
    END IF;
    SELECT (v_res->>'score_percentage')::numeric INTO v_num;
    IF v_num <> 50.00 THEN RAISE EXCEPTION 'C1 FAIL: score=% (المتوقع 50.00)', v_num; END IF;
    RAISE NOTICE 'C1 PASS: التصحيح صحيح 3/2/1 = 50%%';

    -- C2: تفاصيل الإجابات تصل مع الشرح ومفتاح الإجابة
    IF jsonb_array_length(v_res->'answers') <> 6 THEN
        RAISE EXCEPTION 'C2 FAIL: % تفاصيل إجابة', jsonb_array_length(v_res->'answers');
    END IF;
    IF NOT (v_res->'answers'->0 ? 'correct_index') THEN
        RAISE EXCEPTION 'C2 FAIL: correct_index مفقود بعد التسليم';
    END IF;
    IF NOT (v_res->'answers'->0 ? 'explanation') THEN
        RAISE EXCEPTION 'C2 FAIL: explanation مفقود بعد التسليم';
    END IF;
    IF (v_res->'answers'->0->>'is_correct')::boolean <> true THEN
        RAISE EXCEPTION 'C2 FAIL: إجابة السؤال 1 يجب أن تكون صحيحة';
    END IF;
    IF (v_res->'answers'->5->>'is_blank')::boolean <> true THEN
        RAISE EXCEPTION 'C2 FAIL: السؤال 6 يجب أن يكون فارغًا';
    END IF;
    RAISE NOTICE 'C2 PASS: تفاصيل الإجابات + الشرح + مفتاح الإجابة بعد التسليم';

    -- C3: ★ question_performance: صف لكل سؤال seen
    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.students s ON s.id = qp.student_id
    WHERE s.email = 'sara@student.test';
    IF v_n <> 6 THEN RAISE EXCEPTION 'C3 FAIL: % صفوف performance (المتوقع 6)', v_n; END IF;
    RAISE NOTICE 'C3 PASS: question_performance فيها صف لكل سؤال';

    -- C4: الأرقام صحيحة
    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.students s ON s.id = qp.student_id
     JOIN public.exam_questions q ON q.id = qp.question_id
    WHERE s.email = 'sara@student.test' AND q.id = 'f0000000-0000-0000-0000-000000000001'
      AND qp.times_seen = 1 AND qp.times_correct = 1 AND qp.times_wrong = 0
      AND qp.is_mastered = false AND qp.consecutive_wrong = 0;
    IF v_n <> 1 THEN RAISE EXCEPTION 'C4 FAIL: صف السؤال الصحيح غير صحيح'; END IF;

    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.students s ON s.id = qp.student_id
     JOIN public.exam_questions q ON q.id = qp.question_id
    WHERE s.email = 'sara@student.test' AND q.id = 'f0000000-0000-0000-0000-000000000003'
      AND qp.times_seen = 1 AND qp.times_correct = 0 AND qp.times_wrong = 1
      AND qp.is_mastered = false AND qp.consecutive_wrong = 1
      AND qp.last_wrong_at IS NOT NULL;
    IF v_n <> 1 THEN RAISE EXCEPTION 'C4b FAIL: صف السؤال الخاطئ غير صحيح'; END IF;

    -- السؤال الفارغ يُحسب seen=1 بلا خطأ
    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.students s ON s.id = qp.student_id
     JOIN public.exam_questions q ON q.id = qp.question_id
    WHERE s.email = 'sara@student.test' AND q.id = 'f0000000-0000-0000-0000-000000000006'
      AND qp.times_seen = 1 AND qp.times_wrong = 0;
    IF v_n <> 1 THEN RAISE EXCEPTION 'C4c FAIL: السؤال الفارغ لا يُحسب seen'; END IF;
    RAISE NOTICE 'C4 PASS: أرقام question_performance صحيحة (صحيح/غلط/فارغ)';

    -- C5: عدّادات الطالب
    SELECT count(*) INTO v_n FROM public.students
     WHERE email = 'sara@student.test'
       AND total_exams_taken = 1 AND total_questions = 6
       AND total_correct = 3 AND total_wrong = 2;
    IF v_n <> 1 THEN RAISE EXCEPTION 'C5 FAIL: عدّادات students غير صحيحة'; END IF;
    RAISE NOTICE 'C5 PASS: عدّادات students.total_* صحيحة';

    -- C6: تجميع per مادة
    SELECT count(*) INTO v_n FROM public.student_subject_stats ss
     JOIN public.students s ON s.id = ss.student_id
    WHERE s.email = 'sara@student.test'
      AND ss.attempts_count = 1 AND ss.total_questions = 6
      AND ss.total_correct = 3 AND ss.avg_score = 50.00 AND ss.best_score = 50.00
      AND ss.wrong_questions_count = 2;
    IF v_n <> 1 THEN RAISE EXCEPTION 'C6 FAIL: student_subject_stats غير صحيح'; END IF;
    RAISE NOTICE 'C6 PASS: تجميع per مادة صحيح (attempts/avg/best/wrong)';

    -- C7: إحصاء المنصة على مستوى السؤال
    SELECT count(*) INTO v_n FROM public.exam_questions
     WHERE id = 'f0000000-0000-0000-0000-000000000001'
       AND times_attempted = 1 AND times_correct = 1;
    IF v_n <> 1 THEN RAISE EXCEPTION 'C7 FAIL: times_attempted/times_correct خطأ'; END IF;
    RAISE NOTICE 'C7 PASS: times_attempted/times_correct على السؤال صحيحة';

    -- C8: حالة المحاولة + time_spent
    SELECT count(*) INTO v_n FROM public.exam_attempts
     WHERE id = v_attempt AND status = 'submitted' AND submitted_at IS NOT NULL
       AND time_spent_seconds = 50 AND score_percentage = 50.00;
    IF v_n <> 1 THEN RAISE EXCEPTION 'C8 FAIL: حالة المحاولة بعد التسليم غير صحيحة'; END IF;
    RAISE NOTICE 'C8 PASS: status=submitted + time_spent + score';

    -- C9: ★ replay مرفوض
    BEGIN
        PERFORM public.submit_exam_attempt(v_attempt, v_token, 50);
        RAISE EXCEPTION 'C9 FAIL: سمح بإعادة تسليم نفس المحاولة';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%مسبقًا%' THEN RAISE; END IF;
        RAISE NOTICE 'C9 PASS: replay التسليم مرفوض';
    END;

    -- C10: ★ توكن مزيّف مرفوض (محاولة جديدة بتسليم بتوكن غير صحيح)
    DECLARE v_a2 UUID;
    BEGIN
        v_start := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
        v_a2 := (v_start->>'attempt_id')::uuid;

        BEGIN
            PERFORM public.submit_exam_attempt(v_a2, repeat('0', 64), 10);
            RAISE EXCEPTION 'C10 FAIL: سمح بتسليم بتوكن مزوّر';
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%سلامة%' THEN RAISE; END IF;
            RAISE NOTICE 'C10a PASS: توكن مزوّر مرفوض';
        END;

        BEGIN
            PERFORM public.submit_exam_attempt(v_a2, NULL, 10);
            RAISE EXCEPTION 'C10 FAIL: سمح بتسليم بدون توكن';
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%سلامة%' THEN RAISE; END IF;
            RAISE NOTICE 'C10b PASS: توكن فارغ مرفوض';
        END;

        -- التوكن الصحيح من نفس المحاولة يعمل
        PERFORM public.submit_exam_attempt(v_a2, v_start->>'answer_token', 10);
        RAISE NOTICE 'C10c PASS: التوكن الصحيح للمحاولة نفسها مقبول';
    END;
END $$;
ROLLBACK;
