# خطة إضافة رتبة أدمن محدودة الصلاحيات مع حدود قابلة للتخصيص
## Scoped Admin Roles & Custom Permissions — Design + Implementation Plan

> **النطاق**: `apps/admin` (React 19 + Vite)، `apps/web` (Astro)، `supabase/migrations` (PostgreSQL + RLS).
> **الحالة**: تصميم جاهز للتنفيذ — لم يُعدَّل أي ملف كود حتى الآن.

---

## 1. الملخص التنفيذي (TL;DR)

المشروع يحتوي بالفعل على جدول `admins` مع عمود `role` يقبل `admin | super_admin`، وكل سياسات RLS
تبني على دالة واحدة: `public.is_admin()` التي تجيب على سؤال «هل هذا المستخدم موجود في جدول الأدمن؟».

النتيجة: **لا يوجد أي تمييز فعلي بين الرتب**. أي حساب في جدول `admins` يستطيع اليوم أن:

- ينشر/يلغي نشر أي مورد أو امتحان (`resources.is_published`, `exams.is_published`).
- يحذف أي مادة، أي نوع محتوى، أي مورد، أي امتحان.
- يقرأ/يعدّل الإعلانات، البلاغات، الإشعارات، وإعدادات النظام (بما فيها إعدادات الذكاء الاصطناعي).

لذلك **إخفاء الأزرار في واجهة الأدمن ليس حلًا**: المستخدم المحدود يبقى قادرًا على نداء Supabase مباشرة
بمفتاح `anon` + جلسة تسجيل الدخول الخاصة به، فيتجاوز الواجهة بالكامل. الحل الوحيد الصحيح هو
**إنفاذ الصلاحيات داخل قاعدة البيانات (RLS + Triggers)**، والواجهة تصبح طبقة تجميلية فقط.

### القرار المعماري الموصى به

| الطبقة | الآلية | الغرض |
|---|---|---|
| **الرتبة (Role)** | إضافة `editor` إلى `admins.role` | تصنيف عام: `super_admin` / `admin` / `editor` |
| **قوالب الصلاحيات (Presets)** | جدول `admin_role_presets` | الصلاحيات الافتراضية لكل رتبة — قابلة للتعديل من الواجهة |
| **الحدود المخصّصة (Scoped Grants)** | جدول `admin_permissions` | منح/سحب استثنائي لكل مستخدم، بنطاق: عام / مادة / نوع محتوى / أسبوع / مورد محدد / امتحان محدد |
| **الإنفاذ** | `private.can_*()` + سياسات RLS + Triggers | منع أي تجاوز من الواجهة أو من REST API مباشرة |
| **الواجهة** | `usePermissions()` + `StaffManager` | إخفاء ما لا يُسمح به + شاشة إدارة الفريق والصلاحيات |

**أمثلة تتحقق بهذا التصميم:**
- «محرر مسؤول عن الفيزياء والكيمياء فقط، ينشئ ويعدّل الموارد، لكنه **لا يستطيع النشر ولا الحذف**».
- «مشرف محتوى يعدّل **هذا المورد تحديدًا** (إصلاح رابط مكسور) دون رؤية بقية مواد المادة».
- «مشرف بلاغات: يرى ويغلق البلاغات فقط، ولا يلمس الإعلانات أو إعدادات الذكاء الاصطناعي».
- «صلاحية مؤقتة تنتهي تلقائيًا بعد أسبوع» عبر `expires_at`.

---

## 2. تحليل الوضع الحالي (Evidence من الكود)

### 2.1 ما هو موجود فعليًا

| المكوّن | الملف | ملاحظات |
|---|---|---|
| جدول الأدمن | `supabase/migrations/20260910000000_initial_schema.sql:14-19` | `id` = `auth.users.id`، `email`, `role` بـ`CHECK ('admin','super_admin')` |
| دالة الفحص الوحيدة | نفس الملف `:22-29` + تصلّب `20260911000000_security_fixes.sql:18-25` | `is_admin()` بلا تمييز رتبة، مع `SECURITY DEFINER SET search_path = public, auth` |
| سياسات لكل جدول | نفس الملف `:184-334` + `20260910000001:69-128` + `20260914000000` + `20260914000001` | كلها `WITH CHECK (is_admin())` — لا يوجد أي شرط على الصف نفسه |
| قيد `admins` الوحيد المميّز | `initial_schema.sql:190-197` | `super_admin` فقط يدير جدول `admins` (وهو الاستثناء الوحيد لكل النظام) |
| واجهة الأدمن | `apps/admin/src/App.tsx:53-64` | 10 تبويبات ثابتة لكل من يسجّل الدخول |
| مصدر البيانات | `apps/admin/src/api/client.ts` | 37 دالة CRUD مباشرة على Supabase (لا طبقة API وسيطة) |
| فحص الجلسة | `apps/admin/src/App.tsx:21-31` + `AuthLogin.tsx:22-31` | `supabase.auth.getSession()` موجود = دخول، بلا فحص أي رتبة |

### 2.2 الفجوات الحرجة

1. **`is_admin()` ثنائية القيمة** — لا تفرّق بين `super_admin` و`admin`، ولا تعرف أي مفهوم «نطاق».
2. **لا يوجد إنفاذ على مستوى العمود** — سياسة `UPDATE` تسمح بتعديل كل الأعمدة، فلا يمكن حاليًا منع
   «تعديل المورد» مع السماح بـ«تعديل العنوان». هذا يحتاج `BEFORE UPDATE` trigger لأن RLS
   لا يستطيع مقارنة `OLD` بـ`NEW`.
3. **`WITH CHECK` لا يمنع نقل الصف خارج النطاق** — يمكن لمحرر الفيزياء تغيير `subject_id` إلى الكيمياء
   ثم مواصلة التعديل (Privilege/Scope escalation).
4. **تضارب موثّق**: `DEPLOYMENT.md:48` يدرج عمود `is_active` في `admins`، وهو **غير موجود** في أي ترحيل.
   أي تنفيذ حرفي لهذا الأمر يفشل بـ`column "is_active" does not exist`. (تدقيق هذا البند مفيد مستقلًا.)
5. **نقطة نهاية مفتوحة**: `apps/web/src/pages/api/push-send.ts` تقبل `POST` من أي جهة
   (`Access-Control-Allow-Origin: *`) بلا مصادقة، وتستخدم مفتاح `anon`. مع إضافة صلاحيات دقيقة
   للإشعارات، يجب حماية هذا المسار (سرّ مشترك + `service_role` على الخادم) وإلا بقي بابًا خلفيًا لإرسال Push للجميع.

### 2.3 ما لا يحتاج تغييرًا

- **الملفات (PDF) خارج Supabase Storage**: الروابط تُخزَّن كنص (`resources.pdf_url` يشير إلى Google Drive/R2)،
  فلا توجد سياسات Bucket يجب تحديثها. البوابة الفعلية هي جدول `resources`.
- **قراءة الطلاب**: سياسات `SELECT` العامة تعتمد `is_published = true OR is_coming_soon = true`،
  وسنضيف شرط النطاق للأدمن بحيث لا تتأثر تجربة الطالب إطلاقًا.

---

## 3. مقارنة الخيارات وسبب اختيار التصميم

| # | الخيار | كيف يعمل | المزايا | العيوب | الحكم |
|---|---|---|---|---|---|
| A | إخفاء الأزرار في الواجهة فقط | `if (role !== 'super_admin')` في React | أسرع تنفيذ (ساعة) | **لا أمان إطلاقًا**: يمكن نداء Supabase REST مباشرة بنفس الجلسة | ❌ مرفوض |
| B | عمود `permissions JSONB` على `admins` | مصفوفة صلاحيات عامة بلا نطاق | بسيط، تغيير واحد | لا يدعم «مواد معينة / موارد معينة»، لا يُستعلم عنه بكفاءة، لا تدقيق، ولا صلاحية مؤقتة | ⚠️ يكفي لـ«أدمن محدود عام» فقط |
| C | RLS مربوط بعمود `role` مباشرة | `role = 'editor'` داخل كل سياسة | واضح وسريع | كل تعديل على حدود أي موظف = ترحيل قاعدة بيانات جديد (بطيء جدًا تشغيليًا) | ⚠️ لا يحقق «قابلية التخصيص» |
| **D** | **RBAC + Scoped Grants (الموصى به)** | جداول صلاحيات + دوال `private.can_*()` + RLS + Triggers | تخصيص لحظي لكل موظف ومادة/مورد، قابل للتدقيق، صلاحيات مؤقتة، قابل للتوسع بلا كود | أعلى تعقيدًا بعض الشيء (ترحيل واحد + شاشة إدارة) | ✅ **الأنسب** |

