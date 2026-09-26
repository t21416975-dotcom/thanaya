-- ============================================================================
-- 4) ★ "امتحان الأخطاء" — create_review_exam
--    تهيئة: سارة عندها أخطاء في الفيزياء (س3، س5) وأخطاء في الكيمياء (س7)
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000010', true);

DO $$
DECLARE
    v_rev JSONB; v_a UUID; v_n INT; v_nt TEXT;
    v_ids TEXT[];
BEGIN
    -- تهيئة: محاولة فيزياء (غلط في 3 و5)، وفي محاولة كيمياء (غلط في 7)

    -- ---- فيزياء ----
    v_rev := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
    v_a := (v_rev->>'attempt_id')::uuid;
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000001',0::smallint,5); -- ✓
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000002',1::smallint,5); -- ✓
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000003',0::smallint,5); -- ✗
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000004',0::smallint,5); -- ✓
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000005',0::smallint,5); -- ✗
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000006',3::smallint,5); -- ✓
    PERFORM public.submit_exam_attempt(v_a, v_rev->>'answer_token', 30);

    -- ---- كيمياء ----
    v_rev := public.start_exam_attempt('e0000000-0000-0000-0000-000000000003');
    v_a := (v_rev->>'attempt_id')::uuid;
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000007',0::smallint,5); -- ✗ (الصحيح 1)
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000008',0::smallint,5); -- ✓ (الصحيح 0)
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-000000000009',0::smallint,5); -- ✓
    PERFORM public.save_answer(v_a,'f0000000-0000-0000-0000-00000000000a',0::smallint,5); -- ✓
    PERFORM public.submit_exam_attempt(v_a, v_rev->>'answer_token', 20);

    -- ============ D1: إنشاء امتحان أخطاء للفيزياء ============
    -- 2 سؤال خطأ + 3 أسئلة لم تُحاول (من امتحان الوحدة الثانية) = 5
    v_rev := public.create_review_exam('b0000000-0000-0000-0000-000000000001', 5, true, true);
    v_a := (v_rev->>'attempt_id')::uuid;

    IF (v_rev->>'mode') <> 'review' THEN RAISE EXCEPTION 'D1 FAIL: mode=%', v_rev->>'mode'; END IF;
    IF (v_rev->>'exam_id') IS NOT NULL THEN
        RAISE EXCEPTION 'D1 FAIL: exam_id يجب أن يكون NULL لامتحان الأخطاء';
    END IF;
    IF (v_rev->>'subject_id')::uuid <> 'b0000000-0000-0000-0000-000000000001' THEN
        RAISE EXCEPTION 'D1 FAIL: subject_id خطأ';
    END IF;
    IF (v_rev->>'wrong_questions_available')::int <> 2 THEN
        RAISE EXCEPTION 'D1 FAIL: available=% (المتوقع 2)', v_rev->>'wrong_questions_available';
    END IF;
    RAISE NOTICE 'D1 PASS: attempt review بدون exam_id + subject_id صحيح';

    -- ============ D2: العدد المطلوب محترم + shortfall معلَن ============
    IF (v_rev->>'total_questions')::int <> 5 THEN
        RAISE EXCEPTION 'D2 FAIL: % أسئلة (المتوقع 5)', v_rev->>'total_questions';
    END IF;
    IF jsonb_array_length(v_rev->'questions') <> 5 THEN
        RAISE EXCEPTION 'D2 FAIL: payload فيها % سؤال', jsonb_array_length(v_rev->'questions');
    END IF;
    IF (v_rev->>'requested_questions')::int <> 5 THEN
        RAISE EXCEPTION 'D2b FAIL: requested=%', v_rev->>'requested_questions';
    END IF;
    IF (v_rev->>'shortfall')::int <> 0 THEN
        RAISE EXCEPTION 'D2c FAIL: shortfall=% (المفروض 0)', v_rev->>'shortfall';
    END IF;
    RAISE NOTICE 'D2 PASS: العدد المطلوب 5 مُحترم (2 خطأ + 3 جديدة) + shortfall=0';

    -- ============ D3: ★ كل الأسئلة الخاطئة موجودة ============
    SELECT array_agg(qid::text ORDER BY qid) INTO v_ids
    FROM (SELECT jsonb_array_elements(v_rev->'questions')->>'id' AS qid) t;
    IF NOT ('f0000000-0000-0000-0000-000000000003' = ANY(v_ids)) THEN
        RAISE EXCEPTION 'D3 FAIL: السؤال 3 الخاطئ غير موجود في الامتحان';
    END IF;
    IF NOT ('f0000000-0000-0000-0000-000000000005' = ANY(v_ids)) THEN
        RAISE EXCEPTION 'D3 FAIL: السؤال 5 الخاطئ غير موجود في الامتحان';
    END IF;
    RAISE NOTICE 'D3 PASS: ★ كل الأسئلة التي أخطأ فيها الطالب مُدرجة';

    -- ============ D4: ★ لا أسئلة مكررة ولا خارج المادة ============
    SELECT count(*) INTO v_n FROM (
        SELECT jsonb_array_elements(v_rev->'questions')->>'id' AS qid) t
     WHERE t.qid IN ('f0000000-0000-0000-0000-000000000007',
                     'f0000000-0000-0000-0000-000000000008',
                     'f0000000-0000-0000-0000-000000000009',
                     'f0000000-0000-0000-0000-00000000000a');
    IF v_n > 0 THEN RAISE EXCEPTION 'D4 FAIL: % أسئلة من مادة أخرى', v_n; END IF;

    -- لا تكرار داخل نفس المحاولة
    SELECT count(DISTINCT aa.question_id) INTO v_n
    FROM public.attempt_answers aa WHERE aa.attempt_id = v_a;
    SELECT count(*) INTO v_n FROM public.attempt_answers aa WHERE aa.attempt_id = v_a;
    IF v_n <> 5 THEN RAISE EXCEPTION 'D4b FAIL: % صفوف إجابات (المتوقع 5)', v_n; END IF;

    -- ★ الأسئلة الثلاثة الجديدة تأتي من امتحان الوحدة الثانية (لم تُحاول بعد)
    SELECT count(*) INTO v_n
    FROM public.attempt_answers aa
    WHERE aa.attempt_id = v_a
      AND aa.question_id IN ('f0000000-0000-0000-0000-00000000000b',
                             'f0000000-0000-0000-0000-00000000000c',
                             'f0000000-0000-0000-0000-00000000000d');
    IF v_n <> 3 THEN RAISE EXCEPTION 'D4c FAIL: % أسئلة جديدة (المتوقع 3)', v_n; END IF;
    RAISE NOTICE 'D4 PASS: لا تكرار ولا أسئلة من مادة أخرى + 3 أسئلة لم تُحاول';

    -- ============ D5: during_review معلّم + التوكن موجود ============
    SELECT count(*) INTO v_n FROM public.attempt_answers
     WHERE attempt_id = v_a AND during_review = true;
    IF v_n <> 5 THEN RAISE EXCEPTION 'D5 FAIL: % صفوف during_review', v_n; END IF;
    IF (v_rev->>'answer_token') IS NULL THEN RAISE EXCEPTION 'D5 FAIL: لا answer_token'; END IF;
    IF (v_rev->>'time_limit_minutes')::int <> 7 THEN
        RAISE EXCEPTION 'D5b FAIL: time_limit=% (المتوقع 7 = 5*1.5)', v_rev->>'time_limit_minutes';
    END IF;
    RAISE NOTICE 'D5b PASS: time_limit محسوب من عدد الأسئلة (5*1.5=7)';
    RAISE NOTICE 'D5 PASS: during_review معلّم + answer_token موجود';

    -- ============ D6: حمولة مراجعة الأخطاء بلا مفتاح إجابة ============
    v_nt := (v_rev->'questions'->0->>'text');
    IF v_nt IS NULL THEN RAISE EXCEPTION 'D6 FAIL: لا نص سؤال'; END IF;
    IF (v_rev->'questions'->0 ? 'correct_index') THEN
        RAISE EXCEPTION 'D6 FAIL: correct_index مسرَّب في امتحان الأخطاء';
    END IF;
    RAISE NOTICE 'D6 PASS: حمولة امتحان الأخطاء بلا تسريب الإجابات';

    -- ============ D7: لا يسجّل performance قبل التسليم ============
    SELECT count(*) INTO v_n FROM public.question_performance qp
     JOIN public.attempt_answers aa ON aa.question_id = qp.question_id
    WHERE aa.attempt_id = v_a AND qp.is_mastered;
    RAISE NOTICE 'D7: performance بعد وضع المراجعة: % صف متقن', v_n;

    -- ============ D8: التحقق من p_count ============
    BEGIN
        PERFORM public.create_review_exam('b0000000-0000-0000-0000-000000000001', 2, true, true);
        RAISE EXCEPTION 'D8 FAIL: قَبِل p_count=2 (أقل من الحد الأدنى 5)';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%بين 5 و 30%' THEN RAISE; END IF;
        RAISE NOTICE 'D8a PASS: رفض p_count=2 (تحت الحد الأدنى)';
    END;

    BEGIN
        PERFORM public.create_review_exam('b0000000-0000-0000-0000-000000000001', 100, true, true);
        RAISE EXCEPTION 'D8 FAIL: قَبِل p_count=100';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%بين 5 و 30%' THEN RAISE; END IF;
        RAISE NOTICE 'D8b PASS: رفض p_count=100 (فوق الحد الأقصى)';
    END;

    -- p_count = NULL → الافتراضي 10
    v_rev := public.create_review_exam('b0000000-0000-0000-0000-000000000002', NULL, true, true);
    IF (v_rev->>'requested_questions')::int <> 10 THEN
        RAISE EXCEPTION 'D8c FAIL: الافتراضي=% (المتوقع 10)', v_rev->>'requested_questions';
    END IF;
    RAISE NOTICE 'D8c PASS: p_count=NULL → الافتراضي 10';

    -- ============ D9: مادة بلا أخطاء ============
    BEGIN
        PERFORM public.create_review_exam(
            (SELECT id FROM public.subjects WHERE slug = 'chemistry'), 5, true, false);
        -- الكيمياء عندها خطأ واحد فقط (س7) < الحد الأدنى 5 → رفض
        RAISE EXCEPTION 'D9 FAIL: قبل despite errors < min';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%المتاح%' THEN RAISE; END IF;
        RAISE NOTICE 'D9 PASS: رفض عندما الأسئلة المتاحة أقل من الحد الأدنى';
    END;

    -- ============ D10: material غير موجودة ============
    BEGIN
        PERFORM public.create_review_exam('b0000000-0000-0000-0000-0000000000ff', 5, true, true);
        RAISE EXCEPTION 'D10 FAIL: قبل مادة غير موجودة';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%المادة غير موجودة%' THEN RAISE; END IF;
        RAISE NOTICE 'D10 PASS: رفض مادة غير موجودة';
    END;
END $$;
ROLLBACK;
