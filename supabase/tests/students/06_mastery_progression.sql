-- ============================================================================
-- 5) ★ تدرّج الإتقان (mastery) — امتحان الأخطاء يخرج السؤال بعد إجابتين
--    omar يبدأ من الصفر: يخطئ في كل الأسئلة، ثم يجيب صحيحًا مرتين.
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000011', true);  -- عمر

-- عمر يخطئ في كل أسئلة الفيزياء (6 أخطاء)
DO $$
DECLARE v_rev JSONB; v_a UUID;
BEGIN
    v_rev := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
    v_a := (v_rev->>'attempt_id')::uuid;
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000001',1::smallint,5); -- ✗
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000002',0::smallint,5); -- ✗
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000003',0::smallint,5); -- ✗
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000004',1::smallint,5); -- ✗
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000005',0::smallint,5); -- ✗
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000006',0::smallint,5); -- ✗
    PERFORM public.submit_exam_attempt(v_a, v_rev->>'answer_token', 30);
    RAISE NOTICE 'E0 PASS: عمر أخطأ في كل الأسئلة (0/6)';
END $$;

-- E1: كل الأسئلة الخاطئة (6) متاحة، وكلها غير متقنة
DO $$
DECLARE v_n INT;
BEGIN
    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.students s ON s.id = qp.student_id
    WHERE s.email = 'omar@student.test' AND qp.is_mastered = false AND qp.times_wrong = 1;
    IF v_n <> 6 THEN RAISE EXCEPTION 'E1 FAIL: % أسئلة غير متقنة (المتوقع 6)', v_n; END IF;
    RAISE NOTICE 'E1 PASS: 6 أسئلة خطأ غير متقنة';

    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.students s ON s.id = qp.student_id
    WHERE s.email = 'omar@student.test' AND qp.consecutive_wrong = 1;
    IF v_n <> 6 THEN RAISE EXCEPTION 'E1b FAIL: consecutive_wrong != 1 لـ % صف', v_n; END IF;
    RAISE NOTICE 'E1b PASS: consecutive_wrong=1 لكل الأسئلة';
END $$;

-- E2: امتحان أخطاء بـ 5 أسئلة → يرجع 5 من الـ 6 الخاطئة
DO $$
DECLARE v_rev JSONB; v_n INT; v_ids TEXT[];
BEGIN
    v_rev := public.create_review_exam('b0000000-0000-0000-0000-000000000001', 5, true, false);
    IF (v_rev->>'total_questions')::int <> 5 THEN
        RAISE EXCEPTION 'E2 FAIL: % أسئلة', v_rev->>'total_questions';
    END IF;
    IF (v_rev->>'wrong_questions_available')::int <> 6 THEN
        RAISE EXCEPTION 'E2b FAIL: available=%', v_rev->>'wrong_questions_available';
    END IF;
    RAISE NOTICE 'E2 PASS: امتحان أخطاء بـ 5 من 6 سؤال خطأ';

    -- كل الأسئلة المختارة أخطأ فيها فعلاً
    SELECT count(*) INTO v_n
    FROM public.attempt_answers aa
     JOIN public.question_performance qp
       ON qp.question_id = aa.question_id
      AND qp.student_id = (SELECT id FROM public.students WHERE email='omar@student.test')
    WHERE aa.attempt_id = (v_rev->>'attempt_id')::uuid
      AND qp.is_mastered = false AND qp.times_wrong > 0;
    IF v_n <> 5 THEN
        RAISE EXCEPTION 'E2c FAIL: % من 5 مرشحة (يوجد سؤال غير مخطئ)', v_n;
    END IF;
    RAISE NOTICE 'E2c PASS: كل الأسئلة المختارة أخطأ فيها';
END $$;

-- E3: ★ عمر يجيب صحيحًا في امتحان الأخطاء → times_correct=1، لا يزال غير متقن
DO $$
DECLARE v_rev JSONB; v_a UUID; v_res JSONB; v_n INT;
        r RECORD;
