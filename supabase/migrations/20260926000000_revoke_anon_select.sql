-- ============================================================================
-- Migration: سحب SELECT من anon على push_subscriptions و reports
-- الملف: supabase/migrations/20260926000000_revoke_anon_select.sql
-- الهدف: منع أي زائر (anon) من قراءة جدولي الاشتراكات والبلاغات.
--   - push_subscriptions: كشف endpoint + p256dh + auth يكفي rejoindre إشعارات
--     أي مشترك (خصوصًا بعد خرق مفتاح VAPID). لا حاجة للزائر بالقراءة إطلاقًا
--     (إلغاء الاشتراك عبر DELETE) يكفي.
--   - reports: لا يوجد في الواجهة أي قراءة للبلاغات من جهة الزائر؛ الإرسال
--     (INSERT) هو كل ما يحتاجه anon. القراءة محصورة للطواقم عبر RLS.
--
-- Idempotent: يمكن تشغيله أكثر من مرة بأمان.
-- ملاحظة: لا تُعدّل أي migration قديمة — هذا ملف جديد فقط.
-- ============================================================================

-- 1) منع القراءة العامة لاشتراكات الـ Push
REVOKE SELECT ON public.push_subscriptions FROM anon;

-- حماية من تكرار المشكلة مع أي جدول قادم:
-- أي SELECT يُمنح لـ anon يجب أن يكون مقصودًا ومكتوبًا في migration منفصلة.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE SELECT ON TABLES FROM anon;

-- 2) منع القراءة العامة للبلاغات
REVOKE SELECT ON public.reports FROM anon;

-- 3) تأكيد بقاء ما يحتاجه الزائر فعلًا: الإرسال والاشتراك وإلغاء الاشتراك
GRANT INSERT ON public.reports TO anon;
GRANT INSERT, DELETE ON public.push_subscriptions TO anon;

-- 4) الطواقم تبقى قادرة على القراءة عبر RLS
--    (policies "Admins can view push subscriptions" / "Scoped staff can view reports")
--    ولا نحتاج GRANT جديد: authenticated تحتفظ بصلاحيات SELECT كاملة.