**لماذا D تحديدًا مناسب لهذا المشروع؟**
- حجم المشروع صغير (فريق إدارة واحد) لكن أنواع البيانات كثيرة (`subjects`, `content_types`, `weeks`,
  `resources`, `exams`, `reports`, `ads`, `notifications`, `system_settings`) → الحاجة لتخصيص دقيق حقيقية.
- المشروع يستخدم Supabase Client مباشرة من المتصفح (بلا Backend API وسيط)، لذا **RLS هو خط الدفاع الوحيد**،
  والتصميم يجب أن يكون قويًا في قاعدة البيانات لا في الواجهة.
- بنية RLS الحالية (دوال `SECURITY DEFINER` + `is_admin()`) قابلة للتوسعة بشكل نظيف إلى `can_*()` دون تغيير النمط.

---

## 4. نموذج البيانات المقترح

```
admins (موجود)                      admin_role_presets (جديد)
 ├─ id  ────────────┐               ├─ role            ('admin'|'editor')
 ├─ email           │               └─ permission_key  (كتالوج)
 ├─ role  ← يضاف    │
 │   'editor'       │               admin_permissions (جديد)
 └─ is_active?      │               ├─ id
                    ├───────────────├─ admin_id  → admins.id  (ON DELETE CASCADE)
                                    ├─ permission_key → permissions.key
                                    ├─ scope_type     ('global'|'subject'|'content_type'|'week'|'resource'|'exam')
                                    ├─ scope_id       (NULL = عام)
                                    ├─ expires_at     (NULL = دائم)
                                    ├─ granted_by     → admins.id
                                    └─ created_at

permissions (كتالوج)                admin_activity_log (اختياري - المرحلة 5)
 ├─ key (PK)                         ├─ admin_id, action, entity, entity_id
 ├─ label_ar                         ├─ diff jsonb
 ├─ category                         └─ created_at
 └─ supports_scope
```

### قواعد مهمة في النموذج

1. **`scope_id` بلا `FOREIGN KEY`** لأن العلاقة متعددة الأشكال (polymorphic)؛ يُتحقق منها في trigger
   `private.validate_permission_scope()`، وتُنظَّف الصفوف اليتيمة عبر triggers على جداول المصدر عند الحذف.
2. **درجات دقة النطاق**: `global > subject > (content_type | week) > resource/exam`. عند الحاجة إلى
   «تعديل عنوان هذا المورد فقط دون الحذف»، تُمنح `resources.update` بنطاق `resource = <id>` ولا تُمنح `resources.delete`.
3. **لا صلاحيات في الـJWT**: لا نضعها في `user_metadata` (قابلة للتعديل من المستخدم = ثغرة) ولا في
   `app_metadata` (تتطلب إعادة إصدار التوكن وتبقى قديمة). تُقرأ من قاعدة البيانات عند كل استعلام — نفس
   نمط `is_admin()` الحالي، وهذا يضمن أن سحب الصلاحية يسري **فورًا**.
4. **دوال الفحص في schema `private`** (غير مُعرَّض للـData API) مع `SECURITY DEFINER` + `SET search_path = ''`
   + أسماء مؤهلة بالكامل + `REVOKE EXECUTE FROM public` و`GRANT EXECUTE TO authenticated`.
   `SECURITY DEFINER` ضروري هنا لسببين: تجاوز RLS على جداول الصلاحيات، **وكسر أي تكرار (recursion)**
   عند استدعاء الدالة من داخل سياسة على نفس الجدول الذي تقرأه (الدالة تعمل بصلاحية `postgres` المالك
   الذي يملك `bypassrls`).

---

## 5. كتالوج الصلاحيات (Permission Catalog)

| المفتاح | التسمية | التصنيف | يدعم النطاق |
|---|---|---|---|
| `dashboard.access` | الدخول إلى لوحة التحكم | عام | لا |
| `resources.view` | عرض الموارد (المسودات) | المحتوى | نعم |
| `resources.create` | إنشاء مورد | المحتوى | نعم |
| `resources.update` | تعديل مورد | المحتوى | نعم |
| `resources.publish` | نشر / إلغاء نشر | المحتوى | نعم |
| `resources.delete` | حذف مورد | المحتوى | نعم |
| `resources.reassign` | نقل مورد إلى مادة/نوع/أسبوع آخر | المحتوى | نعم |
| `exams.view` | عرض الامتحانات (غير المنشورة) | الامتحانات | نعم |
| `exams.create` | إنشاء امتحان | الامتحانات | نعم |
| `exams.update` | تعديل امتحان وأسئلته | الامتحانات | نعم |
| `exams.publish` | نشر / إلغاء نشر امتحان | الامتحانات | نعم |
| `exams.delete` | حذف امتحان | الامتحانات | نعم |
| `subjects.manage` | إدارة المواد الدراسية | الهيكل | نعم |
| `content_types.manage` | إدارة أنواع المحتوى | الهيكل | لا |
| `weeks.manage` | إدارة الأسابيع | الهيكل | لا |
| `reports.view` | عرض البلاغات | التشغيل | نعم |
| `reports.manage` | معالجة/إغلاق البلاغات | التشغيل | نعم |
| `ads.manage` | إدارة الإعلانات | التشغيل | لا |
| `notifications.manage` | إدارة الإشعارات ودفع Push | التشغيل | لا |
| `settings.manage` | إعدادات النظام والذكاء الاصطناعي | النظام | لا |
| `analytics.view` | عرض الإحصائيات | النظام | لا |
| `staff.manage` | إدارة الفريق وصلاحياتهم | النظام | لا (عام فقط) |

### القوالب الافتراضية (Presets)

| الرتبة | الصلاحيات الافتراضية |
|---|---|
| `super_admin` | **تجاوز كل الفحوصات** (`private.is_super_admin()` ترجع `true` فورًا) |
| `admin` | كل المحتوى + الامتحانات + الهيكل + البلاغات + الإعلانات + الإشعارات + الإحصائيات — **بلا** `settings.manage` و`staff.manage` |
| `editor` | `dashboard.access`, `resources.view/create/update`, `exams.view/create/update`, `reports.view`, `analytics.view` — **بلا** نشر، بلا حذف، بلا إدارة هيكل |

> ملاحظة: القوالب تُخزَّن في جدول، لذا يمكن لـ`super_admin` تعديل صلاحيات رتبة `editor` كاملة من الواجهة
> دون أي ترحيل جديد، مع بقاء القوالب الكاسحة (`super_admin`) مثبّتة في الكود لتفادي قفل النظام عن نفسه.

---

## 6. الترحيل الكامل (Migration)

> **ملف مقترح**: `supabase/migrations/20260920000000_scoped_admin_roles.sql`
> مُقسَّم إلى 7 أجزاء. الجزء 6.3 (الدوال) و6.5 (الـTriggers) هما جوهر الحماية، والبقية بنية مساندة.
> الترحيل **إضافي غير كاسر**: لا يحذف بيانات، ويُبقي `is_admin()` تعمل، فالمخاطرة منخفضة.

<!-- BEGIN MIGRATION SQL -->
```sql
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
```
```sql
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
```
```sql
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
```
```sql
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
```
```sql
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
```
```sql
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
```
```sql
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
```
```sql
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
```
```sql
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
```
```sql
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
```
```sql
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
```
```sql
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
```
<!-- END MIGRATION SQL -->
---

## 7. تكامل لوحة الأدمن (apps/admin)

الواجهة طبقة **تجربة استخدام** فقط: تُخفي ما لا يُسمح به، ولا تُعتبر خط دفاع. كل تحقق هنا مُنعكس في
قاعدة البيانات، فإن تجاوزه المستخدم يدويًا فالـRLS سترفضه.

