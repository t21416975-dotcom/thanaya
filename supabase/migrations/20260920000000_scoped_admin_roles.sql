-- ============================================================================
-- Migration: Scoped Admin Roles & Custom Permissions (RBAC)
-- Adds: رتبة editor + is_active, كتالوج الصلاحيات، القوالب، المنح المخصّصة،
--       دوال الفحص في schema private، سياسات RLS دقيقة، وTriggers لأعمدة النشر.
-- Idempotent: يمكن تشغيله أكثر من مرة بأمان.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 6.1) جدول الأدمن: رتبة أقل + حالة تفعيل + توسيع قيد الرتبة
-- ---------------------------------------------------------------------------

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- إسقاط أي قيد CHECK سابق على عمود role (بغض النظر عن اسمه) ثم إعادة إنشائه
DO $$
DECLARE c RECORD;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'admins'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%role%'
    LOOP
        EXECUTE format('ALTER TABLE public.admins DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE public.admins
  ADD CONSTRAINT admins_role_check
  CHECK (role IN ('super_admin', 'admin', 'editor'));

CREATE INDEX IF NOT EXISTS idx_admins_role_active ON public.admins(role, is_active);

DROP TRIGGER IF EXISTS set_admins_updated_at ON public.admins;
CREATE TRIGGER set_admins_updated_at
    BEFORE UPDATE ON public.admins
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
-- ---------------------------------------------------------------------------
-- 6.2) كتالوج الصلاحيات + القوالب + المنح المخصّصة
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.permissions (
    key            TEXT PRIMARY KEY,
    label_ar       TEXT NOT NULL,
    category       TEXT NOT NULL CHECK (category IN ('general','content','exams','structure','operations','system')),
    supports_scope BOOLEAN NOT NULL DEFAULT true,
    order_index    INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.permissions (key, label_ar, category, supports_scope, order_index) VALUES
    ('dashboard.access',     'الدخول إلى لوحة التحكم',          'general',    false, 10),
    ('resources.view',       'عرض الموارد والمسودات',           'content',    true,  20),
    ('resources.create',     'إنشاء مورد جديد',                  'content',    true,  21),
    ('resources.update',     'تعديل مورد',                      'content',    true,  22),
    ('resources.publish',    'نشر / إلغاء نشر مورد',             'content',    true,  23),
    ('resources.delete',     'حذف مورد',                        'content',    true,  24),
    ('resources.reassign',   'نقل مورد إلى مادة/تصنيف آخر',      'content',    true,  25),
    ('exams.view',           'عرض الامتحانات غير المنشورة',      'exams',      true,  30),
    ('exams.create',         'إنشاء امتحان',                    'exams',      true,  31),
    ('exams.update',         'تعديل امتحان وأسئلته',             'exams',      true,  32),
    ('exams.publish',        'نشر / إلغاء نشر امتحان',           'exams',      true,  33),
    ('exams.delete',         'حذف امتحان',                      'exams',      true,  34),
    ('subjects.manage',      'إدارة المواد الدراسية',            'structure',  true,  40),
    ('content_types.manage', 'إدارة أنواع المحتوى',              'structure',  false, 41),
    ('weeks.manage',         'إدارة الأسابيع',                  'structure',  false, 42),
    ('reports.view',         'عرض البلاغات',                    'operations', true,  50),
    ('reports.manage',       'معالجة وإغلاق البلاغات',           'operations', true,  51),
    ('ads.manage',           'إدارة الإعلانات',                 'operations', false, 52),
    ('notifications.manage', 'إدارة الإشعارات والبث Push',       'operations', false, 53),
    ('settings.manage',      'إعدادات النظام والذكاء الاصطناعي',  'system',     false, 60),
    ('analytics.view',       'عرض الإحصائيات',                  'system',     false, 61),
    ('staff.manage',         'إدارة الفريق وصلاحياتهم',          'system',     false, 62)
ON CONFLICT (key) DO UPDATE
    SET label_ar       = EXCLUDED.label_ar,
        category       = EXCLUDED.category,
        supports_scope = EXCLUDED.supports_scope,
        order_index    = EXCLUDED.order_index;

-- قوالب الرتب (Presets) — بلا super_admin لأنه يتجاوز كل الفحوصات
CREATE TABLE IF NOT EXISTS public.admin_role_presets (
    role           TEXT NOT NULL CHECK (role IN ('admin','editor')),
    permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role, permission_key)
);

-- admin: كل شيء ما عدا إدارة الفريق وإعدادات النظام
INSERT INTO public.admin_role_presets (role, permission_key)
SELECT 'admin', key FROM public.permissions
WHERE key NOT IN ('staff.manage', 'settings.manage')
ON CONFLICT DO NOTHING;

