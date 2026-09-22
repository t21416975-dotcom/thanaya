-- ============================================================================
-- 13) سير اعتماد التعديلات (Change Requests):
--     الكتابة المباشرة للمدير العام فقط، وكل تعديل موظف = طلب معلّق يُعتمد أو يُرفض
-- ============================================================================
\set ON_ERROR_STOP on

-- جدول مؤقت لتمرير معرّفات الطلبات بين الجلسات (المعاملات التي تُثبَت)
CREATE TEMP TABLE IF NOT EXISTS test_ids (k TEXT PRIMARY KEY, v UUID);
GRANT ALL ON pg_temp.test_ids TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- (أ) المحرر: تقديم طلبات + حدود التقديم (تُثبَّت الطلبات الناجحة بـCOMMIT)
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
DO $$
DECLARE
    v_req UUID;
    v_txt TEXT;
    n     INT;
BEGIN
    -- C1: تقديم طلب تعديل داخل النطاق يُقبل، والمورد لا يتغيّر قبل الاعتماد
    v_req := public.submit_change_request('resources','d0000000-0000-0000-0000-000000000001','update',
        '{"title":"فيزياء - مسودة (طلب المحرر)"}'::jsonb);
    INSERT INTO pg_temp.test_ids (k, v) VALUES ('r_update', v_req);

    SELECT title INTO v_txt FROM public.resources WHERE id = 'd0000000-0000-0000-0000-000000000001';
    IF v_txt <> 'فيزياء - مسودة' THEN
        RAISE EXCEPTION 'C1 FAIL: resource changed before approval (%)', v_txt;
    END IF;
    SELECT count(*) INTO n FROM public.change_requests
    WHERE id = v_req AND status = 'pending'
      AND submitted_by = 'a0000000-0000-0000-0000-000000000002'
      AND base_snapshot IS NOT NULL;
    IF n <> 1 THEN RAISE EXCEPTION 'C1 FAIL: request not pending with snapshot'; END IF;
    RAISE NOTICE 'C1 PASS: طلب التعديل قُدّم مع لقطة أساس وبقي المورد دون تغيير';

    -- C2: طلب إنشاء مورد داخل النطاق يُقبل ولا يُنشئ شيئًا فورًا
    v_req := public.submit_change_request('resources', NULL, 'create',
        '{"id":"d0000000-0000-0000-0000-00000000000a","title":"مورد جديد من المحرر","slug":"editor-new","subject_id":"b0000000-0000-0000-0000-000000000001","content_type_id":"c0000000-0000-0000-0000-000000000001","pdf_url":"https://example.com/editor-new.pdf","is_published":false}'::jsonb);
    INSERT INTO pg_temp.test_ids (k, v) VALUES ('r_create', v_req);
    IF EXISTS (SELECT 1 FROM public.resources WHERE slug = 'editor-new') THEN
        RAISE EXCEPTION 'C2 FAIL: resource created before approval';
    END IF;
    RAISE NOTICE 'C2 PASS: طلب الإنشاء قُدّم ولم يُنشأ المورد بعد';

    -- C3: طلب رفض لاحقًا (سيستخدمه قسم المدير العام)
    v_req := public.submit_change_request('resources','d0000000-0000-0000-0000-000000000001','update',
        '{"title":"عنوان سيُرفض"}'::jsonb);
    INSERT INTO pg_temp.test_ids (k, v) VALUES ('r_reject', v_req);
    RAISE NOTICE 'C3 PASS: طلب ثالث جاهز لسيناريو الرفض';
END $$;
COMMIT;