### 7.1 إضافات ملف الأنواع `packages/types/src/database.ts`

```ts
// 1) توسيع نوع الأدمن
export type AdminRole = 'super_admin' | 'admin' | 'editor';

export type AdminUser = {
  id: string;
  email: string;
  role: AdminRole;
  is_active: boolean;        // جديد
  created_at: string;
  updated_at: string;        // جديد
};

// 2) أنواع جديدة
export type PermissionEffect = 'allow' | 'deny';
export type PermissionScopeType = 'global' | 'subject' | 'content_type' | 'week' | 'resource' | 'exam';

export type Permission = {
  key: string;
  label_ar: string;
  category: 'general' | 'content' | 'exams' | 'structure' | 'operations' | 'system';
  supports_scope: boolean;
  order_index: number;
};

export type AdminRolePreset = { role: 'admin' | 'editor'; permission_key: string; created_at: string };

export type AdminPermission = {
  id: string;
  admin_id: string;
  permission_key: string;
  effect: PermissionEffect;
  scope_type: PermissionScopeType;
  scope_id: string | null;
  expires_at: string | null;
  granted_by: string | null;
  created_at: string;
};

export type AdminActivityLog = {
  id: number;
  admin_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
};

export type MyPermissions = {
  admin_id: string | null;
  email: string | null;
  role: AdminRole | null;
  is_active: boolean;
  is_super_admin: boolean;
  is_staff: boolean;
  global: string[];
  scoped: { key: string; scope_type: PermissionScopeType; scope_id: string | null }[];
  denied: string[];
  scoped_subject_ids: string[];
};
```

وداخل `interface Database` أضف الجداول والدوال:

```ts
// في public.Tables أضف:
permissions:        { Row: Permission;        Insert: Omit<Permission, never>;        Update: Partial<Permission> };
admin_role_presets: { Row: AdminRolePreset;   Insert: Omit<AdminRolePreset, 'created_at'> & { created_at?: string }; Update: Partial<AdminRolePreset> };
admin_permissions:  { Row: AdminPermission;   Insert: Omit<AdminPermission, 'id' | 'created_at' | 'granted_by'> & { id?: string; granted_by?: string | null }; Update: Partial<AdminPermission> };
admin_activity_log: { Row: AdminActivityLog;  Insert: Omit<AdminActivityLog, 'id' | 'created_at'> & { id?: number }; Update: never };

// في public.Functions أضف:
get_my_permissions:  { Args: Record<string, never>; Returns: MyPermissions };
set_staff_permissions: {
  Args: { p_admin_id: string; p_entries: {
    key: string;
    effect?: PermissionEffect;
    scope_type?: PermissionScopeType;
    scope_id?: string | null;
    expires_at?: string | null;
  }[] };
  Returns: number;
};
list_staff_reports:  { Args: Record<string, never>; Returns: {
    id: string; resource_id: string; issue_type: ReportIssueType; details: string | null;
    status: ReportStatus; created_at: string; resolved_at: string | null;
    resource_title: string; subject_id: string | null; subject_name: string | null;
}[] };
```
### 7.2 ملف جديد: `apps/admin/src/lib/permissions.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { MyPermissions, PermissionScopeType } from '@thanaya/types';

export const EMPTY_PERMISSIONS: MyPermissions = {
  admin_id: null,
  email: null,
  role: null,
  is_active: false,
  is_super_admin: false,
  is_staff: false,
  global: [],
  scoped: [],
  denied: [],
  scoped_subject_ids: [],
};

export async function fetchMyPermissions(): Promise<MyPermissions> {
  const { data, error } = await supabase.rpc('get_my_permissions');
  if (error) throw error;
  return (data as MyPermissions) ?? EMPTY_PERMISSIONS;
}

/**
 * مصدر الحقيقة للصلاحيات في الواجهة.
 * لا نضع الصلاحيات في الـJWT: تُقرأ من الدالة عند كل تغيير، فيسري السحب/المنح فورًا.
 */
export function usePermissions() {
  const query = useQuery({
    queryKey: ['my_permissions'],
    queryFn: fetchMyPermissions,
    staleTime: 30_000,
    retry: 1,
  });

  const permissions = query.data ?? EMPTY_PERMISSIONS;

  /** يملك المفتاح بأي نطاق (عام أو محدود) */
  const can = (key: string): boolean =>
    permissions.is_super_admin ||
    permissions.global.includes(key) ||
    permissions.scoped.some((s) => s.key === key);

  /** يملك المفتاح على مستوى النظام كله */
  const canGlobal = (key: string): boolean =>
    permissions.is_super_admin || permissions.global.includes(key);

  /** مواد محددة يملك عليها المفتاح (تُستخدم لتصفية القوائم وتقييد الاختيار) */
  const scopedSubjects = (key: string): string[] =>
    permissions.scoped
      .filter((s) => s.key === key && s.scope_type === 'subject' && s.scope_id)
      .map((s) => s.scope_id as string);

  /** موارد محددة بالمعرّف */
  const scopedResources = (key: string): string[] =>
    permissions.scoped
      .filter((s) => s.key === key && s.scope_type === 'resource' && s.scope_id)
      .map((s) => s.scope_id as string);

  const isDenied = (key: string): boolean => permissions.denied.includes(key);

  /** هل النطاق مقيّد؟ (لو كانت السطور أعلاه غير فارغة فالموظف محدود) */
  const isScoped = (key: string): boolean =>
    !canGlobal(key) && permissions.scoped.some((s) => s.key === key);

  return {
    permissions,
    isLoading: query.isLoading,
    isError: query.isError,
    can,
    canGlobal,
    scopedSubjects,
    scopedResources,
    isDenied,
    isScoped,
    refresh: query.refetch,
  };
}

export const SCOPE_LABELS: Record<PermissionScopeType, string> = {
  global: 'كل النظام',
  subject: 'مادة دراسية',
  content_type: 'نوع محتوى',
  week: 'أسبوع',
  resource: 'مورد محدد',
  exam: 'امتحان محدد',
};
```
### 7.3 حراسة الدخول: مستخدم مسجَّل بلا صف في `admins` لا يدخل

في `AuthLogin.tsx` بعد نجاح `signInWithPassword`:

```ts
const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) throw authError;

// تحقق أن الحساب ضمن الطاقم وأنه مُفعَّل (RLS ستحجب كل شيء على أي حال،
// لكن هذه رسالة واضحة تمنع تجربة «لوحة فارغة»)
const { data: perms, error: permError } = await supabase.rpc('get_my_permissions');
if (permError) throw permError;
if (!perms || !perms.is_staff) {
  await supabase.auth.signOut();
  throw new Error('هذا الحساب غير مصرح له بالدخول إلى لوحة التحكم.');
}
onSuccess();
```

وإن كان `is_active = false` فالصف موجود لكن `private.is_staff()` ترجع `false` تلقائيًا، فتُرفض الجلسة
بنفس الرسالة — أي أن **تعطيل الموظف يسحب وصوله فورًا دون حذف حسابه**.

### 7.4 في `App.tsx`: توليد القائمة من الصلاحيات

```tsx
import { ShieldCheck } from 'lucide-react';
import { usePermissions } from './lib/permissions';
import { StaffManager } from './components/StaffManager';