-- editor: محتوى وامتحانات بلا نشر وبلا حذف وبلا هيكل
INSERT INTO public.admin_role_presets (role, permission_key)
SELECT 'editor', key FROM public.permissions
WHERE key IN (
    'dashboard.access',
    'resources.view', 'resources.create', 'resources.update',
    'exams.view', 'exams.create', 'exams.update',
    'reports.view', 'analytics.view'
)
ON CONFLICT DO NOTHING;
-- المنح المخصّصة (الحدود الفعلية لكل موظف)
CREATE TABLE IF NOT EXISTS public.admin_permissions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id       UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
    effect         TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow','deny')),
    scope_type     TEXT NOT NULL DEFAULT 'global'
                   CHECK (scope_type IN ('global','subject','content_type','week','resource','exam')),
    scope_id       UUID,
    expires_at     TIMESTAMPTZ,
    granted_by     UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT admin_permissions_scope_chk CHECK (
        (effect = 'deny' AND scope_type = 'global' AND scope_id IS NULL)
        OR (effect = 'allow' AND (
                (scope_type = 'global' AND scope_id IS NULL)
                OR (scope_type <> 'global' AND scope_id IS NOT NULL)
            ))
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_permissions_global
    ON public.admin_permissions(admin_id, permission_key) WHERE scope_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_permissions_scoped
    ON public.admin_permissions(admin_id, permission_key, scope_type, scope_id) WHERE scope_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_permissions_admin
    ON public.admin_permissions(admin_id, permission_key);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_scope
    ON public.admin_permissions(scope_type, scope_id) WHERE scope_id IS NOT NULL;

-- سجل نشاط الموظفين (المرحلة 5 — مفيد للمحاسبة وصفحة «آخر التعديلات»)
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
    id         BIGSERIAL PRIMARY KEY,
    admin_id   UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    action     TEXT NOT NULL,
    entity     TEXT NOT NULL,
    entity_id  UUID,
    diff       JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON public.admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON public.admin_activity_log(admin_id, created_at DESC);

-- أعمدة تدقيق على المحتوى: من أنشأ ومن عدّل
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.admins(id) ON DELETE SET NULL;
ALTER TABLE public.exams     ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL;
ALTER TABLE public.exams     ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.admins(id) ON DELETE SET NULL;
-- ---------------------------------------------------------------------------
-- 6.3) دوال الفحص في schema private  ← جوهر النظام
-- ---------------------------------------------------------------------------
-- كل الدوال: SECURITY DEFINER + STABLE + search_path = '' + أسماء مؤهلة بالكامل.
-- لماذا SECURITY DEFINER؟ (1) قراءة جداول الصلاحيات بلا تعقيد سياسات،
-- (2) كسر التكرار عند استدعاء الدوال من داخل سياسة على نفس الجدول
--     (المالك postgres يملك bypassrls) — نفس مبدأ is_admin() الحالية.

-- هل المستخدم الحالي مستخدم إداري مُفعَّل (أي رتبة)؟
CREATE OR REPLACE FUNCTION private.is_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admins
        WHERE id = (SELECT auth.uid()) AND is_active
    );
$$;

CREATE OR REPLACE FUNCTION private.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admins
        WHERE id = (SELECT auth.uid()) AND role = 'super_admin' AND is_active
    );
$$;

