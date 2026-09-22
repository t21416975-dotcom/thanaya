-- ============================================================================
-- 11) المنع الصريح (effect='deny') يلغي القالب الافتراضي
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
DO $$
DECLARE n INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.resources WHERE slug = 'ph-draft') THEN
        RAISE EXCEPTION 'D1 FAIL: editor should see in-scope draft before deny';
    END IF;
    RAISE NOTICE 'D1 PASS: قبل المنع — المسودة داخل النطاق مرئية';
END $$;
ROLLBACK;

INSERT INTO public.admin_permissions (admin_id, permission_key, effect, scope_type)
VALUES ('a0000000-0000-0000-0000-000000000002','resources.view','deny','global');

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
DO $$
DECLARE n INT; v JSONB;
BEGIN
    SELECT count(*) INTO n FROM public.resources WHERE slug = 'ph-draft';
    IF n <> 0 THEN RAISE EXCEPTION 'D2 FAIL: deny did not hide in-scope draft'; END IF;
    RAISE NOTICE 'D2 PASS: المنع أسقط صلاحية العرض داخل النطاق';

    SELECT count(*) INTO n FROM public.resources;
    IF n <> 1 THEN RAISE EXCEPTION 'D3 FAIL: expected only published row, got %', n; END IF;
    RAISE NOTICE 'D3 PASS: يرى المنشور فقط (مثل الطالب)';

    v := public.get_my_permissions();
    IF NOT ((v -> 'denied') ? 'resources.view') THEN
        RAISE EXCEPTION 'D4 FAIL: denied list missing resources.view';
    END IF;
    IF (v -> 'global') ? 'resources.view' THEN
        RAISE EXCEPTION 'D4 FAIL: denied key reported as global';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(v -> 'scoped') e
        WHERE e ->> 'key' = 'resources.view'
    ) THEN
        RAISE EXCEPTION 'D4 FAIL: denied key still listed in effective scopes';
    END IF;
    RAISE NOTICE 'D4 PASS: get_my_permissions يعكس المنع';
END $$;
ROLLBACK;

DELETE FROM public.admin_permissions
WHERE admin_id = 'a0000000-0000-0000-0000-000000000002'
  AND permission_key = 'resources.view' AND effect = 'deny';

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
DO $$
DECLARE n INT;
BEGIN
    SELECT count(*) INTO n FROM public.resources WHERE slug = 'ph-draft';
    IF n <> 1 THEN RAISE EXCEPTION 'D5 FAIL: scope not restored after removing deny'; END IF;
    RAISE NOTICE 'D5 PASS: رفع المنع أعاد الصلاحية';
END $$;
ROLLBACK;

-- ============================================================================
-- 12) منحة على مورد واحد فقط: تخوّل تقديم طلب عليه، لكن الكتابة المباشرة محجوبة
-- ============================================================================
INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type, scope_id)
VALUES ('a0000000-0000-0000-0000-000000000004','resources.update','resource',
        'd0000000-0000-0000-0000-000000000003');

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000004', true);
DO $$
DECLARE n INT;
BEGIN
    -- E1: الكتابة المباشرة محجوبة رغم المنحة — المنحة تخوّل تقديم طلب موافقة فقط (انظر 06)
    UPDATE public.resources SET title = 'كيمياء - مسودة (تعديل مورد واحد)'
    WHERE id = 'd0000000-0000-0000-0000-000000000003';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'E1 FAIL: direct write allowed with grant'; END IF;
    RAISE NOTICE 'E1 PASS: الكتابة المباشرة محجوبة رغم منحة المورد الواحد';

    UPDATE public.resources SET title = 'hack'
    WHERE id = 'd0000000-0000-0000-0000-000000000002';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'E2 FAIL: updated another resource'; END IF;
    RAISE NOTICE 'E2 PASS: بقية الموارد محجوبة';
END $$;
ROLLBACK;

SELECT 'ALL SCENARIOS PASSED' AS result;