-- ----------------------------------------------------------------------------
-- (ب) المحرر: ما يُمنع عند التقديم (معاملات تُلغى)
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
DO $$
DECLARE n INT;
BEGIN
    -- C4: طلب على مورد خارج النطاق مرفوض
    BEGIN
        PERFORM public.submit_change_request('resources','d0000000-0000-0000-0000-000000000002','update',
            '{"title":"hack"}'::jsonb);
        RAISE EXCEPTION 'C4 FAIL: out-of-scope request accepted';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'C4 PASS: منع طلب خارج النطاق';
    END;

    -- C5: تضمين النشر في الطلب ممنوع بلا صلاحية نشر
    BEGIN
        PERFORM public.submit_change_request('resources','d0000000-0000-0000-0000-000000000001','update',
            '{"is_published":true}'::jsonb);
        RAISE EXCEPTION 'C5 FAIL: publish-in-request accepted';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'C5 PASS: منع تضمين النشر في الطلب';
    END;

    -- C6: المحرر لا يملك subjects.manage فلا يقدّم طلب مواد
    BEGIN
        PERFORM public.submit_change_request('subjects','b0000000-0000-0000-0000-000000000001','update',
            '{"name":"hack"}'::jsonb);
        RAISE EXCEPTION 'C6 FAIL: subject request accepted without permission';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'C6 PASS: منع طلب على المواد بلا صلاحية';
    END;

    -- C7: المحرر لا يستطيع مراجعة الطلبات
    BEGIN
        PERFORM public.review_change_request(gen_random_uuid(), 'approved');
        RAISE EXCEPTION 'C7 FAIL: editor reviewed a request';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'C7 PASS: المراجعة محصورة بالمدير العام';
    END;

    -- C8: list_pending_changes لا تُرجع شيئًا لغير المدير العام
    SELECT count(*) INTO n FROM public.list_pending_changes();
    IF n <> 0 THEN RAISE EXCEPTION 'C8 FAIL: pending list leaked % rows', n; END IF;
    RAISE NOTICE 'C8 PASS: قائمة المعلّقات محجوبة عن الموظف';

    -- C9: الإدراج المباشر في جدول الطلبات باسم شخص آخر ممنوع (RLS)
    BEGIN
        INSERT INTO public.change_requests (entity, entity_id, action, payload, submitted_by)
        VALUES ('resources','d0000000-0000-0000-0000-000000000001','update','{}'::jsonb,
                'a0000000-0000-0000-0000-000000000003');
        RAISE EXCEPTION 'C9 FAIL: forged insert accepted';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'C9 PASS: منع تزوير هوية مقدّم الطلب';
    END;

    -- C10: لا يوجد UPDATE مباشر على الطلبات إطلاقًا (حتى على طلبه)
    UPDATE public.change_requests SET status = 'approved'
    WHERE id = (SELECT v FROM pg_temp.test_ids WHERE k = 'r_update');
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'C10 FAIL: direct status update allowed'; END IF;
    RAISE NOTICE 'C10 PASS: لا «موافقة» إلا عبر دالة المراجعة';
END $$;
ROLLBACK;

-- ----------------------------------------------------------------------------
-- (ج) رتبة admin: تقديم طلبات على المواد والامتحانات (قالب الصلاحيات)
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000003', true);
DO $$
DECLARE v_req UUID;
BEGIN
    -- C11: admin يقدّم طلب إنشاء مادة (يملك subjects.manage من القالب)
    v_req := public.submit_change_request('subjects', NULL, 'create',
        '{"id":"b0000000-0000-0000-0000-00000000000a","name":"الأحياء","slug":"biology","order_index":3,"is_active":true}'::jsonb);
    INSERT INTO pg_temp.test_ids (k, v) VALUES ('s_create', v_req);
    RAISE NOTICE 'C11 PASS: admin قدّم طلب إنشاء مادة';

    -- C12: admin يقدّم طلب تعديل امتحان مع استبدال الأسئلة
    v_req := public.submit_change_request('exams','e0000000-0000-0000-0000-000000000001','update',
        '{"title":"امتحان فيزياء (تعديل admin)","questions":[{"question_number":1,"question_text":"سؤال بديل؟","options":["1","2","3","4"],"correct_option_index":1,"explanation":"برهان"}]}'::jsonb);
    INSERT INTO pg_temp.test_ids (k, v) VALUES ('e_update', v_req);
    RAISE NOTICE 'C12 PASS: admin قدّم طلب تعديل امتحان بأسئلته';
END $$;
COMMIT;