-- النطاقات الفعّالة لمفتاح صلاحية واحد، مع قاعدتين:
--  1) أي صف صريح لهذا المفتاح (سارٍ أو منتهٍ) يُلغي القالب الافتراضي — فلا يتوسّع
--     الوصول بعد انتهاء صلاحية مؤقتة (كانت هذه علّة في النموذج الأول).
--  2) صف المنع (effect='deny') يلغي كل المنح لنفس المفتاح.
CREATE OR REPLACE FUNCTION private.permission_scopes(p_key TEXT)
RETURNS TABLE (scope_type TEXT, scope_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    WITH all_rows AS (
        SELECT 1 FROM public.admin_permissions ap
        WHERE ap.admin_id = (SELECT auth.uid())
          AND ap.permission_key = p_key
    ),
    grants AS (
        SELECT ap.effect, ap.scope_type, ap.scope_id
        FROM public.admin_permissions ap
        WHERE ap.admin_id = (SELECT auth.uid())
          AND ap.permission_key = p_key
          AND (ap.expires_at IS NULL OR ap.expires_at > NOW())
    )
    SELECT g.scope_type, g.scope_id
    FROM grants g
    WHERE g.effect = 'allow'
      AND NOT EXISTS (SELECT 1 FROM grants d WHERE d.effect = 'deny')
    UNION ALL
    SELECT 'global'::TEXT, NULL::UUID
    WHERE NOT EXISTS (SELECT 1 FROM all_rows)
      AND EXISTS (
          SELECT 1
          FROM public.admins a
          JOIN public.admin_role_presets rp ON rp.role = a.role
          WHERE a.id = (SELECT auth.uid())
            AND a.is_active
            AND rp.permission_key = p_key
      );
$$;

-- صلاحية على مستوى النظام كله
CREATE OR REPLACE FUNCTION private.has_permission(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT private.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM private.permission_scopes(p_key) s
            WHERE s.scope_type = 'global'
        );
$$;

-- هل يملك المفتاح بأي نطاق (تُستخدم لبوابة الدخول إلى اللوحة مثلاً)
CREATE OR REPLACE FUNCTION private.has_any_scope(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT private.is_super_admin()
        OR EXISTS (SELECT 1 FROM private.permission_scopes(p_key));
$$;

-- صلاحية على مادة دراسية محددة
CREATE OR REPLACE FUNCTION private.can_manage_subject(p_key TEXT, p_subject_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT p_subject_id IS NOT NULL AND (
        private.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM private.permission_scopes(p_key) s
            WHERE s.scope_type = 'global'
               OR (s.scope_type = 'subject' AND s.scope_id = p_subject_id)
        )
    );
$$;

-- صلاحية على مورد محدد (تمر عبر مادته/نوعه/أسبوعه/معرّفه)
CREATE OR REPLACE FUNCTION private.can_manage_resource(p_key TEXT, p_resource_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT private.is_super_admin()
        OR EXISTS (
            SELECT 1
            FROM private.permission_scopes(p_key) s
            JOIN public.resources r ON r.id = p_resource_id
            WHERE s.scope_type = 'global'
               OR (s.scope_type = 'resource'     AND s.scope_id = r.id)
               OR (s.scope_type = 'subject'      AND s.scope_id = r.subject_id)
               OR (s.scope_type = 'content_type' AND s.scope_id = r.content_type_id)
               OR (s.scope_type = 'week'         AND s.scope_id = r.week_id)
        );
$$;

-- صلاحية على امتحان محدد
CREATE OR REPLACE FUNCTION private.can_manage_exam(p_key TEXT, p_exam_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT private.is_super_admin()
        OR EXISTS (
            SELECT 1
            FROM private.permission_scopes(p_key) s
            JOIN public.exams e ON e.id = p_exam_id
            WHERE s.scope_type = 'global'
               OR (s.scope_type = 'exam'    AND s.scope_id = e.id)
               OR (s.scope_type = 'subject' AND s.scope_id = e.subject_id)
        );
$$;

-- صلاحية على بلاغ محدد (النطاق يُشتق من المورد المُبلَّغ عنه)
CREATE OR REPLACE FUNCTION private.can_manage_report(p_key TEXT, p_report_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT private.is_super_admin()
        OR EXISTS (
            SELECT 1
            FROM private.permission_scopes(p_key) s
            JOIN public.reports rep ON rep.id = p_report_id
            JOIN public.resources r ON r.id = rep.resource_id
            WHERE s.scope_type = 'global'
               OR (s.scope_type = 'resource'     AND s.scope_id = r.id)
               OR (s.scope_type = 'subject'      AND s.scope_id = r.subject_id)
               OR (s.scope_type = 'content_type' AND s.scope_id = r.content_type_id)
               OR (s.scope_type = 'week'         AND s.scope_id = r.week_id)
        );
$$;
-- ---------------------------------------------------------------------------
-- 6.4) إعادة بناء سياسات RLS (تحديدية: إسقاط سياسات هذه الجداول ثم إنشاؤها)
-- ---------------------------------------------------------------------------
-- القاعدة: سياسة SELECT العامة للطلاب تبقى كما هي، ونضيف شرط النطاق للطاقم فقط.

-- (0) تهيئة قابلة لإعادة التشغيل: إسقاط كل سياسات الجداول المُدارة
DO $$
DECLARE
    t TEXT;
    p RECORD;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'admins','permissions','admin_role_presets','admin_permissions','admin_activity_log',
        'subjects','content_types','weeks','resources','exams','exam_questions','reports',
        'ad_slots','direct_ads','notifications','push_subscriptions','system_settings'
    ] LOOP
        FOR p IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = t
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
        END LOOP;
    END LOOP;
END $$;

-- ===== admins: لا يرى الموظف إلا سجله، ومدير الفريق يرى الكل =====
DROP POLICY IF EXISTS "Admins can view admins list" ON public.admins;
DROP POLICY IF EXISTS "Super admins can manage admins" ON public.admins;

CREATE POLICY "Staff can view own record or managers see all"
    ON public.admins FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) OR private.has_permission('staff.manage'));

CREATE POLICY "Staff managers can insert admins"
    ON public.admins FOR INSERT TO authenticated
    WITH CHECK (private.has_permission('staff.manage'));

CREATE POLICY "Staff managers can update admins"
    ON public.admins FOR UPDATE TO authenticated
    USING (private.has_permission('staff.manage'))
    WITH CHECK (private.has_permission('staff.manage'));

CREATE POLICY "Staff managers can delete admins"
    ON public.admins FOR DELETE TO authenticated
    USING (private.has_permission('staff.manage') AND id <> (SELECT auth.uid()));

-- ===== permissions / presets / grants =====
ALTER TABLE public.permissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_presets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read permission catalog"
    ON public.permissions FOR SELECT TO authenticated
    USING (private.is_staff());

CREATE POLICY "Staff can read role presets"
    ON public.admin_role_presets FOR SELECT TO authenticated
    USING (private.is_staff());

CREATE POLICY "Staff managers can edit role presets"
    ON public.admin_role_presets FOR ALL TO authenticated
    USING (private.has_permission('staff.manage'))
    WITH CHECK (private.has_permission('staff.manage'));

-- كل موظف يرى منحه الخاصة (تحتاجها الواجهة)، ومدير الفريق يرى الكل
CREATE POLICY "Staff can read own grants"
    ON public.admin_permissions FOR SELECT TO authenticated
    USING (admin_id = (SELECT auth.uid()) OR private.has_permission('staff.manage'));

CREATE POLICY "Staff managers can grant permissions"
    ON public.admin_permissions FOR INSERT TO authenticated
    WITH CHECK (private.has_permission('staff.manage'));

CREATE POLICY "Staff managers can update permissions"
    ON public.admin_permissions FOR UPDATE TO authenticated
    USING (private.has_permission('staff.manage'))
    WITH CHECK (private.has_permission('staff.manage'));

CREATE POLICY "Staff managers can revoke permissions"
    ON public.admin_permissions FOR DELETE TO authenticated
    USING (private.has_permission('staff.manage'));

CREATE POLICY "Staff managers can read activity log"
    ON public.admin_activity_log FOR SELECT TO authenticated
    USING (private.has_permission('staff.manage'));

-- ===== subjects: تعديل مادة محددة ممكن، لكن الإنشاء/الحذف يحتاج صلاحية عامة =====
DROP POLICY IF EXISTS "Admins can insert subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins can update subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins can delete subjects" ON public.subjects;

CREATE POLICY "Scoped staff can insert subjects"
    ON public.subjects FOR INSERT TO authenticated
    WITH CHECK (private.has_permission('subjects.manage'));

CREATE POLICY "Scoped staff can update subjects"
    ON public.subjects FOR UPDATE TO authenticated
    USING (private.can_manage_subject('subjects.manage', id))
    WITH CHECK (private.can_manage_subject('subjects.manage', id));

CREATE POLICY "Scoped staff can delete subjects"
    ON public.subjects FOR DELETE TO authenticated
    USING (private.has_permission('subjects.manage'));

-- ===== content_types / weeks: صلاحية عامة فقط (لا معنى لنطاق جزئي) =====
DROP POLICY IF EXISTS "Admins can insert content types" ON public.content_types;
DROP POLICY IF EXISTS "Admins can update content types" ON public.content_types;
DROP POLICY IF EXISTS "Admins can delete content types" ON public.content_types;

CREATE POLICY "Staff can insert content types"
    ON public.content_types FOR INSERT TO authenticated
    WITH CHECK (private.has_permission('content_types.manage'));
CREATE POLICY "Staff can update content types"
    ON public.content_types FOR UPDATE TO authenticated
    USING (private.has_permission('content_types.manage'))
    WITH CHECK (private.has_permission('content_types.manage'));
CREATE POLICY "Staff can delete content types"
    ON public.content_types FOR DELETE TO authenticated
    USING (private.has_permission('content_types.manage'));

DROP POLICY IF EXISTS "Admins can insert weeks" ON public.weeks;
DROP POLICY IF EXISTS "Admins can update weeks" ON public.weeks;
DROP POLICY IF EXISTS "Admins can delete weeks" ON public.weeks;

CREATE POLICY "Staff can insert weeks"
    ON public.weeks FOR INSERT TO authenticated
    WITH CHECK (private.has_permission('weeks.manage'));
CREATE POLICY "Staff can update weeks"
    ON public.weeks FOR UPDATE TO authenticated
    USING (private.has_permission('weeks.manage'))
    WITH CHECK (private.has_permission('weeks.manage'));
CREATE POLICY "Staff can delete weeks"
    ON public.weeks FOR DELETE TO authenticated
    USING (private.has_permission('weeks.manage'));
-- ===== resources: العرض/الإنشاء/التعديل/الحذف حسب النطاق =====
DROP POLICY IF EXISTS "Public can view published or coming_soon resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can insert resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can update resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can delete resources" ON public.resources;

CREATE POLICY "Public can view published or coming_soon resources"
    ON public.resources FOR SELECT TO anon, authenticated
    USING (is_published = true OR is_coming_soon = true);

CREATE POLICY "Scoped staff can view resources in scope"
    ON public.resources FOR SELECT TO authenticated
    USING (private.can_manage_resource('resources.view', id));

CREATE POLICY "Scoped staff can insert resources"
    ON public.resources FOR INSERT TO authenticated
    WITH CHECK (private.can_manage_subject('resources.create', subject_id));

CREATE POLICY "Scoped staff can update resources"
    ON public.resources FOR UPDATE TO authenticated
    USING (private.can_manage_resource('resources.update', id))
    -- لا نطلب نطاق مادة هنا: المنح قد تكون على مورد/نوع/أسبوع بعينه،
    -- ومنع «نقل الصف إلى مادة أخرى» تتكفّل به enforce_resource_column_rules.
    WITH CHECK (private.can_manage_resource('resources.update', id));

CREATE POLICY "Scoped staff can delete resources"
    ON public.resources FOR DELETE TO authenticated
    USING (private.can_manage_resource('resources.delete', id));

-- ===== exams =====
DROP POLICY IF EXISTS "Public can view published or coming_soon exams" ON public.exams;
DROP POLICY IF EXISTS "Admins can insert exams" ON public.exams;
DROP POLICY IF EXISTS "Admins can update exams" ON public.exams;
DROP POLICY IF EXISTS "Admins can delete exams" ON public.exams;

CREATE POLICY "Public can view published or coming_soon exams"
    ON public.exams FOR SELECT TO anon, authenticated
    USING (is_published = true OR is_coming_soon = true);

CREATE POLICY "Scoped staff can view exams in scope"
    ON public.exams FOR SELECT TO authenticated
    USING (private.can_manage_exam('exams.view', id));

CREATE POLICY "Scoped staff can insert exams"
    ON public.exams FOR INSERT TO authenticated
    WITH CHECK (private.can_manage_subject('exams.create', subject_id));

CREATE POLICY "Scoped staff can update exams"
    ON public.exams FOR UPDATE TO authenticated
    USING (private.can_manage_exam('exams.update', id))
    WITH CHECK (private.can_manage_exam('exams.update', id));

CREATE POLICY "Scoped staff can delete exams"
    ON public.exams FOR DELETE TO authenticated
    USING (private.can_manage_exam('exams.delete', id));

-- ===== exam_questions: النطاق يُشتق من الامتحان الأب =====
DROP POLICY IF EXISTS "Public can view questions of published or coming_soon exams" ON public.exam_questions;
DROP POLICY IF EXISTS "Admins can insert exam questions" ON public.exam_questions;
DROP POLICY IF EXISTS "Admins can update exam questions" ON public.exam_questions;
DROP POLICY IF EXISTS "Admins can delete exam questions" ON public.exam_questions;

CREATE POLICY "Public can view questions of published or coming_soon exams"
    ON public.exam_questions FOR SELECT TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.exams e
            WHERE e.id = exam_questions.exam_id
              AND (e.is_published = true OR e.is_coming_soon = true)
        )
    );

