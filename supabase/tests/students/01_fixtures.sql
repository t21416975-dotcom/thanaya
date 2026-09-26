-- ============================================================================
-- تهيئة بيانات اختبار نظام الطالب: 3 طلبة + طاقم + مادتان + امتحان بـ 6 أسئلة
-- تُشغَّل بعد bootstrap + كل الترحيلات.
-- ============================================================================
\set ON_ERROR_STOP on

-- ============================ 1) حسابات auth (كـ postgres) ============================

-- الطاقم
INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
  ('a0000000-0000-0000-0000-000000000001','super@thanaya.test',  '{"full_name":"المدير"}', now()),
  ('a0000000-0000-0000-0000-000000000002','staff@thanaya.test',  '{"full_name":"معلّم"}',   now()),
  ('a0000000-0000-0000-0000-000000000003','editor@thanaya.test', '{"full_name":"محرر"}',    now());

INSERT INTO auth.identities (user_id, provider) VALUES
  ('a0000000-0000-0000-0000-000000000001','google'),
  ('a0000000-0000-0000-0000-000000000002','google'),
  ('a0000000-0000-0000-0000-000000000003','email');

INSERT INTO public.admins (id, email, role) VALUES
  ('a0000000-0000-0000-0000-000000000001','super@thanaya.test','super_admin'),
  ('a0000000-0000-0000-0000-000000000002','staff@thanaya.test','admin'),
  ('a0000000-0000-0000-0000-000000000003','editor@thanaya.test','editor');

-- الطلبة: 1 سجّل من جوجل، 1 من بريد، 1 بلا بريد موثّق
INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
  ('a0000000-0000-0000-0000-000000000010','sara@student.test',
   '{"full_name":"سارة أحمد","picture":"https://cdn.test/sara.png"}', now()),
  ('a0000000-0000-0000-0000-000000000011','omar@student.test',
   '{"full_name":"عمر علي"}', now()),
  ('a0000000-0000-0000-0000-000000000012','nour@student.test',
   '{"full_name":"نور حسن"}', NULL);   -- بريد غير موثّق

INSERT INTO auth.identities (user_id, provider) VALUES
  ('a0000000-0000-0000-0000-000000000010','google'),
  ('a0000000-0000-0000-0000-000000000011','email'),
  ('a0000000-0000-0000-0000-000000000012','google');

-- ============================ 2) المحتوى: مادتان + امتحان ============================

INSERT INTO public.subjects (id, name, slug, order_index) VALUES
  ('b0000000-0000-0000-0000-000000000001','الفيزياء','physics',1),
  ('b0000000-0000-0000-0000-000000000002','الكيمياء','chemistry',2);

INSERT INTO public.content_types (id, name, slug, order_index) VALUES
  ('c0000000-0000-0000-0000-000000000001','امتحانات أسبوعية','weekly-assessments',1),
  ('c0000000-0000-0000-0000-000000000002','امتحانات نهائية','final-exams',2);

INSERT INTO public.weeks (id, title, term, week_number) VALUES
  ('cc000000-0000-0000-0000-000000000001','الأسبوع الأول', 1, 1),
  ('cc000000-0000-0000-0000-000000000002','الأسبوع الثاني',1, 2);

-- مورد منشور (لاختبار انحدار المحتوى العام للزائر)
INSERT INTO public.resources (
    id, title, slug, subject_id, content_type_id, week_id, pdf_url, is_published)
VALUES
  ('d0000000-0000-0000-0000-000000000001',
   'ملخص الفيزياء - الوحدة الأولى','physics-unit-1',
   'b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',
   'cc000000-0000-0000-0000-000000000001',
   'https://example.com/physics-unit-1.pdf', true);

INSERT INTO public.exams (id, title, subject_id, time_limit_minutes, is_published) VALUES
  ('e0000000-0000-0000-0000-000000000001','امتحان الفيزياء الموحّد','b0000000-0000-0000-0000-000000000001', 20, true),
  ('e0000000-0000-0000-0000-000000000002','امتحان فيزياء مسودة','b0000000-0000-0000-0000-000000000001', 20, false);