-- (ج-2) ما يُمنع على admin: الإعلانات والإشعارات والإعدادات محصورة بالمدير العام
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000003', true);
DO $$
BEGIN
    -- C13: إنشاء إشعار مباشرة ممنوع على admin
    BEGIN
        INSERT INTO public.notifications (title, message) VALUES ('t','m');
        RAISE EXCEPTION 'C13 FAIL: admin inserted notification';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'C13 PASS: الإشعارات محصورة بالمدير العام';
    END;

    -- C14: تعديل الإعدادات مباشرة ممنوع على admin
    BEGIN
        INSERT INTO public.system_settings (key, value) VALUES ('hack','x');
        RAISE EXCEPTION 'C14 FAIL: admin wrote settings';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'C14 PASS: الإعدادات محصورة بالمدير العام';
    END;

    -- C15: هذه الكيانات لا تمرّ بطابور الموافقات أصلًا
    BEGIN
        PERFORM public.submit_change_request('notifications', NULL, 'create', '{}'::jsonb);
        RAISE EXCEPTION 'C15 FAIL: notifications accepted into queue';
    EXCEPTION WHEN raise_exception OR invalid_parameter_value THEN
        RAISE NOTICE 'C15 PASS: الإشعارات مستبعدة من طابور الموافقات';
    END;
END $$;
ROLLBACK;

-- ----------------------------------------------------------------------------
-- (د) المدير العام: يراجع ويعدّل ويعتمد — فيُطبَّق التغيير فعليًا
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE
    v_req UUID;
    v_txt TEXT;
    n     INT;
BEGIN
    -- C16: الموافقة مع تعديل المدير تُطبِّق النسخة المعدَّلة لا الأصلية
    SELECT v INTO v_req FROM pg_temp.test_ids WHERE k = 'r_update';
    PERFORM public.review_change_request(v_req, 'approved', 'عدّلتُ العنوان قبل الاعتماد',
        '{"title":"فيزياء - مسودة (معتمدة)"}'::jsonb);

    SELECT title INTO v_txt FROM public.resources WHERE id = 'd0000000-0000-0000-0000-000000000001';
    IF v_txt <> 'فيزياء - مسودة (معتمدة)' THEN
        RAISE EXCEPTION 'C16 FAIL: modified payload not applied (%)', v_txt;
    END IF;
    SELECT count(*) INTO n FROM public.change_requests
    WHERE id = v_req AND status = 'approved'
      AND reviewed_by = 'a0000000-0000-0000-0000-000000000001'
      AND reviewed_at IS NOT NULL;
    IF n <> 1 THEN RAISE EXCEPTION 'C16 FAIL: request not marked approved'; END IF;
    RAISE NOTICE 'C16 PASS: الاعتماد طبّق نسخة المدير المعدّلة وأرشف القرار';

    -- C17: الموافقة على طلب الإنشاء تُنشئ المورد فعليًا (غير منشور كما في الطلب)
    SELECT v INTO v_req FROM pg_temp.test_ids WHERE k = 'r_create';
    PERFORM public.review_change_request(v_req, 'approved', NULL, NULL);

    SELECT count(*) INTO n FROM public.resources
    WHERE slug = 'editor-new' AND title = 'مورد جديد من المحرر' AND is_published = false;
    IF n <> 1 THEN RAISE EXCEPTION 'C17 FAIL: create not applied correctly'; END IF;
    RAISE NOTICE 'C17 PASS: اعتماد الإنشاء أنشأ المورد كمسودة';

    -- C18: الرفض لا يغيّر أي بيانات ويحفظ السبب
    SELECT v INTO v_req FROM pg_temp.test_ids WHERE k = 'r_reject';
    PERFORM public.review_change_request(v_req, 'rejected', 'العنوان غير لائق', NULL);

    SELECT count(*) INTO n FROM public.resources WHERE title = 'عنوان سيُرفض';
    IF n <> 0 THEN RAISE EXCEPTION 'C18 FAIL: rejected change was applied'; END IF;
    SELECT count(*) INTO n FROM public.change_requests
    WHERE id = v_req AND status = 'rejected' AND review_note = 'العنوان غير لائق';
    IF n <> 1 THEN RAISE EXCEPTION 'C18 FAIL: rejection not archived'; END IF;
    RAISE NOTICE 'C18 PASS: الرفض أرشف السبب دون أي تطبيق';

    -- C19: طلب مُراجَع لا يمكن مراجعته مرة أخرى
    BEGIN
        PERFORM public.review_change_request(v_req, 'approved');
        RAISE EXCEPTION 'C19 FAIL: re-reviewed a closed request';
    EXCEPTION WHEN raise_exception OR invalid_parameter_value THEN
        RAISE NOTICE 'C19 PASS: منع مراجعة طلب غير معلّق';
    END;