CREATE POLICY "Scoped staff can view exam questions in scope"
    ON public.exam_questions FOR SELECT TO authenticated
    USING (private.can_manage_exam('exams.view', exam_questions.exam_id));

CREATE POLICY "Scoped staff can insert exam questions"
    ON public.exam_questions FOR INSERT TO authenticated
    WITH CHECK (private.can_manage_exam('exams.update', exam_id));

CREATE POLICY "Scoped staff can update exam questions"
    ON public.exam_questions FOR UPDATE TO authenticated
    USING (private.can_manage_exam('exams.update', exam_id))
    WITH CHECK (private.can_manage_exam('exams.update', exam_id));

CREATE POLICY "Scoped staff can delete exam questions"
    ON public.exam_questions FOR DELETE TO authenticated
    USING (private.can_manage_exam('exams.update', exam_id));
-- ===== reports: الطلاب يُبلّغون كما هو، والطاقم يعالج حسب النطاق =====
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can delete reports" ON public.reports;

CREATE POLICY "Scoped staff can view reports"
    ON public.reports FOR SELECT TO authenticated
    USING (private.can_manage_report('reports.view', id));

CREATE POLICY "Scoped staff can update reports"
    ON public.reports FOR UPDATE TO authenticated
    USING (private.can_manage_report('reports.manage', id))
    WITH CHECK (private.can_manage_report('reports.manage', id));