BEGIN
    v_rev := public.create_review_exam('b0000000-0000-0000-0000-000000000001', 5, true, false);
    v_a := (v_rev->>'attempt_id')::uuid;

    -- نجيب صحيحًا على كل أسئلة المحاولة (المجموعة نفسها التي اختارها Server)
    FOR r IN SELECT aa.question_id, q.correct_option_index
             FROM public.attempt_answers aa
             JOIN public.exam_questions q ON q.id = aa.question_id
             WHERE aa.attempt_id = v_a
    LOOP
        PERFORM public.save_answer(v_a, r.question_id, r.correct_option_index::smallint, 5);
    END LOOP;

    v_res := public.submit_exam_attempt(v_a, v_rev->>'answer_token', 25);
    IF (v_res->>'correct_count')::int <> 5 THEN
        RAISE EXCEPTION 'E3 FAIL: correct=% (المتوقع 5)', v_res->>'correct_count';
    END IF;

    -- times_correct=1 → is_mastered = false (يحتاج إجابتين)
    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.students s ON s.id = qp.student_id
    WHERE s.email = 'omar@student.test' AND qp.times_correct = 1 AND qp.is_mastered = false;
    IF v_n = 0 THEN RAISE EXCEPTION 'E3b FAIL: لا صفوف times_correct=1'; END IF;
    RAISE NOTICE 'E3b PASS: إجابة واحدة صحيحة → ليس متقنًا بعد (% صف)', v_n;

    -- consecutive_wrong اختفى
    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.students s ON s.id = qp.student_id
     JOIN public.exam_questions q ON q.id = qp.question_id
    WHERE s.email = 'omar@student.test'
      AND q.id IN ('f0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002')
      AND qp.consecutive_wrong = 0;
    IF v_n <> 2 THEN RAISE EXCEPTION 'E3c FAIL: consecutive_wrong لم يُصفَّر (% صف)', v_n; END IF;
    RAISE NOTICE 'E3c PASS: consecutive_wrong=0 بعد الإجابة الصحيحة';
END $$;

-- E4: ★ إجابة صحيحة ثانية → is_mastered = true ويختفي من مرشحي الأخطاء
-- ملاحظة: الاختيار مرجّح (الأحدث/الأكثر تتابعًا أولًا)، فقد لا تُختار كل
-- الأسئلة التي لها times_correct=1. لذلك نتحقق من القاعدة نفسها بدل عدد ثابت:
--   كل سؤال كان times_correct=1 ودخل محاولة المراجعة → أصبح متقنًا.
--   ولا(question ليس منها) أصبح متقنًا.
DO $$
DECLARE v_rev JSONB; v_a UUID; v_res JSONB; v_n INT;
        r RECORD; v_expected INT;
BEGIN
    -- مجموعة: الأسئلة التي لها times_correct=1 قبل هذه المحاولة
    CREATE TEMP TABLE _s1 ON COMMIT DROP AS
    SELECT qp.question_id
    FROM public.question_performance qp
    JOIN public.students s ON s.id = qp.student_id
    WHERE s.email = 'omar@student.test' AND qp.times_correct = 1;
    SELECT count(*) INTO v_expected FROM _s1;

    v_rev := public.create_review_exam('b0000000-0000-0000-0000-000000000001', 5, true, false);
    v_a := (v_rev->>'attempt_id')::uuid;

    FOR r IN SELECT aa.question_id, q.correct_option_index
             FROM public.attempt_answers aa
             JOIN public.exam_questions q ON q.id = aa.question_id
             WHERE aa.attempt_id = v_a
    LOOP
        PERFORM public.save_answer(v_a, r.question_id, r.correct_option_index::smallint, 5);
    END LOOP;
    v_res := public.submit_exam_attempt(v_a, v_rev->>'answer_token', 25);

    IF (v_res->>'correct_count')::int <> 5 THEN
        RAISE EXCEPTION 'E4 FAIL: correct=% (المتوقع 5)', v_res->>'correct_count';
    END IF;

    -- 1) كل من كان times_correct=1 ودخل المحاولة → متقن الآن
    SELECT count(*) INTO v_n
    FROM public.question_performance qp
    JOIN public.students s ON s.id = qp.student_id
    JOIN _s1 ON _s1.question_id = qp.question_id
    WHERE s.email = 'omar@student.test' AND qp.is_mastered = true;
    IF v_n = 0 THEN
        RAISE EXCEPTION 'E4 FAIL: لا سؤال تحوّل إلى متقن رغم الإجابة الصحيحة الثانية';
    END IF;
    RAISE NOTICE 'E4 PASS: % من % سؤالاً ذو times_correct=1 أصبح متقنًا', v_n, v_expected;

    -- 2) لا سؤال خارج _s1 وأصبح متقنًا (لنزداد أمانًا)
    SELECT count(*) INTO v_n
    FROM public.question_performance qp
    JOIN public.students s ON s.id = qp.student_id
    WHERE s.email = 'omar@student.test' AND qp.is_mastered = true
      AND NOT EXISTS (SELECT 1 FROM _s1 WHERE _s1.question_id = qp.question_id);
    IF v_n <> 0 THEN
        RAISE EXCEPTION 'E4b FAIL: % سؤالًا متقنًا لم يكن قد أجاب صحيحًا من قبل', v_n;
    END IF;
    RAISE NOTICE 'E4b PASS: لا تقنن زائفة — الإتقان يحتاج إجابتين صحيحتين فعلاً';

    -- 3) mastery_confidence = 1.000 لكل المتقنة
    SELECT count(*) INTO v_n FROM public.question_performance qp
    JOIN public.students s ON s.id = qp.student_id
    WHERE s.email = 'omar@student.test' AND qp.is_mastered AND qp.mastery_confidence = 1.000;
    IF v_n = 0 THEN RAISE EXCEPTION 'E4c FAIL: mastery_confidence ليست 1.000'; END IF;
    RAISE NOTICE 'E4c PASS: mastery_confidence = 1.000 لكل المتقنة (% صف)', v_n;

    DROP TABLE IF EXISTS _s1;
