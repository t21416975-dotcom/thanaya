-- ============================================================================
-- 1) المحرر المحدود بمادة الفيزياء فقط
-- ============================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);

DO $$
DECLARE
    n     INT;
    v_txt TEXT;
BEGIN
    -- T1: تعديل مورد داخل النطاق مسموح
    UPDATE public.resources SET title = 'فيزياء - مسودة (معدل)'
    WHERE id = 'd0000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'T1 FAIL: expected 1 row, got %', n; END IF;
    RAISE NOTICE 'T1 PASS: تعديل مورد داخل النطاق';

    -- T2: تعديل مورد خارج النطاق ممنوع (حتى لو كان مرئيًا كمنشور)
    UPDATE public.resources SET title = 'hack'
    WHERE id = 'd0000000-0000-0000-0000-000000000002';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'T2 FAIL: % rows updated outside scope', n; END IF;
    RAISE NOTICE 'T2 PASS: منع تعديل مورد خارج النطاق';

    -- T3: النشر ممنوع
    BEGIN
        UPDATE public.resources SET is_published = true
        WHERE id = 'd0000000-0000-0000-0000-000000000001';
        RAISE EXCEPTION 'T3 FAIL: النشر سُمح به';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'T3 PASS: منع النشر رغم صلاحية التعديل';
    END;

    -- T4: نقل المورد إلى مادة أخرى ممنوع
    BEGIN
        UPDATE public.resources SET subject_id = 'b0000000-0000-0000-0000-000000000002'
        WHERE id = 'd0000000-0000-0000-0000-000000000001';
        RAISE EXCEPTION 'T4 FAIL: النقل سُمح به';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'T4 PASS: منع نقل المورد بين المواد';
    END;

    -- T5: الحذف ممنوع
    DELETE FROM public.resources WHERE id = 'd0000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'T5 FAIL: الحذف سُمح به'; END IF;
    RAISE NOTICE 'T5 PASS: منع الحذف';

    -- T6: الإنشاء داخل النطاق مسموح
    INSERT INTO public.resources (title, slug, subject_id, content_type_id, pdf_url)
    VALUES ('جديد فيزياء','new-ph','b0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001','https://example.com/new.pdf');
    RAISE NOTICE 'T6 PASS: الإنشاء داخل النطاق';

    -- T7: الإنشاء خارج النطاق ممنوع
    BEGIN
        INSERT INTO public.resources (title, slug, subject_id, content_type_id, pdf_url)
        VALUES ('جديد كيمياء','new-ch','b0000000-0000-0000-0000-000000000002',
                'c0000000-0000-0000-0000-000000000001','https://example.com/new2.pdf');
        RAISE EXCEPTION 'T7 FAIL: الإنشاء خارج النطاق سُمح به';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'T7 PASS: منع الإنشاء خارج النطاق';
    END;

    -- T8: إدارة المواد محجوبة
    UPDATE public.subjects SET name = 'hack' WHERE id = 'b0000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'T8 FAIL: subjects writable'; END IF;
    RAISE NOTICE 'T8 PASS: إدارة المواد محجوبة';

    -- T9: إعدادات النظام محجوبة
    SELECT count(*) INTO n FROM public.system_settings;
    IF n <> 0 THEN RAISE EXCEPTION 'T9 FAIL: % settings visible', n; END IF;
    RAISE NOTICE 'T9 PASS: إعدادات النظام والذكاء الاصطناعي محجوبة';

    -- T10: لا يستطيع منح نفسه صلاحيات
    BEGIN
        INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type, scope_id)
        VALUES ('a0000000-0000-0000-0000-000000000002','resources.publish','subject',
                'b0000000-0000-0000-0000-000000000001');
        RAISE EXCEPTION 'T10 FAIL: منح نفسه صلاحية سُمح به';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'T10 PASS: منع تصعيد الصلاحيات الذاتي';
    END;

    -- T11: جدول الأدمن محجوب إلا عن سجله
    SELECT count(*) INTO n FROM public.admins;
    IF n <> 1 THEN RAISE EXCEPTION 'T11 FAIL: admins visible = %', n; END IF;
    RAISE NOTICE 'T11 PASS: لا يرى إلا سجل حسابه';

    -- T12: الرؤية = مسودات الفيزياء + منشور الكيمياء فقط (وبلا مسودة الكيمياء)
    SELECT count(*) INTO n FROM public.resources
    WHERE slug IN ('ph-draft','ch-pub','new-ph');
    IF n <> 3 THEN
        RAISE EXCEPTION 'T12 FAIL: expected 3 accessible rows, got %', n;
    END IF;
    SELECT count(*) INTO n FROM public.resources
    WHERE slug NOT IN ('ph-draft','ch-pub','new-ph');
    IF n <> 0 THEN
        RAISE EXCEPTION 'T12 FAIL: unexpected rows visible (%)', n;
    END IF;
    IF EXISTS (SELECT 1 FROM public.resources WHERE slug = 'ch-draft') THEN
        RAISE EXCEPTION 'T12 FAIL: out-of-scope draft visible';
    END IF;
    RAISE NOTICE 'T12 PASS: الرؤية مطابقة للنطاق';

    -- T13: ملخص الصلاحيات للواجهة
    v_txt := public.get_my_permissions()::text;
    IF v_txt NOT LIKE '%resources.update%' THEN
        RAISE EXCEPTION 'T13 FAIL: resources.update missing from summary';
    END IF;
    IF v_txt LIKE '%resources.publish%' THEN
        RAISE EXCEPTION 'T13 FAIL: resources.publish leaked into summary';
    END IF;
    IF v_txt NOT LIKE '%scoped_subject_ids%' THEN
        RAISE EXCEPTION 'T13 FAIL: scoped_subject_ids missing';
    END IF;
    RAISE NOTICE 'T13 PASS: get_my_permissions صحيح';
END $$;
ROLLBACK;