CREATE POLICY "Scoped staff can delete reports"
    ON public.reports FOR DELETE TO authenticated
    USING (private.can_manage_report('reports.manage', id));

-- سياسة الإبلاغ العامة تبقى كما هي (طلاب بلا تسجيل دخول)
-- "Public and users can submit reports" → WITH CHECK (true) — بلا تغيير

-- ===== ad_slots =====
DROP POLICY IF EXISTS "Admins can manage ad slots" ON public.ad_slots;
CREATE POLICY "Ad managers can manage ad slots"
    ON public.ad_slots FOR ALL TO authenticated
    USING (private.has_permission('ads.manage'))
    WITH CHECK (private.has_permission('ads.manage'));

-- ===== direct_ads =====
DROP POLICY IF EXISTS "Admins can manage direct ads" ON public.direct_ads;
CREATE POLICY "Ad managers can manage direct ads"
    ON public.direct_ads FOR ALL TO authenticated
    USING (private.has_permission('ads.manage'))
    WITH CHECK (private.has_permission('ads.manage'));

-- ===== notifications =====
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;

CREATE POLICY "Notification managers can insert notifications"
    ON public.notifications FOR INSERT TO authenticated
    WITH CHECK (private.has_permission('notifications.manage'));
CREATE POLICY "Notification managers can update notifications"
    ON public.notifications FOR UPDATE TO authenticated
    USING (private.has_permission('notifications.manage'))
    WITH CHECK (private.has_permission('notifications.manage'));
CREATE POLICY "Notification managers can delete notifications"
    ON public.notifications FOR DELETE TO authenticated
    USING (private.has_permission('notifications.manage'));

-- ===== push_subscriptions: عرض القائمة صار مقصورًا على من يدير الإشعارات =====
DROP POLICY IF EXISTS "Admins can view push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Notification managers can view push subscriptions"
    ON public.push_subscriptions FOR SELECT TO authenticated
    USING (private.has_permission('notifications.manage'));

-- ===== system_settings (إعدادات AI) =====
DROP POLICY IF EXISTS "Admins can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;

CREATE POLICY "Settings managers can view system settings"
    ON public.system_settings FOR SELECT TO authenticated
    USING (private.has_permission('settings.manage'));

CREATE POLICY "Settings managers can manage system settings"
    ON public.system_settings FOR ALL TO authenticated
    USING (private.has_permission('settings.manage'))
    WITH CHECK (private.has_permission('settings.manage'));
-- ---------------------------------------------------------------------------
-- 6.5) Triggers: قواعد لا تستطيع RLS التعبير عنها
-- ---------------------------------------------------------------------------
-- قاعدة عامة في كل trigger حماية: إن لم يكن هناك مستخدم (service_role / سكربت /
-- ترحيل) نمرّ بلا فحص، لأن تلك العمليات تتجاوز RLS أصلًا بطبيعتها.

-- (أ) حماية أعمدة المورد: النشر وإعادة التصنيف + تسجيل من عدّل
CREATE OR REPLACE FUNCTION private.enforce_resource_column_rules()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_uid             UUID := (SELECT auth.uid());
    v_publish_changed BOOLEAN;
    v_scope_changed   BOOLEAN;
BEGIN
    IF v_uid IS NULL THEN
        RETURN NEW;
    END IF;

    v_publish_changed := (NEW.is_published  IS DISTINCT FROM OLD.is_published)
                      OR (NEW.is_coming_soon IS DISTINCT FROM OLD.is_coming_soon)
                      OR (NEW.published_at  IS DISTINCT FROM OLD.published_at);

    v_scope_changed := (NEW.subject_id      IS DISTINCT FROM OLD.subject_id)
                    OR (NEW.content_type_id IS DISTINCT FROM OLD.content_type_id)
                    OR (NEW.week_id         IS DISTINCT FROM OLD.week_id);

    IF v_publish_changed
       AND NOT private.can_manage_resource('resources.publish', OLD.id) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية نشر أو إلغاء نشر هذا المورد'
            USING ERRCODE = '42501';
    END IF;

    IF v_scope_changed AND NOT (
           private.can_manage_resource('resources.reassign', OLD.id)
           AND private.can_manage_subject('resources.reassign', NEW.subject_id)
       ) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية نقل المورد إلى مادة أو تصنيف آخر'
            USING ERRCODE = '42501';
    END IF;

    NEW.updated_by := v_uid;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_resource_column_rules ON public.resources;
CREATE TRIGGER enforce_resource_column_rules
    BEFORE UPDATE ON public.resources
    FOR EACH ROW
    EXECUTE FUNCTION private.enforce_resource_column_rules();

-- (ب) حماية أعمدة الامتحان
CREATE OR REPLACE FUNCTION private.enforce_exam_column_rules()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_uid             UUID := (SELECT auth.uid());
    v_publish_changed BOOLEAN;
