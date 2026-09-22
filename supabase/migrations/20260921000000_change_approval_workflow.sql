-- ============================================================================
-- Migration: Change Approval Workflow (سير اعتماد التعديلات)
-- الوظيفة: أي تعديل على المحتوى من موظف (admin/editor) يتحول إلى «طلب تغيير»
--          معلّق في أرشيف المدير العام؛ لا يُطبَّق إلا بعد موافقة super_admin.
--          الإعلانات والإشعارات وإعدادات النظام/الذكاء الاصطناعي محصورة كليًا
--          بالمدير العام (لا تمرّ بطابور الموافقات أصلًا).
-- Idempotent: يمكن تشغيله أكثر من مرة بأمان.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 7.1) جدول طلبات التغيير (الأرشيف)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.change_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity        TEXT NOT NULL CHECK (entity IN
                    ('resources', 'exams', 'subjects', 'content_types', 'weeks')),
    entity_id     UUID,                     -- يُملأ تلقائيًا عند الإنشاء إن غاب
    action        TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    payload       JSONB NOT NULL,           -- البيانات المقترحة (للامتحانات: حقول + questions[])
    base_snapshot JSONB,                    -- لقطة الصف الحالي (للفرق وكشف التعارض وأرشيف الحذف)
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    submitted_by  UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
    reviewed_by   UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    reviewed_at   TIMESTAMPTZ,
    review_note   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_requests_status    ON public.change_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_change_requests_submitter ON public.change_requests(submitted_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_requests_entity    ON public.change_requests(entity, entity_id);

ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

-- الموظف يرى طلباته فقط؛ المدير العام يرى الكل
DROP POLICY IF EXISTS "Staff can read own change requests" ON public.change_requests;
CREATE POLICY "Staff can read own change requests"
    ON public.change_requests FOR SELECT TO authenticated
    USING (submitted_by = (SELECT auth.uid()) OR private.is_super_admin());

-- الإدراج المباشر مسموح للطاقم مع تطابق الهوية (الواجهة تمرّ عبر RPC الذي يفرض شروطًا أدق)
DROP POLICY IF EXISTS "Staff can submit change requests" ON public.change_requests;
CREATE POLICY "Staff can submit change requests"
    ON public.change_requests FOR INSERT TO authenticated
    WITH CHECK (private.is_staff() AND submitted_by = (SELECT auth.uid()));

-- لا يوجد UPDATE/DELETE مباشر إطلاقًا: الإلغاء عبر cancel_change_request
-- والموافقة/الرفض عبر review_change_request (كلاهما SECURITY DEFINER).

REVOKE ALL ON public.change_requests FROM anon;
GRANT SELECT, INSERT ON public.change_requests TO authenticated;
GRANT ALL ON public.change_requests TO service_role;

-- ---------------------------------------------------------------------------
-- 7.2) تشديد RLS على جداول المحتوى: الكتابة المباشرة = super_admin فقط
--      (القراءة بنظام النطاقات تبقى كما هي ليحرّر الموظف ويقدّم طلبات)
-- ---------------------------------------------------------------------------

-- الموارد
DROP POLICY IF EXISTS "Resource creators can insert resources" ON public.resources;
DROP POLICY IF EXISTS "Resource editors can update resources"  ON public.resources;
DROP POLICY IF EXISTS "Resource managers can delete resources" ON public.resources;

CREATE POLICY "Super admins can insert resources"
    ON public.resources FOR INSERT TO authenticated
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can update resources"
    ON public.resources FOR UPDATE TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can delete resources"
    ON public.resources FOR DELETE TO authenticated
    USING (private.is_super_admin());

-- الامتحانات
DROP POLICY IF EXISTS "Exam managers can insert exams" ON public.exams;
DROP POLICY IF EXISTS "Exam editors can update exams"  ON public.exams;
DROP POLICY IF EXISTS "Exam managers can delete exams" ON public.exams;

CREATE POLICY "Super admins can insert exams"
    ON public.exams FOR INSERT TO authenticated
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can update exams"
    ON public.exams FOR UPDATE TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can delete exams"
    ON public.exams FOR DELETE TO authenticated
    USING (private.is_super_admin());

-- أسئلة الامتحانات
DROP POLICY IF EXISTS "Question editors can insert questions" ON public.exam_questions;
DROP POLICY IF EXISTS "Question editors can update questions" ON public.exam_questions;
DROP POLICY IF EXISTS "Question editors can delete questions" ON public.exam_questions;