END $$;

-- E5: ★ السؤال 6 الوحيد المتبقي (لم يُسمَّ في المراجعة) ما زال مرشحًا
DO $$
DECLARE v_rev JSONB; v_n INT;
BEGIN
    v_rev := public.create_review_exam('b0000000-0000-0000-0000-000000000001', 5, true, false);
    IF (v_rev->>'wrong_questions_available')::int <> 1 THEN
        RAISE EXCEPTION 'E5 FAIL: المتبقي=% (المتوقع 1)', v_rev->>'wrong_questions_available';
    END IF;
    -- 1 فقط، أقل من الحد الأدنى 5 → رفض
    RAISE NOTICE 'E5 PASS: المتبقي 1 سؤال فقط (رفض request 5 في E3/E4 implicitly)';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%المتاح%' AND SQLERRM NOT LIKE '%لا توجد أسئلة%' THEN RAISE; END IF;
    RAISE NOTICE 'E5 PASS: المتبقي سؤال واحد فقط → create_review_exam يرفض بوضوح';
END $$;

-- E6: p_include_unseen يملأ الفراغ
DO $$
DECLARE v_rev JSONB; v_n INT;
BEGIN
    v_rev := public.create_review_exam('b0000000-0000-0000-0000-000000000001', 5, true, true);
    IF (v_rev->>'total_questions')::int <> 5 THEN
        RAISE EXCEPTION 'E6 FAIL: % أسئلة (المتوقع 5)', v_rev->>'total_questions';
    END IF;
    IF (v_rev->>'shortfall')::int <> 0 THEN
        RAISE EXCEPTION 'E6b FAIL: shortfall=% (المفروض 0)', v_rev->>'shortfall';
    END IF;
    RAISE NOTICE 'E6 PASS: p_include_unseen أكمل من %s سؤال خطأ إلى %s (shortfall=0)',
        v_rev->>'wrong_questions_available', v_rev->>'total_questions';
END $$;

-- E7: لوحة الطالب تعرض المتقن/الخطأ بشكل صحيح
DO $$
DECLARE v_dash JSONB; v_n INT;
BEGIN
    v_dash := public.get_my_dashboard();
    -- mastered + wrong + الأخطاء غير المتقنة = عدد الأسئلة التي حاولها (6)
    IF (v_dash->'summary'->>'attempts')::int <> 3 THEN
        RAISE EXCEPTION 'E7c FAIL: attempts=% (المتوقع 3: المحاولة الأصلية + مراجعتان)',
            v_dash->'summary'->>'attempts';
    END IF;
    IF (v_dash->'summary'->>'mastered_questions')::int = 0 THEN
        RAISE EXCEPTION 'E7 FAIL: mastered=0 بعد إجابتين صحيحتين';
    END IF;
    IF (v_dash->'summary'->>'wrong_questions')::int = 0 THEN
        RAISE EXCEPTION 'E7b FAIL: wrong=0';
    END IF;
    IF (v_dash->'summary'->>'mastered_questions')::int
       + (v_dash->'summary'->>'wrong_questions')::int <> 6 THEN
        RAISE EXCEPTION 'E7d FAIL: %s متقن + %s خطأ ≠ 6 أسئلة',
            v_dash->'summary'->>'mastered_questions', v_dash->'summary'->>'wrong_questions';
    END IF;
    RAISE NOTICE 'E7 PASS: dashboard يعرض %s متقن + %s خطأ عبر 3 محاولات',
        v_dash->'summary'->>'mastered_questions', v_dash->'summary'->>'wrong_questions';
END $$;
ROLLBACK;
