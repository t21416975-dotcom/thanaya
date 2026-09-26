-- ============================================================================
-- 6) الصلاحية المؤقتة (expires_at)
-- ============================================================================
INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type, scope_id, expires_at)
VALUES ('a0000000-0000-0000-0000-000000000004','resources.update','subject',
        'b0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day');

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000004', true);
DO $$
BEGIN
    IF private.can_manage_resource('resources.update','d0000000-0000-0000-0000-000000000001') THEN
        RAISE EXCEPTION 'X1 FAIL: expired grant still active';
    END IF;
    RAISE NOTICE 'X1 PASS: المنحة المنتهية لا تُحتسب';
END $$;
ROLLBACK;
DELETE FROM public.admin_permissions
WHERE admin_id = 'a0000000-0000-0000-0000-000000000004' AND permission_key = 'resources.update';

-- ============================================================================
-- 7) مستخدم مسجّل لكنه ليس من الطاقم
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000005','student@thanaya.test');

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000005', true);
DO $$
DECLARE n INT;
BEGIN
    IF private.is_staff() THEN RAISE EXCEPTION 'Y1 FAIL: student counted as staff'; END IF;

    UPDATE public.resources SET title = 'hack'
    WHERE id = 'd0000000-0000-0000-0000-000000000002';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'Y2 FAIL: student updated a resource'; END IF;
    RAISE NOTICE 'Y1/Y2 PASS: مستخدم عادي بلا أي صلاحية إدارية';

    SELECT count(*) INTO n FROM public.resources;
    IF n <> 1 THEN RAISE EXCEPTION 'Y3 FAIL: student sees % rows', n; END IF;
    RAISE NOTICE 'Y3 PASS: يرى المنشور فقط';
END $$;
ROLLBACK;

-- ============================================================================
-- 8) سلامة المنح: منع النطاق الوهمي ومنع منح ما لا تملكه
-- ============================================================================
DO $$
DECLARE v_failed BOOLEAN := FALSE;
BEGIN
    -- نطاق غير موجود
    BEGIN
        INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type, scope_id)
        VALUES ('a0000000-0000-0000-0000-000000000002','resources.update','subject',
                'b9999999-0000-0000-0000-000000000999');
        RAISE EXCEPTION 'Z1 FAIL: bogus scope accepted';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'Z1 PASS: رفض نطاق غير موجود';
    END;
END $$;

-- مفوَّض بصلاحية staff.manage فقط (لا يملك النشر) يحاول منح resources.publish
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000006','delegate@thanaya.test');
INSERT INTO public.admins (id, email, role)
VALUES ('a0000000-0000-0000-0000-000000000006','delegate@thanaya.test','editor');
INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type)
VALUES ('a0000000-0000-0000-0000-000000000006','staff.manage','global');

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000006', true);
DO $$
BEGIN
    IF private.has_permission('staff.manage') IS NOT TRUE THEN
        RAISE EXCEPTION 'Z0 FAIL: delegate cannot manage staff';
    END IF;
    IF private.has_permission('resources.publish') IS TRUE THEN
        RAISE EXCEPTION 'Z0 FAIL: delegate unexpectedly holds publish';
    END IF;
    RAISE NOTICE 'Z0 PASS: المفوَّض يدير الفريق ولا يملك النشر';

    BEGIN
        INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type)
        VALUES ('a0000000-0000-0000-0000-000000000004','resources.publish','global');
        RAISE EXCEPTION 'Z2 FAIL: granted a permission the granter lacks';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'Z2 PASS: لا يمنح ما لا يملكه';
    END;

    BEGIN
        INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type)
        VALUES ('a0000000-0000-0000-0000-000000000006','resources.view','global');
        RAISE EXCEPTION 'Z3 FAIL: self-grant allowed';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'Z3 PASS: منع المنح الذاتي';
    END;

    INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type)
    VALUES ('a0000000-0000-0000-0000-000000000004','resources.update','global');
    RAISE NOTICE 'Z4 PASS: المفوَّض يمنح صلاحية يملكها';