CREATE POLICY "Super admins can insert questions"
    ON public.exam_questions FOR INSERT TO authenticated
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can update questions"
    ON public.exam_questions FOR UPDATE TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can delete questions"
    ON public.exam_questions FOR DELETE TO authenticated
    USING (private.is_super_admin());

-- المواد الدراسية: سياسة FOR ALL السابقة كانت تشمل القراءة — نفصلها
DROP POLICY IF EXISTS "Subject managers can manage subjects" ON public.subjects;

CREATE POLICY "Subject managers can view subjects"
    ON public.subjects FOR SELECT TO authenticated
    USING (private.has_permission('subjects.manage'));
CREATE POLICY "Super admins can insert subjects"
    ON public.subjects FOR INSERT TO authenticated
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can update subjects"
    ON public.subjects FOR UPDATE TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can delete subjects"
    ON public.subjects FOR DELETE TO authenticated
    USING (private.is_super_admin());

-- أنواع المحتوى
DROP POLICY IF EXISTS "Content type managers can manage content types" ON public.content_types;

CREATE POLICY "Content type managers can view content types"
    ON public.content_types FOR SELECT TO authenticated
    USING (private.has_permission('content_types.manage'));
CREATE POLICY "Super admins can insert content types"
    ON public.content_types FOR INSERT TO authenticated
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can update content types"
    ON public.content_types FOR UPDATE TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can delete content types"
    ON public.content_types FOR DELETE TO authenticated
    USING (private.is_super_admin());

-- الأسابيع
DROP POLICY IF EXISTS "Week managers can manage weeks" ON public.weeks;

CREATE POLICY "Week managers can view weeks"
    ON public.weeks FOR SELECT TO authenticated
    USING (private.has_permission('weeks.manage'));
CREATE POLICY "Super admins can insert weeks"
    ON public.weeks FOR INSERT TO authenticated
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can update weeks"
    ON public.weeks FOR UPDATE TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());
CREATE POLICY "Super admins can delete weeks"
    ON public.weeks FOR DELETE TO authenticated
    USING (private.is_super_admin());

-- ---------------------------------------------------------------------------
-- 7.3) الإعلانات + الإشعارات + الإعدادات: super_admin فقط (بلا طابور موافقات)
-- ---------------------------------------------------------------------------

-- خانات الإعلانات
DROP POLICY IF EXISTS "Ads managers can manage ad slots" ON public.ad_slots;
DROP POLICY IF EXISTS "Public can view active ad slots"  ON public.ad_slots;
CREATE POLICY "Public can view active ad slots"
    ON public.ad_slots FOR SELECT TO anon, authenticated
    USING (is_active = true OR private.is_super_admin());
CREATE POLICY "Super admins can manage ad slots"
    ON public.ad_slots FOR ALL TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());

-- الإعلانات المباشرة
DROP POLICY IF EXISTS "Ads managers can manage direct ads" ON public.direct_ads;
DROP POLICY IF EXISTS "Public can view running direct ads" ON public.direct_ads;
CREATE POLICY "Public can view running direct ads"
    ON public.direct_ads FOR SELECT TO anon, authenticated
    USING (
        (is_active = true AND NOW() BETWEEN start_date AND end_date)
        OR private.is_super_admin()
    );
CREATE POLICY "Super admins can manage direct ads"
    ON public.direct_ads FOR ALL TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());

-- الإشعارات
DROP POLICY IF EXISTS "Notification managers can manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Public can view active notifications"           ON public.notifications;
CREATE POLICY "Public can view active notifications"
    ON public.notifications FOR SELECT TO anon, authenticated
    USING ((is_active = true AND (expires_at IS NULL OR expires_at > NOW()))
           OR private.is_super_admin());
CREATE POLICY "Super admins can manage notifications"
    ON public.notifications FOR ALL TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());

-- إعدادات النظام والذكاء الاصطناعي
DROP POLICY IF EXISTS "Settings managers can view system settings"   ON public.system_settings;
DROP POLICY IF EXISTS "Settings managers can manage system settings" ON public.system_settings;
CREATE POLICY "Super admins can view system settings"
    ON public.system_settings FOR SELECT TO authenticated
    USING (private.is_super_admin());
CREATE POLICY "Super admins can manage system settings"
    ON public.system_settings FOR ALL TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());

-- ---------------------------------------------------------------------------
-- 7.4) دوال RPC: تقديم الطلبات ومراجعتها (SECURITY DEFINER بنمط المشروع)
-- ---------------------------------------------------------------------------