BEGIN
    IF v_uid IS NULL THEN
        RETURN NEW;
    END IF;

    v_publish_changed := (NEW.is_published    IS DISTINCT FROM OLD.is_published)
                      OR (NEW.is_coming_soon   IS DISTINCT FROM OLD.is_coming_soon)
                      OR (NEW.coming_soon_message IS DISTINCT FROM OLD.coming_soon_message);

    IF v_publish_changed AND NOT private.can_manage_exam('exams.publish', OLD.id) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية نشر أو إلغاء نشر هذا الامتحان'
            USING ERRCODE = '42501';
    END IF;

    IF NEW.subject_id IS DISTINCT FROM OLD.subject_id AND NOT (
           private.can_manage_exam('exams.update', OLD.id)
           AND private.can_manage_subject('exams.update', NEW.subject_id)
       ) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية نقل الامتحان إلى مادة أخرى'
            USING ERRCODE = '42501';
    END IF;

    NEW.updated_by := v_uid;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_exam_column_rules ON public.exams;
CREATE TRIGGER enforce_exam_column_rules
    BEFORE UPDATE ON public.exams
    FOR EACH ROW
    EXECUTE FUNCTION private.enforce_exam_column_rules();

-- (ج) تسجيل المُنشئ عند الإضافة
CREATE OR REPLACE FUNCTION private.set_content_creator()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
BEGIN
    IF v_uid IS NOT NULL THEN
        -- تُثبَّت من الجلسة دائمًا: لا يُسمح للعميل بتزوير «من أنشأ/من عدّل»
        NEW.created_by := v_uid;
        NEW.updated_by := v_uid;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_resource_creator ON public.resources;
CREATE TRIGGER set_resource_creator
    BEFORE INSERT ON public.resources
    FOR EACH ROW EXECUTE FUNCTION private.set_content_creator();

DROP TRIGGER IF EXISTS set_exam_creator ON public.exams;
CREATE TRIGGER set_exam_creator
    BEFORE INSERT ON public.exams
    FOR EACH ROW EXECUTE FUNCTION private.set_content_creator();
-- (د) التحقق من صحة المنح: وجود النطاق فعلاً + منع تصعيد الصلاحيات
CREATE OR REPLACE FUNCTION private.validate_permission_scope()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_uid          UUID := (SELECT auth.uid());
    v_scope_exists BOOLEAN := TRUE;
BEGIN
    IF NEW.scope_type = 'subject' THEN
        v_scope_exists := EXISTS (SELECT 1 FROM public.subjects WHERE id = NEW.scope_id);
    ELSIF NEW.scope_type = 'content_type' THEN
        v_scope_exists := EXISTS (SELECT 1 FROM public.content_types WHERE id = NEW.scope_id);
    ELSIF NEW.scope_type = 'week' THEN
        v_scope_exists := EXISTS (SELECT 1 FROM public.weeks WHERE id = NEW.scope_id);
    ELSIF NEW.scope_type = 'resource' THEN
        v_scope_exists := EXISTS (SELECT 1 FROM public.resources WHERE id = NEW.scope_id);
    ELSIF NEW.scope_type = 'exam' THEN
        v_scope_exists := EXISTS (SELECT 1 FROM public.exams WHERE id = NEW.scope_id);
    END IF;

    IF NOT v_scope_exists THEN
        RAISE EXCEPTION 'النطاق المحدد غير موجود (%)', NEW.scope_id
            USING ERRCODE = '23503';
    END IF;

    IF v_uid IS NOT NULL AND NEW.expires_at IS NOT NULL AND NEW.expires_at <= NOW() THEN
        RAISE EXCEPTION 'تاريخ انتهاء الصلاحية يجب أن يكون في المستقبل'
            USING ERRCODE = '22007';
    END IF;

    -- عمليات الخادم (service_role / SQL Editor / سكربتات التهيئة) تتجاوز فحوص التصعيد
    IF v_uid IS NULL THEN
        RETURN NEW;
    END IF;

    -- لا يمنح أحد صلاحية لا يملكها عالميًا (عدا المدير العام)
    IF NOT private.is_super_admin() AND NOT private.has_permission(NEW.permission_key) THEN
        RAISE EXCEPTION 'لا يمكنك منح صلاحية لا تملكها: %', NEW.permission_key
            USING ERRCODE = '42501';
    END IF;

    -- لا يمنح أحد نفسه صلاحية جديدة (توسيع ذاتي)
    IF NEW.admin_id = v_uid AND NOT private.is_super_admin() THEN
        RAISE EXCEPTION 'لا يمكنك تعديل صلاحياتك بنفسك'
            USING ERRCODE = '42501';
    END IF;

    NEW.granted_by := v_uid;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_permission_scope ON public.admin_permissions;
CREATE TRIGGER validate_permission_scope
    BEFORE INSERT OR UPDATE ON public.admin_permissions
    FOR EACH ROW
    EXECUTE FUNCTION private.validate_permission_scope();