export function App() {
  // ... الحالات الحالية كما هي
  const { permissions, can, isLoading: permsLoading } = usePermissions();

  const navigation = [
    { id: 'resources',     name: 'الموارد والمحتوى',        icon: FileText,    perm: 'resources.view' },
    { id: 'exams',         name: 'الامتحانات التجريبية (MCQ)', icon: HelpCircle,  perm: 'exams.view' },
    { id: 'notifications', name: 'الإشعارات والتنبيهات',      icon: Bell,        perm: 'notifications.manage' },
    { id: 'ai_settings',   name: 'إعدادات الذكاء الاصطناعي (AI)', icon: Sparkles, perm: 'settings.manage' },
    { id: 'subjects',      name: 'المواد الدراسية',          icon: BookOpen,    perm: 'subjects.manage' },
    { id: 'content_types', name: 'أنواع المحتوى',            icon: Layers,      perm: 'content_types.manage' },
    { id: 'weeks',         name: 'الأسابيع',                icon: Calendar,    perm: 'weeks.manage' },
    { id: 'reports',       name: 'البلاغات',                icon: Flag,        perm: 'reports.view' },
    { id: 'ads',           name: 'الإعلانات',               icon: Megaphone,   perm: 'ads.manage' },
    { id: 'analytics',     name: 'الإحصائيات والتقارير',      icon: BarChart3,   perm: 'analytics.view' },
    { id: 'staff',         name: 'الفريق والصلاحيات',        icon: ShieldCheck, perm: 'staff.manage' },
  ];
  const visibleNav = navigation.filter((n) => can(n.perm));

  // لو الحساب مُفعَّل لكن بلا أي صلاحية دخول
  if (!permsLoading && !permissions.is_staff) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900 text-slate-300 p-6">
        <ShieldCheck className="w-10 h-10 text-rose-400" />
        <p className="text-sm">حسابك غير مصرح له بالوصول، أو تم تعطيله. تواصل مع المدير العام.</p>
        <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-slate-800 text-sm">تسجيل الخروج</button>
      </div>
    );
  }

  // اضبط التبويب النشط على أول تبويب مسموح
  useEffect(() => {
    if (visibleNav.length > 0 && !visibleNav.some((n) => n.id === activeTab)) {
      setActiveTab(visibleNav[0].id);
    }
  }, [permissions.admin_id, visibleNav.length]);

  // ... بقية الدالة: استخدم visibleNav.map بدل navigation.map
}
```

**عرض الرتبة في الهيدر** (بدل «لوحة التحكم نشطة» فقط):

```tsx
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'مدير عام',
  admin: 'أدمن',
  editor: 'محرر محتوى',
};
// ...
<span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
  {ROLE_LABELS[permissions.role ?? ''] ?? 'مستخدم'} · {permissions.email}
</span>
```
### 7.5 إضافات `apps/admin/src/api/client.ts` (بنفس نمط الملف الحالي)

```ts
import type {
  Permission, AdminRolePreset, AdminPermission, AdminUser, AdminRole,
  MyPermissions, PermissionEffect, PermissionScopeType,
} from '@thanaya/types';

// داخل الكائن api الموجود:

  // --- STAFF & PERMISSIONS ---
  async getMyPermissions(): Promise<MyPermissions> {
    if (isConfigured) {
      const { data, error } = await supabase.rpc('get_my_permissions');
      if (error) throw error;
      return data as unknown as MyPermissions;
    }
    return { admin_id: null, email: null, role: null, is_active: false, is_super_admin: false,
             is_staff: false, global: [], scoped: [], denied: [], scoped_subject_ids: [] };
  },

  async getPermissionCatalog(): Promise<Permission[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('permissions').select('*').order('order_index');
      if (error) throw error;
      return (data as unknown as Permission[]) || [];
    }
    return [];
  },

  async getRolePresets(): Promise<AdminRolePreset[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('admin_role_presets').select('*');
      if (error) throw error;
      return (data as unknown as AdminRolePreset[]) || [];
    }
    return [];
  },

  async getStaff(): Promise<AdminUser[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('admins').select('*').order('created_at');
      if (error) throw error;
      return (data as unknown as AdminUser[]) || [];
    }
    return [];
  },

  /** كل المنح الظاهرة للمستخدم الحالي (المدير يرى الكل، والموظف يرى منحه) */
  async getStaffPermissions(): Promise<AdminPermission[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('admin_permissions').select('*').order('created_at');
      if (error) throw error;
      return (data as unknown as AdminPermission[]) || [];
    }
    return [];
  },

  async grantPermission(input: {
    admin_id: string;
    permission_key: string;
    effect?: PermissionEffect;
    scope_type?: PermissionScopeType;
    scope_id?: string | null;
    expires_at?: string | null;
  }): Promise<AdminPermission> {
    const { data, error } = await (supabase.from('admin_permissions') as any)
      .insert({
        effect: 'allow',
        scope_type: 'global',
        scope_id: null,
        ...input,
      })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as AdminPermission;
  },

  async revokePermission(id: string): Promise<void> {
    const { error } = await supabase.from('admin_permissions').delete().eq('id', id);
    if (error) throw error;
  },

  async updateStaffRole(id: string, role: AdminRole): Promise<void> {
    const { error } = await (supabase.from('admins') as any).update({ role }).eq('id', id);
    if (error) throw error;
  },

  async setStaffActive(id: string, is_active: boolean): Promise<void> {
    const { error } = await (supabase.from('admins') as any).update({ is_active }).eq('id', id);
    if (error) throw error;
  },

  /** البلاغات عبر RPC لأن الفلترة بالنطاق تحدث في القاعدة (يتفادى حجب العلاقات بـRLS) */
  async listStaffReports() {
    const { data, error } = await supabase.rpc('list_staff_reports');
    if (error) throw error;
    return data || [];
  },
```

> إن كانت الواجهة في وضع المعاينة بلا Supabase (المشروع يسمح بذلك عبر `isConfigured`)، أبقِ
> الدوال كما هي: `grantPermission` وغيرها ستُرجع خطأ الشبكة، وهو سلوك متسق مع بقية دوال الملف.
### 7.6 تبويب جديد: `apps/admin/src/components/StaffManager.tsx`

شاشة واحدة تجمع: قائمة الفريق، الرتبة، التفعيل، والحدود المخصّصة لكل موظف.

```tsx
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { PermissionEditor } from './PermissionEditor';
import type { AdminPermission, AdminUser, AdminRole } from '@thanaya/types';

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'مدير عام',
  admin: 'أدمن',
  editor: 'محرر محتوى',
};

export function StaffManager() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminRole>('editor');
  const [selectedStaff, setSelectedStaff] = useState<AdminUser | null>(null);

  const { data: staff = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => api.getStaff() });
  const { data: grants = [] } = useQuery({ queryKey: ['staff_permissions'], queryFn: () => api.getStaffPermissions() });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['staff_permissions'] });
    queryClient.invalidateQueries({ queryKey: ['my_permissions'] });
  };

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) => api.updateStaffRole(id, role),
    onSuccess: invalidate,
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => api.setStaffActive(id, is_active),
    onSuccess: invalidate,
  });

  const grantsByAdmin = useMemo(() => {
    const map = new Map<string, AdminPermission[]>();
    for (const g of grants) {
      const list = map.get(g.admin_id) ?? [];
      list.push(g);
      map.set(g.admin_id, list);
    }
    return map;
  }, [grants]);

  const sendInvite = async () => {
    // إنشاء الحساب يحتاج service_role، لذا يمر عبر Edge Function (القسم 8)
    const { data, error } = await supabase.functions.invoke('admin-invite', {
      body: { email: inviteEmail, role: inviteRole },
    });
    if (error) { alert(error.message); return; }
    alert((data as { message?: string })?.message ?? 'تم إرسال الدعوة');
    setInviteOpen(false);
    setInviteEmail('');
    invalidate();
  };