-- 6 أسئلة في الفيزياء (الصحيحة: 0,1,2,0,1,3) + 2 في الكيمياء
INSERT INTO public.exam_questions (id, exam_id, question_number, question_text, options, correct_option_index, explanation) VALUES
  ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001',1,'شدة التيار تساوي؟','["1A","2A","3A","4A"]'::jsonb,0,'قانون أوم'),
  ('f0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000001',2,'المقاومة تساوي؟','["1Ω","2Ω","3Ω","4Ω"]'::jsonb,1,'V = IR'),
  ('f0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000001',3,'قانون كيرشوف الأول هو؟','["KCL","KVL","أوم","ماكسويل"]'::jsonb,2,'مجموع التيارات = صفر'),
  ('f0000000-0000-0000-0000-000000000004','e0000000-0000-0000-0000-000000000001',4,'الجهد عبر مقاومة؟','["V","I","R","P"]'::jsonb,0,'V = IR'),
  ('f0000000-0000-0000-0000-000000000005','e0000000-0000-0000-0000-000000000001',5,'القدرة الكهربائية؟','["VI","V/I","I/V","V²"]'::jsonb,1,'P = VI'),
  ('f0000000-0000-0000-0000-000000000006','e0000000-0000-0000-0000-000000000001',6,'وحدة شدة التيار؟','["فولت","أوم","أمبير","واط"]'::jsonb,3,'SI: A');

INSERT INTO public.exams (id, title, subject_id, time_limit_minutes, is_published) VALUES
  ('e0000000-0000-0000-0000-000000000003','امتحان الكيمياء','b0000000-0000-0000-0000-000000000002', 15, true);

INSERT INTO public.exam_questions (id, exam_id, question_number, question_text, options, correct_option_index, explanation) VALUES
  ('f0000000-0000-0000-0000-000000000007','e0000000-0000-0000-0000-000000000003',1,'الرقم الدوري لكلميا؟','["2","11","19","20"]'::jsonb,1,'Cl: Z = 17? لا، 11'),
  ('f0000000-0000-0000-0000-000000000008','e0000000-0000-0000-0000-000000000003',2,'عدد النيوترونات في الكلسيوم؟','["20","22","18","40"]'::jsonb,0,'40 - 18 = 22? Actually 22'),
  -- أسئلة كيمياء إضافية لاختبار p_include_unseen
  ('f0000000-0000-0000-0000-000000000009','e0000000-0000-0000-0000-000000000003',3,'المول يساوي؟','["6.02e23","3e8","1.6e-19","9.1e-31"]'::jsonb,0,'عدد أفوغادرو'),
  ('f0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-000000000003',4,'الرمز الكيميائي للصوديوم؟','["Na","S","N","K"]'::jsonb,0,'Na');

-- امتحان ثانٍ في الفيزياء: يوفّر "أسئلة لم تُحاول" لاختبار p_include_unseen
INSERT INTO public.exams (id, title, subject_id, time_limit_minutes, is_published) VALUES
  ('e0000000-0000-0000-0000-000000000004','تدريب الفيزياء - الوحدة الثانية','b0000000-0000-0000-0000-000000000001', 15, true);

INSERT INTO public.exam_questions (id, exam_id, question_number, question_text, options, correct_option_index, explanation) VALUES
  ('f0000000-0000-0000-0000-00000000000b','e0000000-0000-0000-0000-000000000004',1,'المقاومة تتناسب عكسيًا مع؟','["الطول","المقطع","جهد المصدر","الحرارة"]'::jsonb,1,'R = ρL/A'),
  ('f0000000-0000-0000-0000-00000000000c','e0000000-0000-0000-0000-000000000004',2,'المقاومة في التوصيل على التسلسل؟','["أكبر","أصغر","متساوية","لا تتأثر"]'::jsonb,1,'R-series = مجموع'),
  ('f0000000-0000-0000-0000-00000000000d','e0000000-0000-0000-0000-000000000004',3,'الاستنتاج في الفيزياء هو؟','["استنتاج","تخمين","قياس","افتراض"]'::jsonb,0,'الاستنتاج من المنهج');

-- ============================ 3) تحقق من denormalization ============================

