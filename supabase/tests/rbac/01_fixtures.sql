-- ============================================================================
-- سيناريوهات التحقق: تُشغَّل بعد الترحيلات (bootstrap + migrations + RBAC)
-- ============================================================================
\set ON_ERROR_STOP on

-- ============================ التهيئة (كـpostgres) ============================
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000001','super@thanaya.test'),
  ('a0000000-0000-0000-0000-000000000002','editor@thanaya.test'),
  ('a0000000-0000-0000-0000-000000000003','admin@thanaya.test'),
  ('a0000000-0000-0000-0000-000000000004','reports@thanaya.test');

INSERT INTO public.admins (id, email, role) VALUES
  ('a0000000-0000-0000-0000-000000000001','super@thanaya.test','super_admin'),
  ('a0000000-0000-0000-0000-000000000002','editor@thanaya.test','editor'),
  ('a0000000-0000-0000-0000-000000000003','admin@thanaya.test','admin'),
  ('a0000000-0000-0000-0000-000000000004','reports@thanaya.test','editor');

INSERT INTO public.subjects (id, name, slug, order_index) VALUES
  ('b0000000-0000-0000-0000-000000000001','الفيزياء','physics',1),
  ('b0000000-0000-0000-0000-000000000002','الكيمياء','chemistry',2);

INSERT INTO public.content_types (id, name, slug, order_index) VALUES
  ('c0000000-0000-0000-0000-000000000001','التقييمات','weekly-assessments',1);

INSERT INTO public.resources (id, title, slug, subject_id, content_type_id, pdf_url, is_published, is_coming_soon) VALUES
  ('d0000000-0000-0000-0000-000000000001','فيزياء - مسودة','ph-draft',
   'b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',
   'https://example.com/ph.pdf', false, false),
  ('d0000000-0000-0000-0000-000000000002','كيمياء - منشور','ch-pub',
   'b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001',
   'https://example.com/ch.pdf', true, false),
  ('d0000000-0000-0000-0000-000000000003','كيمياء - مسودة','ch-draft',
   'b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001',
   'https://example.com/ch2.pdf', false, false);

INSERT INTO public.exams (id, title, subject_id, time_limit_minutes, is_published) VALUES
  ('e0000000-0000-0000-0000-000000000001','امتحان فيزياء','b0000000-0000-0000-0000-000000000001',30,false);

INSERT INTO public.exam_questions (id, exam_id, question_number, question_text, options, correct_option_index) VALUES
  ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001',
   1,'سؤال تجريبي؟','["أ","ب","ج","د"]'::jsonb,0);

INSERT INTO public.reports (id, resource_id, issue_type, details, status) VALUES
  ('a1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',
   'broken_link','رابط لا يعمل','pending');

-- منح "المحرر": تعديل/إنشاء/عرض داخل مادة الفيزياء فقط (بلا نشر وبلا حذف)
INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type, scope_id) VALUES
  ('a0000000-0000-0000-0000-000000000002','resources.view',   'subject','b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002','resources.create', 'subject','b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002','resources.update', 'subject','b0000000-0000-0000-0000-000000000001');

-- منح "مشرف البلاغات": عرض/معالجة بلاغات الفيزياء فقط
INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type, scope_id) VALUES
  ('a0000000-0000-0000-0000-000000000004','reports.view',  'subject','b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004','reports.manage','subject','b0000000-0000-0000-0000-000000000001');

INSERT INTO public.system_settings (key, value) VALUES ('validation_probe','ok')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

SELECT 'FIXTURES OK' AS step;