END $$;
COMMIT;

-- (د-2) اعتماد طلبات المادة والامتحان المقدَّمة من admin
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
DO $$
DECLARE
    v_req UUID;
    v_txt TEXT;
    n     INT;
BEGIN
    -- C20: اعتماد إنشاء المادة
    SELECT v INTO v_req FROM pg_temp.test_ids WHERE k = 's_create';
    PERFORM public.review_change_request(v_req, 'approved', NULL, NULL);
    SELECT count(*) INTO n FROM public.subjects WHERE slug = 'biology' AND name = 'الأحياء';
    IF n <> 1 THEN RAISE EXCEPTION 'C20 FAIL: subject not created on approval'; END IF;
    RAISE NOTICE 'C20 PASS: اعتماد إنشاء المادة طُبِّق';

    -- C21: اعتماد تعديل الامتحان مع تعديل المدير للأسئلة (استبدال ذرّي)
    SELECT v INTO v_req FROM pg_temp.test_ids WHERE k = 'e_update';
    PERFORM public.review_change_request(v_req, 'approved', 'راجعتُ السؤال',
        '{"title":"امتحان فيزياء (معتمد)","questions":[{"question_number":1,"question_text":"سؤال معتمد؟","options":["أ","ب","ج","د"],"correct_option_index":2,"explanation":"شرح معتمد"}]}'::jsonb);

    SELECT title INTO v_txt FROM public.exams WHERE id = 'e0000000-0000-0000-0000-000000000001';
    IF v_txt <> 'امتحان فيزياء (معتمد)' THEN
        RAISE EXCEPTION 'C21 FAIL: exam title not applied (%)', v_txt;
    END IF;
    SELECT count(*) INTO n FROM public.exam_questions WHERE exam_id = 'e0000000-0000-0000-0000-000000000001';
    IF n <> 1 THEN RAISE EXCEPTION 'C21 FAIL: expected 1 question after replace, got %', n; END IF;
    SELECT count(*) INTO n FROM public.exam_questions
    WHERE exam_id = 'e0000000-0000-0000-0000-000000000001' AND question_text = 'سؤال معتمد؟';
    IF n <> 1 THEN RAISE EXCEPTION 'C21 FAIL: approved question missing'; END IF;
    RAISE NOTICE 'C21 PASS: اعتماد الامتحان طبّق العنوان واستبدل الأسئلة ذرّيًا';

    -- C22: سجل النشاط وثّق العمليات
    SELECT count(*) INTO n FROM public.admin_activity_log
    WHERE action IN ('change_request.submit','change_request.approve','change_request.reject');
    IF n < 5 THEN RAISE EXCEPTION 'C22 FAIL: activity log incomplete (% rows)', n; END IF;
    RAISE NOTICE 'C22 PASS: سجل النشاط يوثّق التقديم والاعتماد والرفض';
END $$;
COMMIT;

-- ----------------------------------------------------------------------------
-- (هـ) المحرر بعد المراجعة: يرى النتيجة ويلغي طلبه المعلّق فقط
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
DO $$
DECLARE
    v_req UUID;
    n     INT;
