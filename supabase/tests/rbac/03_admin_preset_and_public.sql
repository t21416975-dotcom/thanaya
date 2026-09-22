-- ============================================================================
-- 2) رتبة admin (القالب الافتراضي): تنشر لكنها لا تدير الفريق أو الإعدادات
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000003', true);
DO $$
DECLARE n INT;
BEGIN
    -- A1: حتى رتبة admin لا تكتب مباشرة — النشر يمرّ عبر طلب موافقة (انظر 06)
    UPDATE public.resources SET is_published = true WHERE id = 'd0000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'A1 FAIL: admin published directly'; END IF;
    RAISE NOTICE 'A1 PASS: النشر المباشر محجوب عن admin — يتطلب اعتماد المدير العام';

    UPDATE public.admins SET role = 'admin' WHERE id = 'a0000000-0000-0000-0000-000000000002';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'A2 FAIL: admin could edit staff'; END IF;
    RAISE NOTICE 'A2 PASS: إدارة الفريق محجوبة عن admin';

    SELECT count(*) INTO n FROM public.system_settings;
    IF n <> 0 THEN RAISE EXCEPTION 'A3 FAIL: admin sees settings'; END IF;
    RAISE NOTICE 'A3 PASS: إعدادات النظام محجوبة عن admin';

    -- A4: إدارة المواد المباشرة محجوبة عن admin (يقدّم طلب موافقة بدلًا منها)
    BEGIN
        INSERT INTO public.subjects (name, slug, order_index) VALUES ('مادة جديدة','new-subject',9);
        RAISE EXCEPTION 'A4 FAIL: admin inserted subject directly';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'A4 PASS: إنشاء المواد المباشر محجوب عن admin';
    END;
END $$;
ROLLBACK;

-- ============================================================================
-- 3) مشرف بلاغات مقيّد بمادة الفيزياء
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000004', true);
DO $$
DECLARE n INT;
BEGIN
    SELECT count(*) INTO n FROM public.reports;
    IF n <> 0 THEN RAISE EXCEPTION 'R1 FAIL: % out-of-scope reports visible', n; END IF;
    RAISE NOTICE 'R1 PASS: جدول البلاغات مقيّد بالنطاق';

    SELECT count(*) INTO n FROM public.list_staff_reports();
    IF n <> 0 THEN RAISE EXCEPTION 'R2 FAIL: RPC leaked % rows', n; END IF;
    RAISE NOTICE 'R2 PASS: list_staff_reports يحترم النطاق';

    UPDATE public.reports SET status = 'resolved' WHERE id = 'a1000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'R3 FAIL: out-of-scope report updated'; END IF;
    RAISE NOTICE 'R3 PASS: منع معالجة بلاغ خارج النطاق';
END $$;
ROLLBACK;

-- ============================================================================
-- 4) المدير العام (super_admin): تجاوز كامل
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE n INT;
BEGIN
    UPDATE public.exams SET is_published = true WHERE id = 'e0000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'S1 FAIL: super admin cannot publish exam'; END IF;

    UPDATE public.resources SET is_published = false, is_coming_soon = true, coming_soon_message = 'قريبًا'
    WHERE id = 'd0000000-0000-0000-0000-000000000002';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'S2 FAIL: super admin cannot unpublish'; END IF;

    SELECT count(*) INTO n FROM public.system_settings;
    IF n < 1 THEN RAISE EXCEPTION 'S3 FAIL: settings hidden from super admin'; END IF;

    INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type, scope_id)
    VALUES ('a0000000-0000-0000-0000-000000000002','resources.delete','resource',
            'd0000000-0000-0000-0000-000000000003');
    RAISE NOTICE 'S4 PASS: منح صلاحية على مورد محدد (تعديل/حذف مورد واحد)';

    -- منع آخر مدير عام من تعطيل نفسه
    BEGIN
        UPDATE public.admins SET is_active = false WHERE id = 'a0000000-0000-0000-0000-000000000001';
        IF FOUND THEN RAISE EXCEPTION 'S5 FAIL: last super admin deactivated'; END IF;
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'S5 PASS: حماية آخر مدير عام';
    END;
END $$;
ROLLBACK;

-- ============================================================================
-- 5) الزائر (anon): يرى المنشور فقط
-- ============================================================================
BEGIN;
SET LOCAL ROLE anon;
DO $$
DECLARE n INT;
BEGIN
    SELECT count(*) INTO n FROM public.resources;
    IF n <> 1 THEN RAISE EXCEPTION 'P1 FAIL: anon sees % rows (expected 1 published)', n; END IF;
    RAISE NOTICE 'P1 PASS: الطالب يرى المنشور فقط';

    SELECT count(*) INTO n FROM public.subjects;
    IF n <> 2 THEN RAISE EXCEPTION 'P2 FAIL: anon subjects = %', n; END IF;

    SELECT count(*) INTO n FROM public.system_settings;
    IF n <> 0 THEN RAISE EXCEPTION 'P3 FAIL: anon sees settings'; END IF;

    SELECT count(*) INTO n FROM public.exams;
    IF n <> 0 THEN RAISE EXCEPTION 'P4 FAIL: anon sees unpublished exams (%)', n; END IF;
    RAISE NOTICE 'P2..P4 PASS: المواد العامة متاحة والمحجوب محجوب';
END $$;
ROLLBACK;
