-- ============================================================================
-- Migration: Student Data Permissions
-- الملف: supabase/migrations/20261001000003_student_permissions.sql
-- الهدف: إضافة 4 مفاتيح صلاحيات لبيانات الطلبة والامتحانات.
--
-- ★ قرار أمني مقصود: هذه المفاتيح **لا تُضاف** إلى admin_role_presets
--   لقالب 'admin' ولا 'editor'. السبب: منع أي أدمن عادي من رؤية
--   بريد كل طالب وهويته ودرجاته دون تخصيص صريح.
--   بشكل افتراضي هذه البيانات لـ super_admin فقط، وأي ترقية تمر عبر
--   validate_permission_scope (نفس النمط الموجود).
--
--   - super_admin يتجاوز كل شيء تلقائيًا.
--   - لمن يريد: منح 'students.view' لـ admin عبر شاشة "الفريق والصلاحيات".
--
-- ⚠️ لماذا الـ DELETE أدناه وليس "عدم الإضافة" فقط؟
--   migration 20260920000000 يسند *كل* مفتاح في الكتالوج إلى قالب 'admin'
--   عدا مفتاحين:
--       SELECT 'admin', key FROM permissions
--       WHERE key NOT IN ('staff.manage','settings.manage')
--   أي أن أي مفتاح يُضاف لاحقًا يتسرّب تلقائيًا إلى قالب 'admin' عند إعادة
--   تشغيل الترحيلات — وهو ما حدث فعلًا في أول اختبار (تسرّبت مفاتيح الطلبة
--   الأربعة إلى القالب عند إعادة التشغيل).
--
--   الـ DELETE يجعل النية صريحة وآمنة مهما كان ترتيب التشغيل:
--     - يزيل أي تسريب سابق.
--     - لا يفشل عند إعادة التشغيل (idempotent).
--     - لا يترك القرار موثّقًا في تعليق فقط.
--   ملاحظة: يمسّ القالب فقط. أي منح صريح عبر set_staff_permissions يعيش في
--   admin_permissions ولا يُمَس هنا.
--
-- supports_scope = true لكلها: يمكن حصر "طلاب الرياضيات فقط" أو
-- "امتحانات آخر 30 يومًا" عبر scope من نوع subject.
--
-- Idempotent: يمكن تشغيله أكثر من مرة بأمان.
-- ============================================================================

INSERT INTO public.permissions (key, label_ar, category, supports_scope, order_index) VALUES
    ('students.view',   'عرض الطلاب',                'system', true, 100),
    ('students.manage', 'إدارة الطلاب',              'system', true, 101),
    ('attempts.view',   'عرض نتائج الامتحانات',       'system', true, 110),
    ('attempts.manage', 'إدارة نتائج الامتحانات',     'system', true, 111)
ON CONFLICT (key) DO UPDATE
    SET label_ar       = EXCLUDED.label_ar,
        category       = EXCLUDED.category,
        supports_scope = EXCLUDED.supports_scope,
        order_index    = EXCLUDED.order_index;

-- إزالة أي تسرب إلى القوالب (انظر التحذير أعلاه). آمنة عند إعادة التشغيل.
DO $$
DECLARE removed INT;
BEGIN
    DELETE FROM public.admin_role_presets
    WHERE permission_key IN ('students.view','students.manage','attempts.view','attempts.manage');
    GET DIAGNOSTICS removed = ROW_COUNT;

    IF removed > 0 THEN
        RAISE NOTICE 'أُزيلت % صلاحية تسريب من قوالب الأدوار', removed;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- جدول presets غير موجود بعد (تثبيت جديد) → لا شيء لتنظيفه
    NULL;
END $$;

DO $$
DECLARE leaked TEXT;
BEGIN
    SELECT string_agg(rp.role::text, ', ') INTO leaked
    FROM public.admin_role_presets rp
    WHERE rp.permission_key IN ('students.view','students.manage','attempts.view','attempts.manage');

    IF leaked IS NOT NULL THEN
        RAISE EXCEPTION 'تسرب باقٍ في القوالب: %', leaked;
    END IF;
    RAISE NOTICE 'تحقّق: لا مفاتيح بيانات الطلبة في أي قالب دور (المتوقع: super_admin فقط افتراضيًا)';
EXCEPTION
    WHEN raise_exception THEN RAISE;
    WHEN OTHERS THEN NULL;
END $$;
