-- ============================================================================
-- 9) حدود المعدّل + نزاهة التوكن + حماية الإجابات
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000012', true);  -- نور

-- J1: rate limit على إنشاء امتحان الأخطاء (30/ساعة)
DO $$
DECLARE v JSONB; i INT; n_ok INT := 0; n_blocked INT := 0;
BEGIN
    -- نزرع أخطاء كافية أولًا حتى لا يفشل الطلب لسبب آخر
    DECLARE s1 JSONB; a1 UUID; r RECORD;
    BEGIN
        s1 := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
        a1 := (s1->>'attempt_id')::uuid;
        FOR r IN SELECT aa.question_id
                 FROM public.attempt_answers aa WHERE aa.attempt_id = a1
        LOOP
            PERFORM public.save_answer(a1, r.question_id, 0::smallint, 5);
        END LOOP;
        PERFORM public.submit_exam_attempt(a1, s1->>'answer_token', 30);
    END;

    FOR i IN 1..40 LOOP
        BEGIN
            v := public.create_review_exam('b0000000-0000-0000-0000-000000000001', 5, true, true);
            n_ok := n_ok + 1;
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%الحد المسموح%' THEN
                n_blocked := n_blocked + 1;
            ELSE
                RAISE;
            END IF;
        END;
    END LOOP;

    IF n_blocked = 0 THEN
        RAISE EXCEPTION 'J1 FAIL: لم يُطبَّق حد المعدّل (40 طلبًا كلها نجحت)';
    END IF;
    IF n_ok > 31 THEN
        RAISE EXCEPTION 'J1b FAIL: % طلبًا نجح (الحد 30)', n_ok;
    END IF;
    RAISE NOTICE 'J1 PASS: حد المعدّل يعمل — % نجح، % محجوب (من 40)', n_ok, n_blocked;
END $$;

-- J2: توكن Attempt attempt واحد لا يعمل مع محاولة أخرى
DO $$
DECLARE v1 JSONB; v2 JSONB; a1 UUID; a2 UUID;
BEGIN
    v1 := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
    v2 := public.start_exam_attempt('e0000000-0000-0000-0000-000000000003');
    a1 := (v1->>'attempt_id')::uuid;
    a2 := (v2->>'attempt_id')::uuid;

    IF v1->>'answer_token' = v2->>'answer_token' THEN
        RAISE EXCEPTION 'J2 FAIL: التوكنات متطابقة بين محاولتين مختلفتين';
    END IF;
    RAISE NOTICE 'J2a PASS: التوكن مختلف لكل محاولة';

    -- توكن تجربة أطول لا يُقبل في تجربة أخرى (حتى لو الامتحانات مختلفة)
    BEGIN
        PERFORM public.submit_exam_attempt(a2, v1->>'answer_token', 10);
        RAISE EXCEPTION 'J2b FAIL: قبل توكن محاولة أخرى';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%سلامة%' THEN RAISE; END IF;
        RAISE NOTICE 'J2b PASS: توكن محاولة أخرى مرفوض';
    END;

    -- التزوير بتعديل حرف واحد
    BEGIN
        PERFORM public.submit_exam_attempt(a1, (v1->>'answer_token') || '0', 10);
        RAISE EXCEPTION 'J2c FAIL: قبل توكن مُعدَّل بحرف واحد';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%سلامة%' THEN RAISE; END IF;
        RAISE NOTICE 'J2c PASS: تعديل حرف واحد في التوكن يُرفض';
    END;
END $$;

-- J3: توكن attempt محفوظ في القاعدة ولا يُسرَّب في أي حمولة
DO $$
DECLARE v JSONB; v_txt TEXT; i INT;
BEGIN
    v := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
    -- الحمولة كلها نص — نتأكد أن أي حقل فيه correct_index/answer_hash لا يوجد
    FOR i IN 0..jsonb_array_length(v->'questions') - 1 LOOP
        IF (v->'questions'->i) ? 'correct_index'
           OR (v->'questions'->i) ? 'correct_option_index'
           OR (v->'questions'->i) ? 'explanation'
           OR (v->'questions'->i) ? 'answer_hash' THEN
            RAISE EXCEPTION 'J3 FAIL: حقل حسّاس في حمولة البدء';
        END IF;
    END LOOP;
    RAISE NOTICE 'J3 PASS: ★ حمولة البدء خالية من أي حقل حسّاس (checked % أسئلة)',
        jsonb_array_length(v->'questions');

    -- get_attempt_questions قبل التسليم أيضًا بلا إجابات
    v := public.get_attempt_questions((v->>'attempt_id')::uuid);
    IF (v->>'status') <> 'in_progress' THEN
        RAISE EXCEPTION 'J3b SETUP FAIL: الحالة %', v->'status';
    END IF;
    FOR i IN 0..jsonb_array_length(v->'questions') - 1 LOOP
        IF (v->'questions'->i) ? 'correct_index' THEN
            RAISE EXCEPTION 'J3b FAIL: correct_index في get_attempt_questions قبل التسليم';
        END IF;
    END LOOP;
    RAISE NOTICE 'J3b PASS: get_attempt_questions قبل التسليم بلا مفتاح إجابة';
END $$;

-- J4: بعد التسليم يظهر الشرح (سلوك مقصود)
DO $$
DECLARE v JSONB; a UUID; r RECORD;
BEGIN
    v := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
    a := (v->>'attempt_id')::uuid;
    FOR r IN SELECT aa.question_id, q.correct_option_index
             FROM public.attempt_answers aa
             JOIN public.exam_questions q ON q.id = aa.question_id
             WHERE aa.attempt_id = a
    LOOP
        PERFORM public.save_answer(a, r.question_id, r.correct_option_index::smallint, 5);
    END LOOP;
    PERFORM public.submit_exam_attempt(a, v->>'answer_token', 30);

    v := public.get_attempt_questions(a);
    IF NOT (v->'questions'->0 ? 'correct_index') THEN
        RAISE EXCEPTION 'J4 FAIL: correct_index مفقود بعد التسليم';
    END IF;
    IF NOT (v->'questions'->0 ? 'explanation') THEN
        RAISE EXCEPTION 'J4b FAIL: explanation مفقود بعد التسليم';
    END IF;
    RAISE NOTICE 'J4 PASS: بعد التسليم يظهر مفتاح الإجابة + الشرح (سلوك مقصود)';
END $$;

-- J5: attempt_answers لا تقبل سؤالًا خارج المحاولة
DO $$
DECLARE v JSONB; a UUID;
BEGIN
    v := public.start_exam_attempt('e0000000-0000-0000-0000-000000000001');
    a := (v->>'attempt_id')::uuid;
    BEGIN
        -- سؤال من امتحان آخر تمامًا
        PERFORM public.save_answer(a, 'f0000000-0000-0000-0000-000000000007', 1::smallint, 5);
        RAISE EXCEPTION 'J5 FAIL: قبل حفظ إجابة لسؤال خارج المحاولة';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%لا ينتمي%' THEN RAISE; END IF;
        RAISE NOTICE 'J5 PASS: ★ رفض حفظ إجابة لسؤال لا ينتمي للمحاولة';
    END;
END $$;
ROLLBACK;