-- تقديم طلب تغيير: يتحقق من صلاحية المقدّم (بنطاقها) ويلتقط اللقطة الحالية.
CREATE OR REPLACE FUNCTION public.submit_change_request(
    p_entity    TEXT,
    p_entity_id UUID,
    p_action    TEXT,
    p_payload   JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_uid     UUID := (SELECT auth.uid());
    v_base    JSONB;
    v_subject UUID;
    v_id      UUID;
BEGIN
    IF v_uid IS NULL OR NOT private.is_staff() THEN
        RAISE EXCEPTION 'غير مصرح: تقديم الطلبات متاح للطاقم فقط'
            USING ERRCODE = '42501';
    END IF;

    IF p_entity NOT IN ('resources', 'exams', 'subjects', 'content_types', 'weeks') THEN
        RAISE EXCEPTION 'كيان غير مدعوم في طلبات التغيير: %', p_entity
            USING ERRCODE = '22023';
    END IF;
    IF p_action NOT IN ('create', 'update', 'delete') THEN
        RAISE EXCEPTION 'إجراء غير مدعوم: %', p_action USING ERRCODE = '22023';
    END IF;
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'صيغة البيانات غير صالحة' USING ERRCODE = '22023';
    END IF;

    -- عند الإنشاء: ثبّت المعرّف داخل الطلب حتى تتمكن الكيانات الفرعية من الإشارة إليه
    IF p_action = 'create' THEN
        p_entity_id := COALESCE(p_entity_id,
            NULLIF(p_payload ->> 'id', '')::uuid,
            gen_random_uuid());
        p_payload := jsonb_set(p_payload, '{id}', to_jsonb(p_entity_id));
    ELSIF p_entity_id IS NULL THEN
        RAISE EXCEPTION 'معرّف الكيان مطلوب للتعديل والحذف' USING ERRCODE = '22023';
    END IF;

    -- ======================= الموارد =======================
    IF p_entity = 'resources' THEN
        IF p_action = 'create' THEN
            v_subject := NULLIF(p_payload ->> 'subject_id', '')::uuid;
            IF v_subject IS NULL
               OR NOT private.can_manage_subject('resources.create', v_subject) THEN
                RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إنشاء مورد في هذه المادة'
                    USING ERRCODE = '42501';
            END IF;
            IF COALESCE((p_payload ->> 'is_published')::boolean, false)
               AND NOT private.can_manage_subject('resources.publish', v_subject) THEN
                RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية النشر'
                    USING ERRCODE = '42501';
            END IF;
        ELSE
            SELECT to_jsonb(r) INTO v_base FROM public.resources r WHERE r.id = p_entity_id;
            IF v_base IS NULL THEN
                RAISE EXCEPTION 'المورد غير موجود' USING ERRCODE = 'P0002';
            END IF;

            IF p_action = 'update' THEN
                IF NOT private.can_manage_resource('resources.update', p_entity_id) THEN
                    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تعديل هذا المورد'
                        USING ERRCODE = '42501';
                END IF;
                IF (p_payload ? 'is_published')
                   AND ((p_payload ->> 'is_published')::boolean
                        IS DISTINCT FROM (v_base ->> 'is_published')::boolean)
                   AND NOT private.can_manage_resource('resources.publish', p_entity_id) THEN
                    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية النشر أو إلغاء النشر'
                        USING ERRCODE = '42501';
                END IF;
                IF ((p_payload ? 'subject_id') AND NULLIF(p_payload ->> 'subject_id', '')::uuid IS DISTINCT FROM (v_base ->> 'subject_id')::uuid)
                   OR ((p_payload ? 'content_type_id') AND NULLIF(p_payload ->> 'content_type_id', '')::uuid IS DISTINCT FROM (v_base ->> 'content_type_id')::uuid)
                   OR ((p_payload ? 'week_id') AND NULLIF(p_payload ->> 'week_id', '')::uuid IS DISTINCT FROM (v_base ->> 'week_id')::uuid) THEN
                    IF NOT (private.can_manage_resource('resources.reassign', p_entity_id)
                            AND private.can_manage_subject('resources.reassign',
                                COALESCE(NULLIF(p_payload ->> 'subject_id', '')::uuid,
                                         (v_base ->> 'subject_id')::uuid))) THEN
                        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية نقل المورد إلى مادة أو تصنيف آخر'
                            USING ERRCODE = '42501';
                    END IF;
                END IF;
            ELSE -- delete
                IF NOT private.can_manage_resource('resources.delete', p_entity_id) THEN
                    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية حذف هذا المورد'
                        USING ERRCODE = '42501';
                END IF;
            END IF;
        END IF;

    -- ======================= الامتحانات =======================
    ELSIF p_entity = 'exams' THEN
        IF p_action = 'create' THEN
            v_subject := NULLIF(p_payload ->> 'subject_id', '')::uuid;
            IF v_subject IS NULL
               OR NOT private.can_manage_subject('exams.create', v_subject) THEN
                RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إنشاء امتحان في هذه المادة'
                    USING ERRCODE = '42501';
            END IF;
            IF COALESCE((p_payload ->> 'is_published')::boolean, false)
               AND NOT private.can_manage_subject('exams.publish', v_subject) THEN
                RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية نشر الامتحانات'
                    USING ERRCODE = '42501';
            END IF;
        ELSE
            SELECT to_jsonb(e) INTO v_base FROM public.exams e WHERE e.id = p_entity_id;
            IF v_base IS NULL THEN
                RAISE EXCEPTION 'الامتحان غير موجود' USING ERRCODE = 'P0002';
            END IF;
            -- أرفق الأسئلة الحالية في اللقطة لعرض الفرق بدقة
            SELECT jsonb_set(v_base, '{questions}', COALESCE((
                       SELECT jsonb_agg(to_jsonb(q) ORDER BY q.question_number)
                       FROM public.exam_questions q WHERE q.exam_id = p_entity_id
                   ), '[]'::jsonb))
              INTO v_base;

            IF p_action = 'update' THEN
                IF NOT private.can_manage_exam('exams.update', p_entity_id) THEN
                    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تعديل هذا الامتحان'
                        USING ERRCODE = '42501';
                END IF;
                IF (p_payload ? 'is_published')
                   AND ((p_payload ->> 'is_published')::boolean
                        IS DISTINCT FROM (v_base ->> 'is_published')::boolean)
                   AND NOT private.can_manage_exam('exams.publish', p_entity_id) THEN
                    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية نشر أو إلغاء نشر الامتحان'
                        USING ERRCODE = '42501';
                END IF;
            ELSE -- delete
                IF NOT private.can_manage_exam('exams.delete', p_entity_id) THEN
                    RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية حذف هذا الامتحان'
                        USING ERRCODE = '42501';
                END IF;
            END IF;
        END IF;

    -- ======================= الكيانات الهيكلية =======================
    ELSIF p_entity = 'subjects' THEN
        IF NOT private.has_permission('subjects.manage') THEN
            RAISE EXCEPTION 'غير مصرح: إدارة المواد تتطلب صلاحية subjects.manage'
                USING ERRCODE = '42501';
        END IF;
        IF p_action <> 'create' THEN
            SELECT to_jsonb(s) INTO v_base FROM public.subjects s WHERE s.id = p_entity_id;
            IF v_base IS NULL THEN RAISE EXCEPTION 'المادة غير موجودة' USING ERRCODE = 'P0002'; END IF;
        END IF;

    ELSIF p_entity = 'content_types' THEN
        IF NOT private.has_permission('content_types.manage') THEN
            RAISE EXCEPTION 'غير مصرح: إدارة أنواع المحتوى تتطلب صلاحية content_types.manage'
                USING ERRCODE = '42501';
        END IF;
        IF p_action <> 'create' THEN
            SELECT to_jsonb(c) INTO v_base FROM public.content_types c WHERE c.id = p_entity_id;
            IF v_base IS NULL THEN RAISE EXCEPTION 'نوع المحتوى غير موجود' USING ERRCODE = 'P0002'; END IF;
        END IF;

    ELSIF p_entity = 'weeks' THEN
        IF NOT private.has_permission('weeks.manage') THEN
            RAISE EXCEPTION 'غير مصرح: إدارة الأسابيع تتطلب صلاحية weeks.manage'
                USING ERRCODE = '42501';
        END IF;
        IF p_action <> 'create' THEN
            SELECT to_jsonb(w) INTO v_base FROM public.weeks w WHERE w.id = p_entity_id;
            IF v_base IS NULL THEN RAISE EXCEPTION 'الأسبوع غير موجود' USING ERRCODE = 'P0002'; END IF;
        END IF;
    END IF;

    INSERT INTO public.change_requests (entity, entity_id, action, payload, base_snapshot, submitted_by)
    VALUES (p_entity, p_entity_id, p_action, p_payload, v_base, v_uid)
    RETURNING id INTO v_id;

    INSERT INTO public.admin_activity_log (admin_id, action, entity, entity_id, diff)
    VALUES (v_uid, 'change_request.submit', p_entity, p_entity_id,
            jsonb_build_object('request_id', v_id, 'change_action', p_action));

    RETURN v_id;
END;
$$;

-- مراجعة طلب: موافقة = تطبيق فعلي في معاملة واحدة؛ رفض = تعليم فقط.
-- p_modified_payload: نسخة عدّلها المدير العام قبل الاعتماد (تُطبَّق بدل الأصلية).
CREATE OR REPLACE FUNCTION public.review_change_request(
    p_id               UUID,
    p_decision         TEXT,
    p_note             TEXT  DEFAULT NULL,
    p_modified_payload JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_uid     UUID := (SELECT auth.uid());
    v_req     public.change_requests%ROWTYPE;
    v_payload JSONB;
    v_row     RECORD;
    v_exam_id UUID;
BEGIN
    IF v_uid IS NULL OR NOT private.is_super_admin() THEN
        RAISE EXCEPTION 'غير مصرح: مراجعة الطلبات متاحة للمدير العام فقط'
            USING ERRCODE = '42501';
    END IF;
    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'قرار غير صالح: %', p_decision USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_req FROM public.change_requests WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الطلب غير موجود' USING ERRCODE = 'P0002';
    END IF;
    IF v_req.status <> 'pending' THEN
        RAISE EXCEPTION 'الطلب ليس معلقًا (حالته الحالية: %)', v_req.status
            USING ERRCODE = '22023';
    END IF;

    -- الرفض لا يغيّر أي بيانات
    IF p_decision = 'rejected' THEN
        UPDATE public.change_requests
           SET status = 'rejected', reviewed_by = v_uid,
               reviewed_at = NOW(), review_note = p_note
         WHERE id = p_id;

        INSERT INTO public.admin_activity_log (admin_id, action, entity, entity_id, diff)
        VALUES (v_uid, 'change_request.reject', v_req.entity, v_req.entity_id,
                jsonb_build_object('request_id', p_id, 'note', p_note));
        RETURN;
    END IF;

    v_payload := COALESCE(p_modified_payload, v_req.payload);
    IF jsonb_typeof(v_payload) <> 'object' THEN
        RAISE EXCEPTION 'صيغة البيانات المعتمدة غير صالحة' USING ERRCODE = '22023';
    END IF;

    -- ======================= الموارد =======================
    IF v_req.entity = 'resources' THEN
        IF v_req.action = 'create' THEN
            v_payload := v_payload - 'created_at' - 'updated_at' - 'created_by' - 'updated_by'
                                   - 'subject' - 'content_type' - 'week';
            SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.resources, v_payload);
            INSERT INTO public.resources
                (id, title, slug, description, subject_id, content_type_id, week_id,
                 pdf_url, youtube_url, is_published, is_coming_soon, coming_soon_message,
                 published_at, created_by)
            VALUES
                (v_row.id, v_row.title, v_row.slug, v_row.description,
                 v_row.subject_id, v_row.content_type_id, v_row.week_id,
                 v_row.pdf_url, v_row.youtube_url,
                 COALESCE(v_row.is_published, false),
                 COALESCE(v_row.is_coming_soon, false),
                 v_row.coming_soon_message, v_row.published_at,
                 v_req.submitted_by);

        ELSIF v_req.action = 'update' THEN
            -- دمج مع الصف الحالي حتى لا تُصفَّر الأعمدة غير المذكورة في الطلب
            SELECT (to_jsonb(r) || COALESCE(p_modified_payload, v_req.payload))
              INTO v_payload
              FROM public.resources r WHERE r.id = v_req.entity_id;
            IF v_payload IS NULL THEN
                RAISE EXCEPTION 'تعذر تطبيق الطلب: المورد لم يعد موجودًا'
                    USING ERRCODE = 'P0002';
            END IF;
            v_payload := v_payload - 'created_at' - 'updated_at' - 'created_by' - 'updated_by'
                                   - 'subject' - 'content_type' - 'week';
            SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.resources, v_payload);
            UPDATE public.resources
               SET title               = v_row.title,
                   slug                = v_row.slug,
                   description         = v_row.description,
                   subject_id          = v_row.subject_id,
                   content_type_id     = v_row.content_type_id,
                   week_id             = v_row.week_id,
                   pdf_url             = v_row.pdf_url,
                   youtube_url         = v_row.youtube_url,
                   is_published        = v_row.is_published,
                   is_coming_soon      = v_row.is_coming_soon,
                   coming_soon_message = v_row.coming_soon_message,
                   published_at        = v_row.published_at
             WHERE id = v_req.entity_id;

        ELSE -- delete
            DELETE FROM public.resources WHERE id = v_req.entity_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'تعذر تطبيق الطلب: المورد لم يعد موجودًا'
                    USING ERRCODE = 'P0002';
            END IF;
        END IF;

    -- ======================= الامتحانات (+ الأسئلة ذرّيًا) =======================
    ELSIF v_req.entity = 'exams' THEN
        IF v_req.action = 'create' THEN
            v_payload := v_payload - 'questions' - 'subject'
                                   - 'created_at' - 'updated_at' - 'created_by' - 'updated_by';
            SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.exams, v_payload);
            INSERT INTO public.exams
                (id, title, subject_id, time_limit_minutes,
                 is_published, is_coming_soon, coming_soon_message, created_by)
            VALUES
                (v_row.id, v_row.title, v_row.subject_id,
                 COALESCE(v_row.time_limit_minutes, 30),
                 COALESCE(v_row.is_published, false),
                 COALESCE(v_row.is_coming_soon, false),
                 v_row.coming_soon_message, v_req.submitted_by)
            RETURNING id INTO v_exam_id;

            IF COALESCE(p_modified_payload, v_req.payload) ? 'questions' THEN
                INSERT INTO public.exam_questions
                    (id, exam_id, question_number, question_text, options,
                     correct_option_index, explanation)
                SELECT COALESCE(NULLIF(q ->> 'id', '')::uuid, gen_random_uuid()),
                       v_exam_id,
                       (q ->> 'question_number')::int,
                       q ->> 'question_text',
                       COALESCE(q -> 'options', '[]'::jsonb),
                       (q ->> 'correct_option_index')::int,
                       COALESCE(q ->> 'explanation', '')
                  FROM jsonb_array_elements(COALESCE(p_modified_payload, v_req.payload) -> 'questions') q;
            END IF;

        ELSIF v_req.action = 'update' THEN
            SELECT (to_jsonb(e) - 'questions')
              INTO v_payload
              FROM public.exams e WHERE e.id = v_req.entity_id;
            IF v_payload IS NULL THEN
                RAISE EXCEPTION 'تعذر تطبيق الطلب: الامتحان لم يعد موجودًا'
                    USING ERRCODE = 'P0002';
            END IF;
            v_payload := v_payload || (COALESCE(p_modified_payload, v_req.payload) - 'questions');
            v_payload := v_payload - 'subject' - 'created_at' - 'updated_at'
                                   - 'created_by' - 'updated_by';
            SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.exams, v_payload);
            UPDATE public.exams
               SET title               = v_row.title,
                   subject_id          = v_row.subject_id,
                   time_limit_minutes  = v_row.time_limit_minutes,
                   is_published        = v_row.is_published,
                   is_coming_soon      = v_row.is_coming_soon,
                   coming_soon_message = v_row.coming_soon_message
             WHERE id = v_req.entity_id;

            -- استبدال كامل مجموعة الأسئلة فقط إذا وردت في الطلب
            IF COALESCE(p_modified_payload, v_req.payload) ? 'questions' THEN
                DELETE FROM public.exam_questions WHERE exam_id = v_req.entity_id;
                INSERT INTO public.exam_questions
                    (id, exam_id, question_number, question_text, options,
                     correct_option_index, explanation)
                SELECT COALESCE(NULLIF(q ->> 'id', '')::uuid, gen_random_uuid()),
                       v_req.entity_id,
                       (q ->> 'question_number')::int,
                       q ->> 'question_text',
                       COALESCE(q -> 'options', '[]'::jsonb),
                       (q ->> 'correct_option_index')::int,
                       COALESCE(q ->> 'explanation', '')
                  FROM jsonb_array_elements(COALESCE(p_modified_payload, v_req.payload) -> 'questions') q;
            END IF;

        ELSE -- delete (الأسئلة تُحذف بالتبعية CASCADE)
            DELETE FROM public.exams WHERE id = v_req.entity_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'تعذر تطبيق الطلب: الامتحان لم يعد موجودًا'
                    USING ERRCODE = 'P0002';
            END IF;
        END IF;

    -- ======================= المواد الدراسية =======================
    ELSIF v_req.entity = 'subjects' THEN
        IF v_req.action = 'create' THEN
            v_payload := v_payload - 'created_at' - 'updated_at';
            SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.subjects, v_payload);
            INSERT INTO public.subjects (id, name, slug, icon, description, order_index, is_active)
            VALUES (v_row.id, v_row.name, v_row.slug, v_row.icon, v_row.description,
                    COALESCE(v_row.order_index, 0), COALESCE(v_row.is_active, true));
        ELSIF v_req.action = 'update' THEN
            SELECT (to_jsonb(s) || v_payload) INTO v_payload
              FROM public.subjects s WHERE s.id = v_req.entity_id;
            IF v_payload IS NULL THEN
                RAISE EXCEPTION 'تعذر تطبيق الطلب: المادة لم تعد موجودة' USING ERRCODE = 'P0002';
            END IF;
            v_payload := v_payload - 'created_at' - 'updated_at';
            SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.subjects, v_payload);
            UPDATE public.subjects
               SET name = v_row.name, slug = v_row.slug, icon = v_row.icon,
                   description = v_row.description, order_index = v_row.order_index,
                   is_active = v_row.is_active
             WHERE id = v_req.entity_id;
        ELSE
            DELETE FROM public.subjects WHERE id = v_req.entity_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'تعذر تطبيق الطلب: المادة لم تعد موجودة' USING ERRCODE = 'P0002';
            END IF;
        END IF;

    -- ======================= أنواع المحتوى =======================
    ELSIF v_req.entity = 'content_types' THEN
        IF v_req.action = 'create' THEN
            v_payload := v_payload - 'created_at' - 'updated_at';
            SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.content_types, v_payload);
            INSERT INTO public.content_types (id, name, slug, description, order_index, is_active)
            VALUES (v_row.id, v_row.name, v_row.slug, v_row.description,
                    COALESCE(v_row.order_index, 0), COALESCE(v_row.is_active, true));
        ELSIF v_req.action = 'update' THEN
            SELECT (to_jsonb(c) || v_payload) INTO v_payload
              FROM public.content_types c WHERE c.id = v_req.entity_id;
            IF v_payload IS NULL THEN
                RAISE EXCEPTION 'تعذر تطبيق الطلب: نوع المحتوى لم يعد موجودًا' USING ERRCODE = 'P0002';
            END IF;
            v_payload := v_payload - 'created_at' - 'updated_at';
            SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.content_types, v_payload);
            UPDATE public.content_types
               SET name = v_row.name, slug = v_row.slug, description = v_row.description,
                   order_index = v_row.order_index, is_active = v_row.is_active
             WHERE id = v_req.entity_id;
        ELSE
            DELETE FROM public.content_types WHERE id = v_req.entity_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'تعذر تطبيق الطلب: نوع المحتوى لم يعد موجودًا' USING ERRCODE = 'P0002';
            END IF;
        END IF;

    -- ======================= الأسابيع =======================
    ELSIF v_req.entity = 'weeks' THEN
        IF v_req.action = 'create' THEN
            v_payload := v_payload - 'created_at';
            SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.weeks, v_payload);
            INSERT INTO public.weeks (id, week_number, title, term)
            VALUES (v_row.id, v_row.week_number, v_row.title, COALESCE(v_row.term, 1));
        ELSIF v_req.action = 'update' THEN
            SELECT (to_jsonb(w) || v_payload) INTO v_payload
              FROM public.weeks w WHERE w.id = v_req.entity_id;
            IF v_payload IS NULL THEN
                RAISE EXCEPTION 'تعذر تطبيق الطلب: الأسبوع لم يعد موجودًا' USING ERRCODE = 'P0002';
            END IF;
            v_payload := v_payload - 'created_at';
            SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.weeks, v_payload);
            UPDATE public.weeks
               SET week_number = v_row.week_number, title = v_row.title, term = v_row.term
             WHERE id = v_req.entity_id;
        ELSE
            DELETE FROM public.weeks WHERE id = v_req.entity_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'تعذر تطبيق الطلب: الأسبوع لم يعد موجودًا' USING ERRCODE = 'P0002';
            END IF;
        END IF;
    END IF;

    -- نجاح التطبيق: علّم الطلب وخزّن النسخة المُطبَّقة فعليًا في الأرشيف
    UPDATE public.change_requests
       SET status = 'approved', reviewed_by = v_uid, reviewed_at = NOW(),
           review_note = p_note, payload = COALESCE(p_modified_payload, v_req.payload)
     WHERE id = p_id;

    INSERT INTO public.admin_activity_log (admin_id, action, entity, entity_id, diff)
    VALUES (v_uid, 'change_request.approve', v_req.entity, v_req.entity_id,
            jsonb_build_object('request_id', p_id, 'change_action', v_req.action,
                               'note', p_note,
                               'modified_before_approval', p_modified_payload IS NOT NULL));
