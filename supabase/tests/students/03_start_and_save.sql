-- ============================================================================
-- 2) بدء المحاولة وحفظ الإجابات
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000010', true);  -- سارة

DO $$
DECLARE
    v_start   JSONB;
    v_attempt UUID;
    v_n       INT;
    v_q       JSONB;
BEGIN
    -- B1: يبدأ محاولة
    v_start := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
    v_attempt := (v_start->>'attempt_id')::uuid;

    IF v_attempt IS NULL THEN RAISE EXCEPTION 'B1 FAIL: لا attempt_id'; END IF;
    IF jsonb_array_length(v_start->'questions') <> 6 THEN
        RAISE EXCEPTION 'B1 FAIL: % أسئلة (المتوقع 6)', jsonb_array_length(v_start->'questions');
    END IF;
    IF (v_start->>'total_questions')::int <> 6 THEN
        RAISE EXCEPTION 'B1 FAIL: total_questions=%', v_start->>'total_questions';
    END IF;
    IF (v_start->>'answer_token') IS NULL OR length(v_start->>'answer_token') < 32 THEN
        RAISE EXCEPTION 'B1 FAIL: لا answer_token صالح';
    END IF;
    RAISE NOTICE 'B1 PASS: بدأت محاولة بـ 6 أسئلة + answer_token';

    -- B2: ★ الأسئلة المُعادة بلا correct_index ولا explanation (تسريب الإجابات)
    v_q := v_start->'questions'->0;
    IF v_q ? 'correct_index' THEN RAISE EXCEPTION 'B2 FAIL: correct_index مسرَّب!'; END IF;
    IF v_q ? 'correct_option_index' THEN RAISE EXCEPTION 'B2 FAIL: correct_option_index مسرَّب!'; END IF;
    IF v_q ? 'explanation' THEN RAISE EXCEPTION 'B2 FAIL: explanation مسرَّب!'; END IF;
    IF NOT (v_q ? 'id') OR NOT (v_q ? 'options') THEN
        RAISE EXCEPTION 'B2 FAIL: الحقول الأساسية ناقصة';
    END IF;
    RAISE NOTICE 'B2 PASS: ★ لا تسريب لمفتاح الإجابة أو الشرح في حمولة البدء';

    -- B3: حجز صف لكل سؤال + expires_at
    SELECT count(*) INTO v_n FROM public.attempt_answers WHERE attempt_id = v_attempt;
    IF v_n <> 6 THEN RAISE EXCEPTION 'B3 FAIL: % صفوف إجابات محجوزة', v_n; END IF;

    SELECT count(*) INTO v_n FROM public.exam_attempts
     WHERE id = v_attempt AND status = 'in_progress' AND expires_at > now();
    IF v_n <> 1 THEN RAISE EXCEPTION 'B3 FAIL: حالة المحاولة أو expires_at غير صحيحة'; END IF;
    RAISE NOTICE 'B3 PASS: 6 صفوف محجوزة + expires_at مضبوط';

    -- B4: attempt.subject_id مطبوع من exams.subject_id
    SELECT count(*) INTO v_n FROM public.exam_attempts
     WHERE id = v_attempt AND subject_id = 'b0000000-0000-0000-0000-000000000001';
    IF v_n <> 1 THEN RAISE EXCEPTION 'B4 FAIL: subject_id خطأ'; END IF;
    RAISE NOTICE 'B4 PASS: subject_id مطبوع بشكل صحيح';

    -- B5: حفظ إجابات
    PERFORM public.save_answer(v_attempt,'f0000000-0000-0000-0000-000000000001',0::smallint,30); -- صحيح
    PERFORM public.save_answer(v_attempt,'f0000000-0000-0000-0000-000000000002',3::smallint,25); -- غلط
    PERFORM public.save_answer(v_attempt,'f0000000-0000-0000-0000-000000000003',2::smallint,20); -- صحيح
    -- الباقي يُترك فارغًا
    SELECT count(*) INTO v_n FROM public.attempt_answers
     WHERE attempt_id = v_attempt AND is_correct IS NULL;
    IF v_n <> 6 THEN RAISE EXCEPTION 'B5 FAIL: التصحيح يجب ألا يحدث قبل التسليم (% صف غير مصحّح)', v_n; END IF;
    RAISE NOTICE 'B5 PASS: كل الإجابات بدون تصحيح قبل التسليم (لا تسريب تدريجي)';

    -- B6: تغيير الإجابة يحدّث ولا يضاعف
    PERFORM public.save_answer(v_attempt,'f0000000-0000-0000-0000-000000000002',1::smallint,25); -- تصحيح
    SELECT count(*) INTO v_n FROM public.attempt_answers
     WHERE attempt_id = v_attempt AND question_id = 'f0000000-0000-0000-0000-000000000002'
       AND selected_index = 1 AND is_blank = false;
    IF v_n <> 1 THEN RAISE EXCEPTION 'B6 FAIL: تغيير الإجابة لم يُطبَّق'; END IF;
    SELECT count(*) INTO v_n FROM public.attempt_answers WHERE attempt_id = v_attempt;
    IF v_n <> 6 THEN RAISE EXCEPTION 'B6 FAIL: تكرّرت صفوف الإجابات (% صف)', v_n; END IF;
    RAISE NOTICE 'B6 PASS: تغيير الإجابة يعمل (upsert بلا تكرار)';

    -- B7: لا يسجّل التصحيح في question_performance قبل التسليم
    SELECT count(*) INTO v_n FROM public.question_performance;
    IF v_n > 0 THEN RAISE EXCEPTION 'B7 FAIL: question_performance معدّلة قبل التسليم'; END IF;
    RAISE NOTICE 'B7 PASS: question_performance فارغة قبل التسليم';

    -- B8: استئناف المحاولة المفتوحة بدل إنشاء جديد
    v_start := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
    IF (v_start->>'attempt_id')::uuid <> v_attempt THEN
        RAISE EXCEPTION 'B8 FAIL: أُنشئت محاولة جديدة بدل الاستئناف';
    END IF;
    IF (v_start->>'is_new')::boolean <> false THEN
        RAISE EXCEPTION 'B8 FAIL: is_new يجب أن يكون false عند الاستئناف';
    END IF;
    RAISE NOTICE 'B8 PASS: استئناف المحاولة المفتوحة بدل إنشاء جديد';

    -- B9: لا يبدأ امتحانًا غير منشور
    BEGIN
        PERFORM public.start_exam_attempt('e0000000-0000-0000-0000-000000000002');
        RAISE EXCEPTION 'B9 FAIL: بدأ امتحانًا مسودة';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير منشور%' THEN RAISE; END IF;
        RAISE NOTICE 'B9 PASS: رفض بدء امتحان غير منشور';
    END;

    -- B10: لا يبدأ بامتحان غير موجود
    BEGIN
        PERFORM public.start_exam_attempt('e0000000-0000-0000-0000-0000000000ff');
        RAISE EXCEPTION 'B10 FAIL: بدأ امتحانًا غير موجود';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير موجود%' THEN RAISE; END IF;
        RAISE NOTICE 'B10 PASS: رفض بدء امتحان غير موجود';
    END;

    -- B11: لا يحفظ في محاولة شخص آخر
    BEGIN
        PERFORM public.save_answer('e0000000-0000-0000-0000-0000000000ee','f0000000-0000-0000-0000-000000000001',0::smallint,5);
        RAISE EXCEPTION 'B11 FAIL: حفظ في محاولة غير موجودة/خارجية';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير موجودة%' THEN RAISE; END IF;
        RAISE NOTICE 'B11 PASS: لا حفظ في محاولة خارج حسابه';
    END;
END $$;
ROLLBACK;
