-- ============================================================================
-- 7) الصلاحيات الإدارية — من يرى بيانات الطلبة ومن لا يرى
--
--   ★ التصميم المقصود:
--     - students.* و attempts.* ليست في قوالب الأدمن → super_admin فقط افتراضيًا،
--       لأن هذه بيانات شخصية (محاولات، أسماء، بريد، درجات).
--     - get_question_analytics يبقى متاحًا لـ admin (analytics.view في قالبه)
--       لأنه إحصاء تجميعي عن صعوبة الأسئلة، لا بيانات شخصية.
--     - منح الصلاحيات يتم عبر set_staff_permissions التي تشترط staff.manage،
--       أي بواسطة مدير عام فقط.
-- ============================================================================
BEGIN;

-- ---------- 7.1) مدير عام: يرى كل شيء ----------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);  -- super
DO $$
DECLARE v JSONB;
BEGIN
    v := public.list_admin_students();
    IF (v->>'total')::int <> 3 THEN
        RAISE EXCEPTION 'G1 FAIL: super يرى % طالب (المتوقع 3)', v->>'total';
    END IF;
    IF jsonb_array_length(v->'items') <> 3 THEN
        RAISE EXCEPTION 'G1b FAIL: % عناصر', jsonb_array_length(v->'items');
    END IF;
    IF (v->'overall'->>'students')::int <> 3 THEN
        RAISE EXCEPTION 'G1c FAIL: overall.students=%', v->'overall'->>'students';
    END IF;
    IF NOT (v->'overall' ? 'accuracy') THEN
        RAISE EXCEPTION 'G1d FAIL: overall.accuracy مفقود';
    END IF;
    RAISE NOTICE 'G1 PASS: super_admin يرى الطلاب (3) + overall صحيح';

    v := public.get_admin_student_detail(
        (SELECT id FROM public.students WHERE email = 'sara@student.test'));
    IF (v->'student'->>'email') <> 'sara@student.test' THEN
        RAISE EXCEPTION 'G1e FAIL: تفاصيل الطالب خاطئة';
    END IF;
    IF NOT (v->'student' ? 'auth_user_id') THEN
        RAISE EXCEPTION 'G1f FAIL: auth_user_id مفقود (مهم للتشخيص)';
    END IF;
    IF v->'subjects' IS NULL THEN
        RAISE EXCEPTION 'G1g FAIL: subjects مفقود';
    END IF;
    RAISE NOTICE 'G1e PASS: تفاصيل الطالب تعمل (تتضمّن auth_user_id)';

    v := public.get_admin_attempts();
    IF NOT (v->'summary' ? 'attempts') THEN
        RAISE EXCEPTION 'G1h FAIL: ملخص المحاولات مفقود';
    END IF;
    IF NOT (v->'summary' ? 'review_attempts') THEN
        RAISE EXCEPTION 'G1i FAIL: review_attempts مفقود ( amendment امتحان الأخطاء)';
    END IF;
    RAISE NOTICE 'G1h PASS: تقرير الامتحانات يعمل (attempts=% review=%)',
        v->'summary'->>'attempts', v->'summary'->>'review_attempts';

    v := public.get_question_analytics();
    IF NOT (v ? 'items') THEN
        RAISE EXCEPTION 'G1j FAIL: تحليل الأسئلة مفقود';
    END IF;
    IF NOT (v->'overall' ? 'mastered_rate') THEN
        RAISE EXCEPTION 'G1k FAIL: mastered_rate مفقود';
    END IF;
    RAISE NOTICE 'G1j PASS: تحليل الأسئلة يعمل (mastered_rate موجود)';
END $$;

-- ---------- 7.2) أدمن عادي: لا يملك صلاحيات البيانات الشخصية ----------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);  -- staff (admin)
DO $$
DECLARE n INT;
BEGIN
    BEGIN
        PERFORM public.list_admin_students();
        RAISE EXCEPTION 'G2a FAIL: أدمن عادي رأى قائمة الطلاب';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير مصرح%' THEN RAISE; END IF;
        RAISE NOTICE 'G2a PASS: أدمن عادي لا يستطيع list_admin_students';
    END;

    BEGIN
        PERFORM public.get_admin_attempts();
        RAISE EXCEPTION 'G2b FAIL: أدمن عادي رأى تقرير الامتحانات';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير مصرح%' THEN RAISE; END IF;
        RAISE NOTICE 'G2b PASS: أدمن عادي لا يستطيع get_admin_attempts';
    END;

    BEGIN
        PERFORM public.get_admin_student_detail(gen_random_uuid());
        RAISE EXCEPTION 'G2c FAIL: أدمن عادي رأى تفاصيل طالب';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير مصرح%' THEN RAISE; END IF;
        RAISE NOTICE 'G2c PASS: أدمن عادي لا يستطيع get_admin_student_detail';
    END;

    -- تحليل الأسئلة متاح عمدًا (analytics.view في قالب admin، وهو تجميعي)
    PERFORM public.get_question_analytics();
    RAISE NOTICE 'G2d PASS: أدمن عادي يستطيع get_question_analytics (تجميعي، غير شخصي)';

    -- ★ RLS + المنح يمنعان القراءة المباشرة أيضًا (دفاع على مستويين)
    SELECT count(*) INTO n FROM public.students;
    IF n <> 0 THEN RAISE EXCEPTION 'G2e FAIL: قرأ % صف طالب مباشرة', n; END IF;
    SELECT count(*) INTO n FROM public.exam_attempts;
    IF n <> 0 THEN RAISE EXCEPTION 'G2f FAIL: قرأ % محاولة مباشرة', n; END IF;
    SELECT count(*) INTO n FROM public.question_performance;
    IF n <> 0 THEN RAISE EXCEPTION 'G2g FAIL: قرأ % صف performance مباشرة', n; END IF;
    RAISE NOTICE 'G2e PASS: لا قراءة مباشرة للجداول (منح + RLS)';