DO $$
DECLARE n INT; t TEXT;
BEGIN
    SELECT count(*) INTO n FROM public.exam_questions WHERE subject_id IS NOT NULL;
    IF n <> 13 THEN RAISE EXCEPTION 'F1 FAIL: % أسئلة فقط لها subject_id (المتوقع 13)', n; END IF;
    RAISE NOTICE 'F1 PASS: كل الأسئلة الـ 13 لها subject_id (denormalization تعمل)';

    SELECT count(*) INTO n FROM public.exam_questions WHERE fingerprint IS NULL;
    IF n <> 0 THEN RAISE EXCEPTION 'F2 FAIL: % أسئلة بلا fingerprint', n; END IF;
    RAISE NOTICE 'F2 PASS: كل الأسئلة لها fingerprint';

    -- البصمة تتجاهل التشكيل واختلاف الهمزات
    INSERT INTO public.exam_questions (exam_id, question_number, question_text, options, correct_option_index)
    VALUES ('e0000000-0000-0000-0000-000000000001', 99, 'شــدّة التيــار تســاوي؟',
            '["1A","2A","3A","4A"]'::jsonb, 0);
    SELECT fingerprint INTO t FROM public.exam_questions WHERE question_number = 99;
    IF t <> (SELECT fingerprint FROM public.exam_questions WHERE id = 'f0000000-0000-0000-0000-000000000001') THEN
        RAISE EXCEPTION 'F3 FAIL: البصمة لا تتجاهل التشكيل';
    END IF;
    RAISE NOTICE 'F3 PASS: البصمة تتجاهل التشكيل (كشف التكرار يعمل)';

    DELETE FROM public.exam_questions WHERE question_number = 99;
END $$;

-- ============================ 4) إنشاء صفوف الطلبة عبر bootstrap_student ============================
-- نمرّ على الدالة نفسها التي تستدعيها صفحة callback بعد Google OAuth

DO $$
DECLARE v JSONB;
BEGIN
    PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000010', true);
    SET LOCAL ROLE authenticated;
    v := public.bootstrap_student();
    RESET ROLE;

    IF v->>'email' <> 'sara@student.test' THEN
        RAISE EXCEPTION 'F4 FAIL: بريد غير متوقع: %', v->>'email';
    END IF;
    IF v->>'full_name' <> 'سارة أحمد' THEN
        RAISE EXCEPTION 'F4 FAIL: الاسم لم يُقرأ من metadata: %', v->>'full_name';
    END IF;
    IF v->>'avatar_url' IS NULL THEN
        RAISE EXCEPTION 'F4 FAIL: الصورة لم تُقرأ من metadata';
    END IF;
    IF v->>'provider' <> 'google' THEN
        RAISE EXCEPTION 'F4 FAIL: المزوّد % ليس google', v->>'provider';
    END IF;
    RAISE NOTICE 'F4 PASS: bootstrap_student أنشأ صف سارة من Google metadata';

    PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
    SET LOCAL ROLE authenticated;
    v := public.bootstrap_student();
    RESET ROLE;
    IF v->>'provider' <> 'email' THEN
        RAISE EXCEPTION 'F5 FAIL: مزوّد بريد ≠ email: %', v->>'provider';
    END IF;
    RAISE NOTICE 'F5 PASS: bootstrap_student تعمل لطالب بريد (provider=email)';

    PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000012', true);
    SET LOCAL ROLE authenticated;
    v := public.bootstrap_student();
    RESET ROLE;
    IF (v->>'is_active')::boolean <> true THEN
        RAISE EXCEPTION 'F6 FAIL: بريد غير موثّق لم يُنشأ له حساب';
    END IF;
    RAISE NOTICE 'F6 PASS: بريد غير موثّق ما زال يحصل على حساب (email_verified=false)';
END $$;

DO $$
DECLARE n INT;
BEGIN
    SELECT count(*) INTO n FROM public.students;
    IF n <> 3 THEN RAISE EXCEPTION 'F7 FAIL: % صفوف طلاب فقط (المتوقع 3)', n; END IF;
    RAISE NOTICE 'F7 PASS: 3 صفوف طلبة';

    -- idempotency: bootstrap مرة أخرى لا تُنشئ صفًا جديدًا
    PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000010', true);
    SET LOCAL ROLE authenticated;
    PERFORM public.bootstrap_student();
    PERFORM public.bootstrap_student();
    RESET ROLE;

    SELECT count(*) INTO n FROM public.students;
    IF n <> 3 THEN RAISE EXCEPTION 'F8 FAIL: bootstrap غير idempotent → % صفوف', n; END IF;
    RAISE NOTICE 'F8 PASS: bootstrap_student idempotent (3 صفوف فقط)';
END $$;