```
```tsx
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" /> الفريق والصلاحيات
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            الرتبة تحدّد الافتراضي، والحدود المخصّصة تحدّد ما يُسمح فعليًا
            (نطاق مادة/مورد/امتحان، أو منع صريح، أو صلاحية مؤقتة بتاريخ انتهاء).
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
        >
          <UserPlus className="w-4 h-4" /> إضافة موظف
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-right p-3">البريد</th>
              <th className="text-right p-3">الرتبة</th>
              <th className="text-right p-3">الحالة</th>
              <th className="text-right p-3">حدود مخصّصة</th>
              <th className="text-right p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td className="p-3 text-slate-500" colSpan={5}>جاري التحميل...</td></tr>
            )}
            {staff.map((member) => {
              const memberGrants = grantsByAdmin.get(member.id) ?? [];
              return (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium text-slate-700" dir="ltr">{member.email}</td>
                  <td className="p-3">
                    <select
                      value={member.role}
                      onChange={(e) => roleMutation.mutate({ id: member.id, role: e.target.value as AdminRole })}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
                    >
                      {(['super_admin', 'admin', 'editor'] as AdminRole[]).map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => activeMutation.mutate({ id: member.id, is_active: !member.is_active })}
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        member.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {member.is_active ? 'مُفعَّل' : 'مُعطَّل'}
                    </button>
                  </td>
                  <td className="p-3 text-xs text-slate-600">
                    {memberGrants.length === 0
                      ? '— القالب الافتراضي'
                      : `${memberGrants.length} سطر (منها ${memberGrants.filter((g) => g.effect === 'deny').length} منع)`}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setSelectedStaff(member)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
                    >
                      تعديل الحدود
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedStaff && (
        <PermissionEditor
          member={selectedStaff}
          grants={grantsByAdmin.get(selectedStaff.id) ?? []}
          onClose={() => setSelectedStaff(null)}
          onSaved={invalidate}
        />
      )}

      {inviteOpen && (
        <Modal title="إضافة موظف جديد" onClose={() => setInviteOpen(false)}>
          <div className="space-y-3">
            <input
              type="email" dir="ltr" value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="staff@thanaya.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AdminRole)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {(['editor', 'admin'] as AdminRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              onClick={sendInvite}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold"
            >
              إرسال الدعوة
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
```
```tsx
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from './Modal';
import { api } from '../api/client';
import { supabase } from '../lib/supabase';
import type { AdminPermission, AdminUser, Permission, PermissionScopeType } from '@thanaya/types';

type Mode = 'preset' | 'allow' | 'deny';
type Row = { mode: Mode; scope_type: PermissionScopeType; scope_id: string; expires_at: string };

interface Props {
  member: AdminUser;
  grants: AdminPermission[];
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORY_LABELS: Record<Permission['category'], string> = {
  general: 'عام', content: 'المحتوى', exams: 'الامتحانات',
  structure: 'هيكل المحتوى', operations: 'التشغيل', system: 'النظام',
};

export function PermissionEditor({ member, grants, onClose, onSaved }: Props) {
  const { data: catalog = [] } = useQuery({ queryKey: ['permission_catalog'], queryFn: () => api.getPermissionCatalog() });
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => api.getSubjects() });
  const { data: contentTypes = [] } = useQuery({ queryKey: ['content_types'], queryFn: () => api.getContentTypes() });
  const { data: weeks = [] } = useQuery({ queryKey: ['weeks'], queryFn: () => api.getWeeks() });
  const { data: resources = [] } = useQuery({ queryKey: ['resources'], queryFn: () => api.getResources() });
  const { data: exams = [] } = useQuery({ queryKey: ['exams'], queryFn: () => api.getExams() });

  // الحالة المحلية: صف واحد لكل مفتاح (preset = وراثة القالب، allow = منح، deny = منع)
  const [draft, setDraft] = useState<Record<string, Row>>(() => {
    const init: Record<string, Row> = {};
    for (const g of grants) {
      init[g.permission_key] = {
        mode: g.effect === 'deny' ? 'deny' : 'allow',
        scope_type: g.scope_type,
        scope_id: g.scope_id ?? '',
        expires_at: g.expires_at ? g.expires_at.slice(0, 10) : '',
      };
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of catalog) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return [...map.entries()];
  }, [catalog]);

  const rowsFor = (key: string): Row =>
    draft[key] ?? { mode: 'preset', scope_type: 'global', scope_id: '', expires_at: '' };

  const setRow = (key: string, patch: Partial<Row>) =>
    setDraft((prev) => ({ ...prev, [key]: { ...rowsFor(key), ...patch } }));

  const optionsFor = (scope: PermissionScopeType) => {
    switch (scope) {
      case 'subject':      return subjects.map((s) => ({ id: s.id, label: s.name }));
      case 'content_type': return contentTypes.map((c) => ({ id: c.id, label: c.name }));
      case 'week':         return weeks.map((w) => ({ id: w.id, label: w.title }));
      case 'resource':     return resources.map((r) => ({ id: r.id, label: r.title }));
      case 'exam':         return exams.map((e) => ({ id: e.id, label: e.title }));
      default:             return [];
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const entries = Object.entries(draft)
        .filter(([, row]) => row.mode !== 'preset')
        // نتجاهل سطر «منح» بلا نطاق محدد (ناقص الإعداد)
        .filter(([, row]) => row.mode === 'deny' || row.scope_type === 'global' || row.scope_id)
        .map(([key, row]) => ({
          key,
          effect: row.mode === 'deny' ? ('deny' as const) : ('allow' as const),
          scope_type: row.mode === 'deny' ? ('global' as const) : row.scope_type,
          scope_id: row.mode === 'deny' || row.scope_type === 'global' ? null : row.scope_id,
          expires_at: row.expires_at ? new Date(`${row.expires_at}T23:59:59`).toISOString() : null,
        }));

      const { error: rpcError } = await supabase.rpc('set_staff_permissions', {
        p_admin_id: member.id,
        p_entries: entries,
      });
      if (rpcError) throw rpcError;
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'فشل حفظ الصلاحيات');
    } finally {
      setSaving(false);
    }
  };
```
```tsx
  return (
    <Modal title={`حدود: ${member.email}`} onClose={onClose}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">{error}</div>
        )}

        <p className="text-xs text-slate-500 leading-relaxed">
          «القالب» = يتبع صلاحيات الرتبة تلقائيًا. «منح» = صلاحية صريحة (يمكن تحديد نطاقها وتاريخ انتهائها).
          «منع» = إلغاء الصلاحية حتى لو منحها القالب. وجود أي سطر صريح لمفتاح ما يُلغي قالب الرتبة لهذا المفتاح.
        </p>

        {grouped.map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500">
              {CATEGORY_LABELS[category as Permission['category']] ?? category}
            </h4>
            {items.map((perm) => {
              const row = rowsFor(perm.key);
              const options = perm.supports_scope ? optionsFor(row.scope_type) : [];
              return (
                <div key={perm.key} className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-700">{perm.label_ar}</span>
                    <div className="flex items-center gap-1">
                      {(['preset', 'allow', 'deny'] as Mode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setRow(perm.key, { mode })}
                          className={`text-[11px] px-2 py-1 rounded-md border transition ${
                            row.mode === mode
                              ? mode === 'deny'
                                ? 'bg-rose-600 text-white border-rose-600'
                                : mode === 'allow'
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-slate-700 text-white border-slate-700'
                              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {mode === 'preset' ? 'إلغاء التخصيص' : mode === 'allow' ? 'منح' : 'منع'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {row.mode === 'allow' && perm.supports_scope && (
                    <div className="grid sm:grid-cols-3 gap-2">
                      <select
                        value={row.scope_type}
                        onChange={(e) => setRow(perm.key, {
                          scope_type: e.target.value as PermissionScopeType,
                          scope_id: '',
                        })}
                        className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                      >
                        <option value="global">كل النظام</option>
                        <option value="subject">مادة دراسية محددة</option>
                        <option value="content_type">نوع محتوى محدد</option>
                        <option value="week">أسبوع محدد</option>
                        <option value="resource">مورد محدد</option>
                        <option value="exam">امتحان محدد</option>
                      </select>

                      {row.scope_type !== 'global' && (
                        <select
                          value={row.scope_id}
                          onChange={(e) => setRow(perm.key, { scope_id: e.target.value })}
                          className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                        >
                          <option value="">— اختر —</option>
                          {options.map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                      )}

                      <input
                        type="date"
                        value={row.expires_at}
                        onChange={(e) => setRow(perm.key, { expires_at: e.target.value })}
                        title="تاريخ انتهاء الصلاحية (اتركه فارغًا للدوام)"
                        className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                      />
                    </div>
                  )}

                  {row.mode === 'deny' && (
                    <p className="text-[11px] text-rose-600">
                      المنع يلغي كل سطور المنح لهذا المفتاح (والقالب معها)، ويمكن تحديد تاريخ انتهاء له.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="flex items-center gap-2 sticky bottom-0 bg-white pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ الحدود'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

> ملاحظتان تنفيذيتان:
> 1. `set_staff_permissions` تحذف كل سطور الموظف ثم تكتب الجديدة في **معاملة واحدة**، فلا تنتهي العملية
>    بحالة جزئية إن فشل أحد الصفوف (وهذا سبب تفضيلها على استدعاءات حذف/إضافة متسلسلة من المتصفح).
> 2. `supabase.rpc` تصبح مُهيّأة الأنواع بعد تحديث `Database.Functions` كما في 7.1.
### 7.7 تعديل المكوّنات الحالية (إخفاء ما لا يُسمح)

**`ResourcesManager.tsx`**

```tsx
const { can, isScoped, scopedSubjects } = usePermissions();

// زر النشر: يحتاج resources.publish (بأي نطاق)
{can('resources.publish') && (
  <button onClick={() => togglePublish(res)} title="نشر / إلغاء نشر">
    {res.is_published ? <EyeOff className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
  </button>
)}

// زر الحذف: يحتاج resources.delete
{can('resources.delete') && (
  <button onClick={() => { if (confirm('تأكيد حذف المورد؟')) deleteMutation.mutate(res.id); }}>
    <Trash2 className="w-4 h-4" />
  </button>
)}

// زر الإنشاء: يحتاج resources.create
{can('resources.create') && (
  <button onClick={openCreateView}><Plus className="w-4 h-4" /> إضافة مورد</button>
)}
```
> القاعدة العملية: **لا تُخفِ زر «تعديل» إلا لمن لا يملك `resources.update` بأي نطاق**، واترك RLS ترفض
> الحالات الشاذة (مثل مورد خرج من النطاق بين فتح الصفحة والحفظ).

**`ContentCreator.tsx`**

```tsx
const { can, isScoped, scopedSubjects } = usePermissions();
const canPublish = can('resources.publish');

// مفتاح النشر: يظهر معطّلًا مع رسالة توضيحية لمن لا يملكه
<input type="checkbox" checked={isPublished} disabled={!canPublish}
       onChange={(e) => setIsPublished(e.target.checked)} />
{!canPublish && (
  <p className="text-[11px] text-amber-600">
    لا تملك صلاحية النشر — سيُحفظ المحتوى كمسودة وتُراجعه الإدارة.
  </p>
)}

// تقييد اختيار المادة عند النطاق المحدود
const allowedSubjectIds = scopedSubjects('resources.create'); // أو resources.update
<select
  value={subjectId}
  disabled={allowedSubjectIds.length > 0}
  onChange={(e) => setSubjectId(e.target.value)}
>
  {subjects
    .filter((s) => allowedSubjectIds.length === 0 || allowedSubjectIds.includes(s.id))
    .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
</select>
```
وإن كانت المادة مثبتة بالنطاق فاجعل `subjectId` يُهيّأ تلقائيًا على أول مادة مسموحة
(بدل `subjects[0].id` الحالي في `useEffect` في السطر 43-48)، وإلا فقد يحاول المستخدم الحفظ في مادة غير مسموحة.

**`ReportsManager.tsx`** يستخدم الدالة المجمّعة بدل الاستعلام المدمج:

```tsx
const { data: reports = [] } = useQuery({
  queryKey: ['staff_reports'],
  queryFn: () => api.listStaffReports(),
});
// الصفوف تحتوي resource_title و subject_name جاهزين، والفلترة بالنطاق جرت داخل القاعدة.
```
السبب: الاستعلام الحالي `reports?select=*,resource:resources(*)` يعتمد على RLS على `resources`؛ ولموظف
محدود النطاق قد تُحجب علاقة المورد فيُسقط PostgREST الصف من النتيجة كلها، فيرى «لا توجد بلاغات» رغم وجودها
داخل نطاقه. الدالة تتفادى ذلك نهائيًا.

**`App.tsx`**: `<StaffManager />` تُضاف للتبويب `staff` (وتظهر فقط لمن يملك `staff.manage`).

### 7.8 ملخص سلوك الواجهة المتوقع بعد التنفيذ

| الحساب | التبويبات الظاهرة | القدرات الفعلية |
|---|---|---|
| `super_admin` | الكل | كل شيء بلا قيود |
| `admin` | الكل عدا «الفريق والصلاحيات» وإعدادات AI | نشر/حذف/إدارة هيكل، وتحجب عنه الإعدادات وإدارة الفريق |
| `editor` (قالب) | الموارد، الامتحانات، البلاغات، الإحصائيات | إنشاء وتعديل بلا نشر وبلا حذف |
| `editor` + منح `resources.update` على مادة الفيزياء فقط | كما فوق، لكن قائمة المواد محصورة | تعديل/إنشاء في الفيزياء فقط، ومسودات بقية المواد غير مرئية |
| `editor` + منح على **مورد واحد** | كما فوق | تعديل ذلك المورد فقط |
| `editor` + منع `resources.view` | الموارد (بلا مسودات) | يرى المنشور كما يراه الطالب |
---

## 8. إضافة موظف جديد (Edge Function بمفتاح service_role)

إنشاء حساب Auth **لا يمكن** من المتصفح: يتطلب `service_role`، وهذا المفتاح **يُمنع تمامًا** في أي تطبيق
واجهة (المشروع ينص على ذلك في `DEPLOYMENT.md:123`). الحل: دالة Edge تتحقق من صلاحية المستدعي ثم تنشئ الحساب.

```ts
// supabase/functions/admin-invite/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const authHeader = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // (1) عميل بجلسة المستدعي: يخضع لـRLS وللصلاحيات الفعلية
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return json({ error: 'غير مصادق' }, 401);

  // (2) الحكم النهائي من قاعدة البيانات (لا نثق بأي شيء من العميل)
  const { data: perms } = await caller.rpc('get_my_permissions');
  if (!perms?.global?.includes('staff.manage')) {
    return json({ error: 'غير مصرح بإدارة الفريق' }, 403);
  }

  const { email, role } = await req.json();
  if (!email || !['admin', 'editor'].includes(role)) {
    return json({ error: 'بيانات غير صالحة' }, 400);
  }

  // (3) التنفيذ بمفتاح service_role (يبقى في أسرار الدالة فقط)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: Deno.env.get('ADMIN_INVITE_REDIRECT') ?? undefined,
  });
  if (inviteError) return json({ error: inviteError.message }, 400);

  const { error: insertError } = await admin.from('admins').insert({
    id: invited.user!.id,
    email,
    role,
    is_active: true,
  });
  if (insertError) return json({ error: insertError.message }, 500);

  return json({ message: `تم إرسال الدعوة إلى ${email}` }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
```

**النشر والأسرار**

```bash
supabase functions deploy admin-invite
supabase secrets set ADMIN_INVITE_REDIRECT=https://admin.thanaya.dpd.org
# SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY مُتاحة تلقائيًا للدوال
```

**بدائل وأحكام:**
- بديل بدون بريد: `admin.auth.admin.createUser({ email, password, email_confirm: true })` — مناسب إذا
  أردت تسليم كلمة المرور يدويًا.
- بديل بدون Edge Functions: إنشاء المستخدم من `Authentication → Users` في لوحة Supabase ثم:
  ```sql
  INSERT INTO public.admins (id, email, role, is_active)
  VALUES ('USER-UID', 'staff@thanaya.com', 'editor', true);
  ```
  ثم من تبويب «الفريق والصلاحيات» امنحه الحدود. **هذا المسار لا يحتاج أي نشر إضافي**، وهو الأنسب للفريق
  الصغير في البداية.
- ⚠️ لاحظ أن `DEPLOYMENT.md:48` يذكر عمود `is_active` في `INSERT` لكنه لم يكن موجودًا قبل هذا الترحيل؛
  الترحيل يضيفه فلا يبقى الأمر مكسورًا.
---

## 9. التحقق الفعلي (ما جُرِّب فعلًا وليس افتراضًا)

لم يُسلَّم أي SQL في هذه الخطة قبل تشغيله على **PostgreSQL 16 حقيقي** ببيئة تحاكي Supabase
(أدوار `anon`/`authenticated`/`service_role` + `auth.uid()`)، بعد تطبيق ترحيلات المشروع الخمسة.

### 9.1 كيف يُعاد التحقق

```bash
# 1) قاعدة اختبار مؤقتة
createdb -h 127.0.0.1 or psql -c 'CREATE DATABASE thanaya_test'

# 2) تشغيل كل شيء
./supabase/tests/rbac/run.sh "postgresql://postgres:postgres@127.0.0.1:5432/thanaya_test"
```

الملفات في `supabase/tests/rbac/` (جديدة في هذا المقترح):

| الملف | المحتوى |
|---|---|
| `00_bootstrap.sql` | محاكاة بيئة Supabase (أدوار + `auth.users` + `auth.uid()`) |
| `01_fixtures.sql` | بيانات الاختبار + المنح المقيّدة |
| `02_editor_scoped.sql` | 13 تحقّقًا للمحرر المحدود |
| `03_admin_preset_and_public.sql` | 11 تحقّقًا للقالب/المدير العام/الزائر |
| `04_grants_integrity.sql` | 13 تحقّقًا لسلامة المنح والحالات الحدّية |
| `05_deny_and_single_resource.sql` | 5 تحقّقات للمنع وللنطاق على مورد واحد |
| `run.sh` | يربطها كلها بأمر واحد |

### 9.2 النتائج الفعلية

```
▶ 1/3 تهيئة بيئة Supabase (أدوار + auth.uid)
▶ 2/3 تشغيل الترحيلات (6 ملفات)
▶ 3/3 سيناريوهات الصلاحيات
✅ نجحت كل السيناريوهات (لا FAIL)        → 42 تحقّقًا PASS / صفر فشل
```

**قابلية إعادة التشغيل**: الترحيل شُغِّل 3 مرات متتالية على نفس القاعدة بنجاح (لا `duplicate policy`
ولا `duplicate constraint`) لأن قسم 6.4 يهدم السياسات ثم يعيد بناءها وقسم 6.7 يستخدم `IF NOT EXISTS`.

**تدقيق أمني بعد الترحيل** (استعلامات تحقق مباشرة):

| الفحص | النتيجة |
|---|---|
| جداول في `public` بلا RLS | 0 |
| صلاحيات كتابة لـ`anon` | 3 فقط: `reports INSERT`, `push_subscriptions INSERT/DELETE` (مقصودة) |
| دوال `private.*` قابلة للتنفيذ من `anon` | 0 |
| سياسات ما زالت تعتمد `is_admin()` | 0 (كلها انتقلت إلى `private.*` المقيّدة) |
| إجمالي السياسات | 61 سياسة على 17 جدولًا |

### 9.3 ثلاث علل حقيقية كشفتها الاختبارات (وأُصلحت في التصميم)

هذه أهم مخرجات التحقق — كل واحدة لو بقيت لكانت ثغرة أو وظيفة مكسورة:

1. **انتهاء صلاحية مؤقتة كان يوسّع الوصول** — كانت المنحة المنتهية تُلغى فتسقط لقالب الرتبة
   (نطاق عام). الإصلاح: أي صف صريح لمفتاح ما (حتى المنتهي) يُلغي القالب، فلن يتوسّع الوصول أبدًا.
   *اختبار `X1` + `D2`.*
2. **`WITH CHECK` في سياسة التعديل منع المنح على مورد واحد** — كان الشرط يطلب نطاق «مادة»، فمن يملك
   `resources.update` على مورد واحد كان يُرفض تعديله. الإصلاح: الشرط صار على الصف نفسه،
   ومنع النقل بين المواد تتكفّل به `enforce_resource_column_rules`.
   *اختبار `E1`.*
3. **`get_my_permissions` كان يعرض الصفوف الخام** (فتبدو الصلاحية الممنوعة موجودة). الإصلاح: تُحسب
   الصلاحيات الفعلية عبر `permission_scopes` + إضافة قائمة `denied` الصريحة.
   *اختبار `D4`.*

> وملاحظتان تشغيليتان: (أ) فحوص «منع التصعيد» استُثنيت منها عمليات الخادم (`service_role` / SQL Editor)
> وإلا تعذّر تهيئة المنح يدويًا، و(ب) `anon` كان يملك منح كتابة على مستوى الجدول من افتراضيات Supabase
> (RLS وحدها كانت تمنعها)، فصار المنع على طبقتين.
---

## 10. خطة التنفيذ المرحلية

### المرحلة 0 — تحضير (١٥ دقيقة)

- [ ] **نسخة احتياطية أولًا** (Supabase → Database → Backups، أو PITR إن كان مفعّلًا). الرجوع الآلي غير
      متاح بعد إعادة بناء السياسات، فالنسخة هي شبكة الأمان.
- [ ] التأكد أن الترحيل الجديد هو **آخر ملف** في `supabase/migrations/` (لأنه يعيد بناء السياسات تحديديًا).
- [ ] تشغيل مجموعة الاختبارات على قاعدة نظيفة محليًا:
      `./supabase/tests/rbac/run.sh "$DATABASE_URL"` → المتوقع: 42 PASS.

### المرحلة 1 — قاعدة البيانات (٣٠ دقيقة)

- [ ] تنفيذ `supabase/migrations/20260920000000_scoped_admin_roles.sql` (SQL Editor أو `supabase db push`).
- [ ] **راجع الحسابات الحالية**: الافتراضي لرتبة `admin` لا يشمل `settings.manage` ولا `staff.manage`،
      فإن كان أحدٌ يستخدم «إعدادات الذكاء الاصطناعي» أو إدارة الأدمن سابقًا، فأحد الحلين:
      ```sql
      -- الحساب/الحسابات المالكة:
      UPDATE public.admins SET role = 'super_admin' WHERE email = 'owner@thanaya.com';

      -- أو منح صلاحية محددة بدل ترقية الرتبة:
      INSERT INTO public.admin_permissions (admin_id, permission_key, scope_type)
      SELECT id, 'settings.manage', 'global' FROM public.admins WHERE email = 'ops@thanaya.com';
      ```
- [ ] تحقق سريع بعد التنفيذ:
      ```sql
      SELECT count(*) FROM public.permissions;                 -- 22
      SELECT role, count(*) FROM public.admin_role_presets GROUP BY 1;  -- admin 20 / editor 9
      ```
      ومن لوحة الأدمن: `get_my_permissions()` تُرجع `is_staff = true` و`role` صحيحًا.

### المرحلة 2 — الواجهة (٢–٣ ساعات)

- [ ] `packages/types/src/database.ts` (القسم 7.1) — الأنواع + `Functions`.
- [ ] `apps/admin/src/lib/permissions.ts` (جديد، القسم 7.2).
- [ ] `apps/admin/src/components/StaffManager.tsx` + `PermissionEditor.tsx` (جديدان، القسم 7.6).
- [ ] `apps/admin/src/api/client.ts` — دوال الفريق والصلاحيات (القسم 7.5).
- [ ] `App.tsx` — قائمة ديناميكية + تبويب الفريق + شارة الرتبة (القسم 7.4).
- [ ] `AuthLogin.tsx` — رفض غير الطاقم (القسم 7.3).
- [ ] إخفاء أزرار النشر/الحذف/الإنشاء (القسم 7.7).
- [ ] `ReportsManager.tsx` يستخدم `list_staff_reports` (القسم 7.7).
- [ ] `npm --workspace=apps/admin run typecheck` ثم تجربة يدوية بحسابين: `admin` و`editor`.

### المرحلة 3 — إضافة الموظفين (٣٠ دقيقة، اختيارية)

- [ ] إما المسار اليدوي في Supabase (لا نشر إضافي)، أو نشر دالة `admin-invite` (القسم 8).
- [ ] تجربة: دعوة حساب `editor` → تسجيل دخول → التأكد أن التبويبات الممنوعة لا تظهر، وأن نداءً مباشرًا
      لـSupabase REST من نفس الجلسة **يُرفض** (هذا هو الاختبار الحقيقي).

### المرحلة 4 — تحسينات لاحقة (اختيارية)

- [ ] سجل النشاط: تفعيل كتابة `admin_activity_log` من الـTriggers + شاشة «آخر التعديلات» لمدير الفريق.
- [ ] إشعار بريدي لمدير الفريق عند أي تعديل من موظف محدود.
- [ ] تصدير دوري لجدول `admin_permissions` للمراجعة (تدقيق).

### معايير القبول (Definition of Done)

1. حساب `editor` لا يستطيع — بأي طريق — نشر أو حذف مورد، لا من الواجهة ولا بـ`supabase-js` ولا بـ`curl` على REST.
2. حساب `editor` مقيّد بمادة الفيزياء لا يرى مسودات بقية المواد ولا يعدّلها.
3. حساب لا يملك `settings.manage` لا يقرأ `system_settings` إطلاقًا (اختبار: `select * from system_settings` → 0 صفوف).
4. سحب أي صلاحية يسري **فورًا** بلا إعادة تسجيل دخول.
5. مجموعة `supabase/tests/rbac` تمر كاملة (42 PASS) بعد أي تعديل مستقبلي.
6. الطلاب لا يتأثرون: نفس المحتوى المنشور، ونفس الصفحات، ونفس الأداء.

### الرجوع (Rollback)

| السيناريو | الإجراء |
|---|---|
| فشل بعد الترحيل مباشرة | استعادة النسخة الاحتياطية/PITR (الأسرع والأضمن) |
| الرغبة في الاحتفاظ بالبيانات وإرجاع السلوك القديم فقط | تنفيذ سكربت مضاد يهدم السياسات الجديدة ويعيد سياسات `is_admin()` القديمة (نصوصها موجودة في `20260910000000` و`20260910000001` و`20260914000000/1`) |
| تعطيل موظف مؤقتًا | `UPDATE public.admins SET is_active = false WHERE email = '...'` — يسحب الوصول فورًا بلا أي ترحيل |
| إيقاف كل الحدود بلا رجوع ترحيل | منح كل الحسابات `role = 'super_admin'` مؤقتًا |
---

## 11. مخاطر وملاحظات مجاورة (اكتُشفت أثناء التحليل)

### 11.1 نقاط تحتاج معالجة مصاحبة (مهمة)

1. **🔴 `apps/web/src/pages/api/push-send.ts` غير محميّ أصلًا** — يقبل `POST` من أي جهة
   (`Access-Control-Allow-Origin: *`) بلا مصادقة، ويستخدم مفتاح `anon` لقراءة كل المشتركين وإرسال Push
   لهم. أي شخص يعرف رابط الموقع يستطيع بثّ إشعار لكل الطلاب. والأهم: **بعد هذا الترحيل سيتوقف هذا
   المسار عن العمل أصلًا** لأن `push_subscriptions` صارت مقروءة فقط لمن يملك `notifications.manage`.
   المعالجة الصحيحة:
   - استخدام `service_role` داخل الخادم فقط (لا يُسلَّم للمتصفح)،
   - سرّ مشترك في هيدر (`x-admin-secret`) يتحقق منه المسار،
   - تقييد `Access-Control-Allow-Origin` بنطاق لوحة الأدمن.
2. **🟠 الإبلاغ مفتوح للعموم** — `reports` لديها `WITH CHECK (true)` مع منح `INSERT` لـ`anon`، أي سبام
   ممكن. RLS لا تصلح لهذا الغرض؛ الحل على مستوى الـAPI: Rate limiting (مثلاً حدّ لكل IP/ساعة) أو CAPTCHA.
   أبقيتُها كما هي عمدًا لأن تضييقها يكسر تجربة «الإبلاغ بلا تسجيل دخول».
3. **🟡 ترتيب الترحيلات** — الترحيل الجديد يعيد بناء سياسات 17 جدولًا بشكل **تحديدي**؛ أي ترحيل مستقبلي
   يضيف سياسة على هذه الجداول يجب أن يأتي **بعده** (وإلا هدمه هو). الوثيقة تذكر الجداول صراحة في 6.4.

### 11.2 الأداء

- دوال الفحص `SECURITY DEFINER STABLE` تُستدعى مرة لكل صف في الاستعلام. الفهارس الحالية كافية:
  `idx_admin_permissions_admin(admin_id, permission_key)` للبحث، و`idx_resources_lookup(subject_id, content_type_id, is_published)`
  وغيرها للتحقق من النطاق.
- استُخدم `(select auth.uid())` بدل `auth.uid()` داخل كل الدوال والسياسات، وهو توصية Supabase لجعل
  المخطِّط يحسب القيمة مرة واحدة لكل استعلام (InitPlan) بدل مرة لكل صف.
- عند نمو المحتوى لآلاف الصفوف: تُنقل شروط النطاق إلى `JOIN` صريح على جدول فهرسة، أو تُغطّى بـ
  `security_invoker` views. لا حاجة لذلك اليوم.

### 11.3 حدود التصميم (حدود معروفة ومقصودة)

| الحد | التفصيل | التوسعة المحتملة |
|---|---|---|
| نطاق واحد لكل صف | منح «الفيزياء والكيمياء» = صفان لنفس المفتاح | مدعوم أصلًا (`uq_admin_permissions_scoped` يسمح بتعدد النطاقات) |
| لا وراثة هرمية | `subject` لا يشمل تلقائيًا مواضيع المادة | غير مطلوب حاليًا (لا جدول مواضيع) |
| `staff.manage` غير قابل للتفويض الجزئي | منع التصعيد مبني على «عام فقط» | جدول مجموعات `admin_groups` إن احتجت فرقًا |
| لا جدول أدوار مخصّص | الرتب الثلاث ثابتة، والتخصيص في المنح | جدول `admin_roles` قابل للإضافة لاحقًا |
| لا تسجيل نشاط تلقائي | جدول `admin_activity_log` جاهز لكن الكتابة اختيارية (المرحلة 4) | Triggers على كل جدول محتوى |

### 11.4 ملاحظات تشغيلية ونقاط انتباه

- **حذف موظف**: حذف صفّه من `admins` يسحب كل صلاحياته (CASCADE على منحه) لكن حساب Auth يبقى قادرًا على
  تسجيل الدخول ورؤية شاشة «غير مصرح». للحذف الكامل احذف مستخدم Auth أيضًا.
- **تعطيل فوري** بدل الحذف: `is_active = false` (يسحب الوصول فورًا ويمكن الرجوع عنه بضغطة).
- **`is_admin()` أُبقيت** بقيمتها القديمة «أي موظف مُفعَّل» لأي كود/ترحيل قديم، لكن **لا سياسة واحدة
  تعتمد عليها اليوم** (تحقق: 0 سياسة تستدعيها)، وأصبحت تحترم `is_active`.
- **لا صلاحيات في الـJWT**: لا `user_metadata` (قابلة للتعديل من المستخدم = ثغرة) ولا `app_metadata`
  (تتطلب تحديث التوكن). القراءة من القاعدة تعني أن أي تغيير يسري في الطلب التالي.
- **الحسابات القديمة**: راجع بند المرحلة 1 في القسم 10 قبل التنفيذ (رتبة `admin` تفقد إعدادات AI وإدارة الفريق).

---

## 12. الملفات المُنتَجة في هذه المرحلة

| الملف | الحالة | الوصف |
|---|---|---|
| `admin-permissions-plan.md` | **جديد** | هذه الوثيقة: التحليل + التصميم + الترحيل + الواجهة + الاختبارات |
| `supabase/migrations/20260920000000_scoped_admin_roles.sql` | **جديد (جاهز للتنفيذ، غير مُنفَّذ بعد)** | الترحيل الكامل (1095 سطرًا) — نفس النص المُختبر حرفيًا |
| `supabase/tests/rbac/00_bootstrap.sql` … `05_*.sql` | **جديد** | 42 تحقّقًا للصلاحيات على Postgres حقيقي |
| `supabase/tests/rbac/run.sh` | **جديد** | تشغيل الترحيلات + السيناريوهات بأمر واحد |
| `supabase/tests/rbac/README.md` | **جديد** | شرح المجموعة وطريقة التشغيل |

**لم يُعدَّل أي ملف كود قائم** (`apps/admin`, `apps/web`, `packages/types`) — التعديلات المطلوبة فيها
موصوفة بالكود الجاهز في القسم 7 لتنفيذها في المرحلة 2.

### الخطوة التالية المقترحة

1. تشغيل `./supabase/tests/rbac/run.sh` على قاعدة اختبار (تحقق فوري أن الوضع الحالي سليم).
2. تنفيذ الترحيل على الإنتاج (بعد نسخة احتياطية) + فحص بند الحسابات القديمة.
3. تنفيذ المرحلة 2 (الواجهة) — ويمكنني تولّيها بالكامل: تعديل الملفات الجديدة السبعة وتمرير `typecheck`.
4. معالجة البند 11.1/1 (`push-send`) لأنه ثغرة قائمة مستقلة عن هذه الميزة.


