-- (هـ) تنظيف المنح اليتيمة عند حذف المادة/المورد/الامتحان/التصنيف/الأسبوع
CREATE OR REPLACE FUNCTION private.cleanup_admin_permissions_for_scope()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.admin_permissions WHERE scope_id = OLD.id;
    RETURN OLD;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['subjects','content_types','weeks','resources','exams'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS cleanup_scope_grants ON public.%I', t);
        EXECUTE format(
            'CREATE TRIGGER cleanup_scope_grants AFTER DELETE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION private.cleanup_admin_permissions_for_scope()', t);
    END LOOP;
END $$;

-- (و) حماية المدير العام الأخير ومنع تصعيد الرتبة
CREATE OR REPLACE FUNCTION private.protect_super_admins()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_active_supers INT;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT COUNT(*) INTO v_active_supers
    FROM public.admins WHERE role = 'super_admin' AND is_active;

    IF TG_OP = 'DELETE' THEN
        IF OLD.role = 'super_admin' AND v_active_supers <= 1 THEN
            RAISE EXCEPTION 'لا يمكن حذف آخر مدير عام في النظام' USING ERRCODE = '42501';
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.role = 'super_admin' AND NOT private.is_super_admin() THEN
        RAISE EXCEPTION 'ترقية حساب إلى مدير عام تتم بواسطة مدير عام فقط'
            USING ERRCODE = '42501';
    END IF;

    IF OLD.role = 'super_admin'
       AND (NEW.role <> 'super_admin' OR NEW.is_active = false)
       AND v_active_supers <= 1 THEN
        RAISE EXCEPTION 'لا يمكن تعطيل أو تخفيض آخر مدير عام في النظام'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_super_admins ON public.admins;
CREATE TRIGGER protect_super_admins
    BEFORE UPDATE OR DELETE ON public.admins
    FOR EACH ROW
    EXECUTE FUNCTION private.protect_super_admins();
-- ---------------------------------------------------------------------------
-- 6.6) RPCs للواجهة + إبقاء التوافق الخلفي مع is_admin()
-- ---------------------------------------------------------------------------

-- is_admin() تبقى كما هي بالمعنى القديم (أي موظف مُفعَّل) حتى لا ينكسر أي كود قديم،
-- لكنها الآن تحترم is_active: تعطيل الموظف يسحب وصوله فورًا.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT private.is_staff();
$$;

-- ملخص صلاحيات المستخدم الحالي — تستهلكه الواجهة لتوليد القوائم والأزرار
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'admin_id',       (SELECT auth.uid()),
        'email',          (SELECT a.email FROM public.admins a WHERE a.id = (SELECT auth.uid())),
        'role',           (SELECT a.role  FROM public.admins a WHERE a.id = (SELECT auth.uid())),
        'is_active',      COALESCE((SELECT a.is_active FROM public.admins a WHERE a.id = (SELECT auth.uid())), false),
        'is_super_admin', private.is_super_admin(),
        'is_staff',       private.is_staff(),
        'global', COALESCE((
            SELECT jsonb_agg(p.key ORDER BY p.order_index)
            FROM public.permissions p
            WHERE private.has_permission(p.key)
        ), '[]'::jsonb),
        'scoped', COALESCE((
            SELECT jsonb_agg(
                       jsonb_build_object(
                           'key',        p.key,
                           'scope_type', s.scope_type,
                           'scope_id',   s.scope_id
                       ) ORDER BY p.key
                   )
            FROM public.permissions p
            CROSS JOIN LATERAL private.permission_scopes(p.key) s
            WHERE s.scope_type <> 'global'
        ), '[]'::jsonb),
        'denied', COALESCE((
            SELECT jsonb_agg(DISTINCT ap.permission_key)
            FROM public.admin_permissions ap
            WHERE ap.admin_id = (SELECT auth.uid())
              AND ap.effect = 'deny'
              AND (ap.expires_at IS NULL OR ap.expires_at > NOW())
        ), '[]'::jsonb),
        'scoped_subject_ids', COALESCE((
            SELECT jsonb_agg(DISTINCT s.scope_id)
            FROM public.permissions p
            CROSS JOIN LATERAL private.permission_scopes(p.key) s
            WHERE s.scope_type = 'subject'
        ), '[]'::jsonb)
    );
$$;

-- قائمة البلاغات للطاقم: الفلترة بالنطاق داخل الدالة، فلا تتعارض مع RLS على الموارد
-- (استعلام الواجهة السابق `reports?select=*,resource:resources(*)` قد يُسقط صفوفًا
--  لأن RLS على resources قد تحجب المورد المرتبط عن الموظف المحدود).
CREATE OR REPLACE FUNCTION public.list_staff_reports()
RETURNS TABLE (
    id             UUID,
    resource_id    UUID,
    issue_type     TEXT,
    details        TEXT,
    status         TEXT,
    created_at     TIMESTAMPTZ,
    resolved_at    TIMESTAMPTZ,
    resource_title TEXT,
    subject_id     UUID,
    subject_name   TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT rep.id,
           rep.resource_id,
           rep.issue_type,
           rep.details,
           rep.status,
           rep.created_at,
           rep.resolved_at,
           r.title,
           r.subject_id,
           s.name
    FROM public.reports rep
    JOIN public.resources r ON r.id = rep.resource_id
    LEFT JOIN public.subjects s ON s.id = r.subject_id
    WHERE private.can_manage_report('reports.view', rep.id)
    ORDER BY rep.created_at DESC
    LIMIT 500;
$$;

-- استبدال حدود موظف كاملة في عملية ذرّية واحدة (تستخدمها شاشة الصلاحيات).
-- الفحوص الفردية (وجود النطاق، الانتهاء، منع التصعيد، منع المنح الذاتي) تُطبَّق
-- تلقائيًا عبر trigger validate_permission_scope على كل صف، والاستدعاء كله معاملة واحدة.
CREATE OR REPLACE FUNCTION public.set_staff_permissions(p_admin_id UUID, p_entries JSONB)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    IF NOT private.has_permission('staff.manage') THEN
        RAISE EXCEPTION 'غير مصرح: إدارة صلاحيات الفريق تتطلب صلاحية staff.manage'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.admins WHERE id = p_admin_id) THEN
        RAISE EXCEPTION 'الموظف غير موجود' USING ERRCODE = '23503';
    END IF;

    DELETE FROM public.admin_permissions WHERE admin_id = p_admin_id;

    INSERT INTO public.admin_permissions (admin_id, permission_key, effect, scope_type, scope_id, expires_at)
    SELECT p_admin_id,
           e ->> 'key',
           COALESCE(e ->> 'effect', 'allow'),
           COALESCE(e ->> 'scope_type', 'global'),
           NULLIF(e ->> 'scope_id', '')::uuid,
           NULLIF(e ->> 'expires_at', '')::timestamptz
    FROM jsonb_array_elements(COALESCE(p_entries, '[]'::jsonb)) e;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