END $$;
ROLLBACK;

-- ============================================================================
-- 9) تنظيف المنح اليتيمة عند حذف النطاق
-- ============================================================================
INSERT INTO public.exams (id, title, subject_id, time_limit_minutes) VALUES
  ('e0000000-0000-0000-0000-000000000002','امتحان مؤقت','b0000000-0000-0000-0000-000000000002',20);

INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type, scope_id)
VALUES ('a0000000-0000-0000-0000-000000000002','exams.update','exam',
        'e0000000-0000-0000-0000-000000000002');

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admin_permissions
                   WHERE scope_id = 'e0000000-0000-0000-0000-000000000002') THEN
        RAISE EXCEPTION 'C1 FAIL: grant not created';
    END IF;
    DELETE FROM public.exams WHERE id = 'e0000000-0000-0000-0000-000000000002';
    IF EXISTS (SELECT 1 FROM public.admin_permissions
               WHERE scope_id = 'e0000000-0000-0000-0000-000000000002') THEN
        RAISE EXCEPTION 'C1 FAIL: orphan grant left behind';
    END IF;
    RAISE NOTICE 'C1 PASS: تنظيف المنح عند حذف النطاق';
END $$;

-- ============================================================================
-- 10) الزائر (anon) لا يقرأ اشتراكات الـPush ولا البلاغات
--     (يعتمد على migration: 20260926000000_revoke_anon_select.sql)
--     بينما يظل قادرًا على الإرسال والإلغاء.
-- ============================================================================
INSERT INTO public.push_subscriptions (endpoint, p256dh, auth)
VALUES ('https://fcm.googleapis.com/fcm/send/test-endpoint','pubkey','authtoken');

BEGIN;
SET LOCAL ROLE anon;

DO $$
DECLARE
    v_blocked BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM 1 FROM public.push_subscriptions;
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'A1 FAIL: anon can read push_subscriptions';
    END IF;
    RAISE NOTICE 'A1 PASS: anon لا يقرأ اشتراكات الـPush';

    BEGIN
        PERFORM 1 FROM public.reports;
    EXCEPTION WHEN insufficient_privilege THEN
        v_blocked := TRUE;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'A2 FAIL: anon can read reports';
    END IF;
    RAISE NOTICE 'A2 PASS: anon لا يقرأ البلاغات';
END $$;

-- الإدراج (إرسال بلاغ) ما زال مسموحًا للزائر
INSERT INTO public.reports (resource_id, issue_type, details)
VALUES ('d0000000-0000-0000-0000-000000000001', 'broken_link', 'بلاغ من زائر');

-- إلغاء اشتراك Push (DELETE) ما زال مسموحًا للزائر
DELETE FROM public.push_subscriptions
WHERE endpoint = 'https://fcm.googleapis.com/fcm/send/test-endpoint';

DO $$
BEGIN
    RAISE NOTICE 'A3/A4 PASS: الزائر يستطيع الإرسال والإلغاء دون قراءة';
END $$;
ROLLBACK;

-- الأدمن ما زال يقرأ (للتأكد أن السحب لم يمسّه)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE n INT;
BEGIN
    SELECT count(*) INTO n FROM public.push_subscriptions;
    RAISE NOTICE 'A5 PASS: الأدمن (% rows) يقرأ الاشتراكات', n;
END $$;
ROLLBACK;

-- ============================================================================
-- 11) الحراس (Triggers) موجودة فعلاً بعد الترحيل
-- ============================================================================
SELECT tgname AS trigger_name, relname AS table_name
FROM pg_trigger tg
JOIN pg_class rel ON rel.oid = tg.tgrelid
WHERE NOT tg.tgisinternal
  AND tgname IN ('enforce_resource_column_rules','enforce_exam_column_rules',
                 'validate_permission_scope','protect_super_admins','cleanup_scope_grants',
                 'set_resource_creator','set_exam_creator')
ORDER BY 2, 1;

SELECT 'ALL SCENARIOS PASSED' AS result;