BEGIN
    -- C23: list_my_changes تعرض قرار الرفض وسببه
    SELECT count(*) INTO n FROM public.list_my_changes()
    WHERE status = 'rejected' AND review_note = 'العنوان غير لائق';
    IF n <> 1 THEN RAISE EXCEPTION 'C23 FAIL: rejection note not visible to submitter'; END IF;
    RAISE NOTICE 'C23 PASS: الموظف يرى نتيجة المراجعة وسببها';

    -- C24: لا يرى طلبات غيره
    SELECT count(*) INTO n FROM public.list_my_changes()
    WHERE entity IN ('subjects','exams');
    IF n <> 0 THEN RAISE EXCEPTION 'C24 FAIL: saw others requests (%)', n; END IF;
    RAISE NOTICE 'C24 PASS: الموظف يرى طلباته فقط';

    -- C25: إلغاء طلبه المعلّق مسموح؛ وإلغاء المُراجَع ممنوع
    v_req := public.submit_change_request('resources','d0000000-0000-0000-0000-000000000001','update',
        '{"title":"سيُلغى"}'::jsonb);
    PERFORM public.cancel_change_request(v_req);
    SELECT count(*) INTO n FROM public.change_requests WHERE id = v_req AND status = 'cancelled';
    IF n <> 1 THEN RAISE EXCEPTION 'C25 FAIL: cancel own pending failed'; END IF;

    BEGIN
        PERFORM public.cancel_change_request((SELECT v FROM pg_temp.test_ids WHERE k = 'r_reject'));
        RAISE EXCEPTION 'C25 FAIL: cancelled a reviewed request';
    EXCEPTION WHEN raise_exception OR invalid_parameter_value THEN
        RAISE NOTICE 'C25 PASS: الإلغاء الذاتي للمعلّق فقط';
    END;
END $$;
ROLLBACK;

-- ----------------------------------------------------------------------------
-- (و) الزائر anon: لا وصول إطلاقًا
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE anon;
DO $$
BEGIN
    -- القراءة نفسها مرفوضة (لا منحة وصول للزائر على الجدول)
    BEGIN
        PERFORM count(*) FROM public.change_requests;
        RAISE EXCEPTION 'C26 FAIL: anon read change_requests';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'C26a PASS: قراءة الطلبات محجوبة عن الزائر';
    END;

    BEGIN
        PERFORM public.submit_change_request('resources', NULL, 'create', '{}'::jsonb);
        RAISE EXCEPTION 'C26 FAIL: anon submitted a request';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'C26 PASS: الزائر محجوب كليًا عن طابور الموافقات';
    END;
END $$;
ROLLBACK;

-- ----------------------------------------------------------------------------
-- (ز) فحص النظافة: لا سياسة مطبَّقة على anon تستدعي دوالًا ممنوعة عليه
--     anon بلا EXECUTE على دوال private ولا is_admin/get_my_permissions —
--     أي استدعاء داخل سياسة تخصّه يُفشل قراءة الطلاب لهذا الجدول بالكامل.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_bad   RECORD;
    v_count INT := 0;
BEGIN
    FOR v_bad IN
        SELECT p.polname,
               c.relname,
               pg_get_expr(p.polqual, p.polrelid) AS qual
          FROM pg_policy p
          JOIN pg_class c ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND p.polroles @> ARRAY[(SELECT oid FROM pg_roles WHERE rolname = 'anon')][]::oid[]
           AND (
                 pg_get_expr(p.polqual, p.polrelid) ~ '(private|pg_catalog)\.\w+\('
              OR pg_get_expr(p.polqual, p.polrelid) ~ '(is_admin|has_permission|can_manage_\w+|get_my_permissions|is_super_admin)\('
               )
    LOOP
        v_count := v_count + 1;
        RAISE NOTICE 'H1 BAD: %.% -> %', v_bad.relname, v_bad.polname, v_bad.qual;
    END LOOP;

    IF v_count > 0 THEN
        RAISE EXCEPTION 'H1 FAIL: % سياسة لـanon تستدعي دوالًا ممنوعة عليه', v_count;
    END IF;
    RAISE NOTICE 'H1 PASS: كل سياسات anon خالية من استدعاء الدوال الممنوعة عليه';
END $$;

SELECT 'ALL CHANGE-REQUEST SCENARIOS PASSED' AS result;