-- ===== فصل السياسات العامة عن سياسات الطاقم =====
-- مهم: السياسات الموجّهة إلى `anon` يجب ألا تستدعي دوال `private.*` أو `is_admin()`،
-- لأن تنفيذ الدوال يخضع لصلاحية المستدعي، و`anon` لا يملك EXECUTE عليها.
-- الحل: سياستان متوازيتان (تتجمعان بـOR لأن السياسات permissive افتراضيًا).

DROP POLICY IF EXISTS "Public can view active subjects" ON public.subjects;
CREATE POLICY "Public can view active subjects"
    ON public.subjects FOR SELECT TO anon, authenticated
    USING (is_active = true);
CREATE POLICY "Staff can view all subjects"
    ON public.subjects FOR SELECT TO authenticated
    USING (private.is_staff());

DROP POLICY IF EXISTS "Public can view active content types" ON public.content_types;
CREATE POLICY "Public can view active content types"
    ON public.content_types FOR SELECT TO anon, authenticated
    USING (is_active = true);
CREATE POLICY "Staff can view all content types"
    ON public.content_types FOR SELECT TO authenticated
    USING (private.is_staff());

DROP POLICY IF EXISTS "Public can view weeks" ON public.weeks;
CREATE POLICY "Public can view weeks"
    ON public.weeks FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Public can view active ad slots" ON public.ad_slots;
CREATE POLICY "Public can view active ad slots"
    ON public.ad_slots FOR SELECT TO anon, authenticated
    USING (is_active = true);
CREATE POLICY "Ad managers can view all ad slots"
    ON public.ad_slots FOR SELECT TO authenticated
    USING (private.has_permission('ads.manage'));

DROP POLICY IF EXISTS "Public can view running direct ads" ON public.direct_ads;
CREATE POLICY "Public can view running direct ads"
    ON public.direct_ads FOR SELECT TO anon, authenticated
    USING (is_active = true AND NOW() BETWEEN start_date AND end_date);
CREATE POLICY "Ad managers can view all direct ads"
    ON public.direct_ads FOR SELECT TO authenticated
    USING (private.has_permission('ads.manage'));

DROP POLICY IF EXISTS "Public can view active notifications" ON public.notifications;
CREATE POLICY "Public can view active notifications"
    ON public.notifications FOR SELECT TO anon, authenticated
    USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));
CREATE POLICY "Notification managers can view all notifications"
    ON public.notifications FOR SELECT TO authenticated
    USING (private.has_permission('notifications.manage'));

-- ===== سياسات عامة محفوظة بنصّها الأصلي (تُعاد لأن 6.4 يبني السياسات من الصفر) =====
-- مقصودة ومتسامحة بحكم التصميم: طالب بلا حساب يستطيع الإبلاغ والاشتراك في Push.
-- (تقييدها يكون بـRate limiting أو CAPTCHA على مستوى الـAPI، لا بـRLS.)

CREATE POLICY "Public and users can submit reports"
    ON public.reports FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Public can insert push subscriptions"
    ON public.push_subscriptions FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Public can delete push subscriptions"
    ON public.push_subscriptions FOR DELETE TO anon, authenticated
    USING (true);
-- ---------------------------------------------------------------------------
-- 6.7) الصلاحيات (Grants): تصغير سطح الهجوم
-- ---------------------------------------------------------------------------
-- ملاحظة: بعد فصل السياسات العامة، لم تُعد أي سياسة موجّهة لـanon تستدعي دوال
-- private.* أو is_admin()، لذا يمكن سحب التنفيذ منها بأمان.

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- جداول الصلاحيات الجديدة
REVOKE ALL ON public.permissions, public.admin_role_presets,
              public.admin_permissions, public.admin_activity_log FROM anon;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.admin_role_presets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_permissions TO authenticated;
GRANT SELECT ON public.admin_activity_log TO authenticated;
GRANT ALL ON public.permissions, public.admin_role_presets,
             public.admin_permissions, public.admin_activity_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_activity_log_id_seq TO service_role;

-- تقليل سطح الهجوم: الزائر (anon) لا يحتاج كتابة إلا في الإبلاغ والاشتراك بالـPush.
-- (كان anon يملك INSERT/UPDATE/DELETE على كل الجداول بفضل افتراضيات Supabase،
--  وRLS وحدها كانت تمنعها — إزالة المنح تجعل المنع على طبقتين.)
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
GRANT INSERT ON public.reports TO anon;
GRANT INSERT, DELETE ON public.push_subscriptions TO anon;
GRANT SELECT ON public.subjects, public.content_types, public.weeks,
                public.resources, public.exams, public.exam_questions,
                public.ad_slots, public.direct_ads, public.notifications,
                public.reports, public.push_subscriptions, public.system_settings
      TO anon;

-- منع تكرار المشكلة مع أي جدول مستقبلي (يُنفَّذ بصلاحية الدور المالك)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;

-- الدوال العامة: بلا تنفيذ للعموم
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

REVOKE ALL ON FUNCTION public.list_staff_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_staff_reports() TO authenticated;

REVOKE ALL ON FUNCTION public.set_staff_permissions(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_staff_permissions(UUID, JSONB) TO authenticated;