END;
$$;

-- إلغاء طلب معلّق: المقدّم نفسه فقط (أو المدير العام)
CREATE OR REPLACE FUNCTION public.cancel_change_request(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_req public.change_requests%ROWTYPE;
BEGIN
    IF v_uid IS NULL OR NOT private.is_staff() THEN
        RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_req FROM public.change_requests WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الطلب غير موجود' USING ERRCODE = 'P0002';
    END IF;
    IF v_req.submitted_by <> v_uid AND NOT private.is_super_admin() THEN
        RAISE EXCEPTION 'غير مصرح: لا يمكنك إلغاء طلب لم تقدّمه'
            USING ERRCODE = '42501';
    END IF;
    IF v_req.status <> 'pending' THEN
        RAISE EXCEPTION 'لا يمكن إلغاء طلب تمت مراجعته' USING ERRCODE = '22023';
    END IF;

    UPDATE public.change_requests SET status = 'cancelled' WHERE id = p_id;

    INSERT INTO public.admin_activity_log (admin_id, action, entity, entity_id, diff)
    VALUES (v_uid, 'change_request.cancel', v_req.entity, v_req.entity_id,
            jsonb_build_object('request_id', p_id));
END;
$$;

-- قائمة الطلبات المعلّقة للمدير العام (مع بريد المقدّم)
CREATE OR REPLACE FUNCTION public.list_pending_changes()
RETURNS TABLE (
    id              UUID,
    entity          TEXT,
    entity_id       UUID,
    action          TEXT,
    payload         JSONB,
    base_snapshot   JSONB,
    status          TEXT,
    submitted_by    UUID,
    submitter_email TEXT,
    created_at      TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT cr.id, cr.entity, cr.entity_id, cr.action, cr.payload, cr.base_snapshot,
           cr.status, cr.submitted_by, a.email, cr.created_at
      FROM public.change_requests cr
      JOIN public.admins a ON a.id = cr.submitted_by
     WHERE private.is_super_admin()
       AND cr.status = 'pending'
     ORDER BY cr.created_at ASC
     LIMIT 500;
$$;

-- طلبات الموظف نفسه (كل الحالات) مع نتيجة المراجعة
CREATE OR REPLACE FUNCTION public.list_my_changes()
RETURNS TABLE (
    id              UUID,
    entity          TEXT,
    entity_id       UUID,
    action          TEXT,
    payload         JSONB,
    base_snapshot   JSONB,
    status          TEXT,
    review_note     TEXT,
    reviewer_email  TEXT,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT cr.id, cr.entity, cr.entity_id, cr.action, cr.payload, cr.base_snapshot,
           cr.status, cr.review_note, ra.email, cr.reviewed_at, cr.created_at
      FROM public.change_requests cr
      LEFT JOIN public.admins ra ON ra.id = cr.reviewed_by
     WHERE private.is_staff()
       AND cr.submitted_by = (SELECT auth.uid())
     ORDER BY cr.created_at DESC
     LIMIT 200;
$$;

-- أرشيف المدير العام الكامل (كل الحالات، الأحدث أولًا)
CREATE OR REPLACE FUNCTION public.list_all_changes()
RETURNS TABLE (
    id              UUID,
    entity          TEXT,
    entity_id       UUID,
    action          TEXT,
    payload         JSONB,
    base_snapshot   JSONB,
    status          TEXT,
    submitted_by    UUID,
    submitter_email TEXT,
    review_note     TEXT,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT cr.id, cr.entity, cr.entity_id, cr.action, cr.payload, cr.base_snapshot,
           cr.status, cr.submitted_by, a.email, cr.review_note, cr.reviewed_at, cr.created_at
      FROM public.change_requests cr
      JOIN public.admins a ON a.id = cr.submitted_by
     WHERE private.is_super_admin()
     ORDER BY cr.created_at DESC
     LIMIT 500;
$$;

-- ---------------------------------------------------------------------------
-- 7.5) منح التنفيذ وتضييق السطح
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.submit_change_request(TEXT, UUID, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.review_change_request(UUID, TEXT, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_change_request(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_pending_changes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_my_changes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_all_changes() FROM anon;

GRANT EXECUTE ON FUNCTION public.submit_change_request(TEXT, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_change_request(UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_change_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pending_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_all_changes() TO authenticated;