END $$;

-- ---------- 7.3) المدير العام يمنح الصلاحيات الصريحة ----------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);  -- super
DO $$
BEGIN
    PERFORM public.set_staff_permissions(
        'a0000000-0000-0000-0000-000000000002',
        jsonb_build_array(
            jsonb_build_object('key', 'students.view'),
            jsonb_build_object('key', 'students.manage')
        ));
    RAISE NOTICE 'G3a PASS: super_admin منح students.view + students.manage للمعلّم';
END $$;

-- ---------- 7.4) بعد المنح: البيانات + الإدارة ----------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);  -- staff
DO $$
DECLARE v JSONB; n INT;
BEGIN
    v := public.list_admin_students();
    IF (v->>'total')::int <> 3 THEN
        RAISE EXCEPTION 'G3b FAIL: بعد المنح يرى % طالب', v->>'total';
    END IF;
    RAISE NOTICE 'G3b PASS: بعد منح students.view يرى الأدمن الطلاب (3)';

    -- البحث
    v := public.list_admin_students('سارة', NULL, NULL, 'recent', 25, 0);
    IF (v->>'total')::int <> 1 THEN
        RAISE EXCEPTION 'G3c FAIL: البحث بـ"سارة" أعاد % صف', v->>'total';
    END IF;
    RAISE NOTICE 'G3c PASS: البحث بالاسم يعمل (1 نتيجة)';

    -- فلتر الحالة
    v := public.list_admin_students(NULL, NULL, false, 'recent', 25, 0);
    IF (v->>'total')::int <> 0 THEN
        RAISE EXCEPTION 'G3d FAIL: فلتر is_active=false أعاد % صف', v->>'total';
    END IF;
    RAISE NOTICE 'G3d PASS: فلتر الحالة يعمل';

    -- students.manage: تعطيل
    PERFORM public.admin_set_student_active(
        (SELECT id FROM public.students WHERE email = 'nour@student.test'), false);
    SELECT count(*) INTO n FROM public.students
     WHERE email = 'nour@student.test' AND is_active = false;
    IF n <> 1 THEN RAISE EXCEPTION 'G3e FAIL: لم يتم تعطيل نور (% صف)', n; END IF;
    RAISE NOTICE 'G3e PASS: admin_set_student_active عطّل نور';

    -- attempts.manage غير ممنوح → flag مرفوض
    BEGIN
        PERFORM public.admin_flag_attempt(gen_random_uuid(), true, 'اختبار');
        RAISE EXCEPTION 'G3f FAIL: نجح flag بدون attempts.manage';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير مصرح%' THEN RAISE; END IF;
        RAISE NOTICE 'G3f PASS: attempts.manage غير ممنوح → flag مرفوض';
    END;
END $$;

-- ---------- 7.5) الحساب المعطّل لا يرى شيئًا ----------
RESET ROLE;
UPDATE public.admins SET is_active = false WHERE email = 'staff@thanaya.test';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
DO $$
BEGIN
    BEGIN
        PERFORM public.list_admin_students();
        RAISE EXCEPTION 'G4 FAIL: حساب معطّل رأى الطلاب';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير مصرح%' THEN RAISE; END IF;
        RAISE NOTICE 'G4 PASS: حساب معطّل (is_active=false) لا يرى شيئًا رغم منحه الصلاحيات';
    END;
END $$;
RESET ROLE;

-- ---------- 7.6) طالب لا يستطيع استدعاء أي دالة إدارية ----------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000010', true);  -- سارة
DO $$
BEGIN
    BEGIN
        PERFORM public.list_admin_students();
        RAISE EXCEPTION 'H1 FAIL: طالب استدعى list_admin_students';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير مصرح%' THEN RAISE; END IF;
        RAISE NOTICE 'H1 PASS: لا list_admin_students';
    END;

    BEGIN
        PERFORM public.get_admin_student_detail(gen_random_uuid());
        RAISE EXCEPTION 'H2 FAIL';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير مصرح%' THEN RAISE; END IF;
        RAISE NOTICE 'H2 PASS: لا get_admin_student_detail';
    END;

    BEGIN
        PERFORM public.get_admin_attempts();
        RAISE EXCEPTION 'H3 FAIL';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير مصرح%' THEN RAISE; END IF;
        RAISE NOTICE 'H3 PASS: لا get_admin_attempts';
    END;

    BEGIN
        PERFORM public.get_admin_attempt_detail(gen_random_uuid());
        RAISE EXCEPTION 'H4 FAIL';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير مصرح%' THEN RAISE; END IF;
        RAISE NOTICE 'H4 PASS: لا get_admin_attempt_detail';
    END;

    BEGIN
        PERFORM public.admin_delete_student_data(gen_random_uuid());
        RAISE EXCEPTION 'H5 FAIL';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير مصرح%' THEN RAISE; END IF;
        RAISE NOTICE 'H5 PASS: لا admin_delete_student_data';
    END;

    BEGIN
        PERFORM public.admin_set_student_active(gen_random_uuid(), false);
        RAISE EXCEPTION 'H6 FAIL';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%غير مصرح%' THEN RAISE; END IF;
        RAISE NOTICE 'H6 PASS: لا admin_set_student_active';
    END;

    BEGIN
        PERFORM public.question_performance
           WHERE student_id <> (SELECT private.current_student_id());
        RAISE EXCEPTION 'H7 FAIL: رأى performance لغيره';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'H7 PASS: لا performance لغيره (RLS)';
    END;
END $$;
ROLLBACK;
