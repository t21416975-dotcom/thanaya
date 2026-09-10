# 🚀 دليل نشر وتشغيل منصة ثنايا (Deployment Guide)

دليل شامل لرفع وإطلاق منصة **ثنايا (Thanaya)** للإنتاج باستخدام **Supabase** و **Vercel** بأعلى أداء وأقل تكلفة تشغيل.

---

## 🏗️ هيكلية المشروع (Architecture Overview)

```mermaid
flowchart TD
    Students[👨‍🎓 الطلاب - Zero-JS Static UX] -->|زيارة وتحميل| VercelWeb[⚡ Vercel Edge CDN: apps/web (Astro 5 SSG)]
    AdminUsers[👨‍💼 الإدارة] -->|إدارة وتعديل| VercelAdmin[🛡️ Vercel App: apps/admin (React 19 + Vite)]
    
    VercelWeb -->|قراءة المحتوى وRPCs| SupabaseDB[(🗄️ Supabase PostgreSQL + RLS)]
    VercelAdmin -->|CRUD كامل + Auth| SupabaseDB
    
    VercelWeb -->|تحميل مباشر للملفات| DirectStorage[📦 Direct Storage (R2 / S3 / Supabase)]
    DirectStorage -.->|تجاوز استهلاك باندويث Vercel| Students
```

---

## 1️⃣ إعداد قاعدة البيانات (Supabase Setup)

### أ. إنشاء مشروع جديد
1. سجل دخول إلى [Supabase](https://supabase.com) وأنشئ مشروعًا جديدًا باسم `thanaya-prod`.
2. انسخ `Project URL` و `anon public key` من إعدادات المشروع (`Settings` -> `API`).

### ب. تنفيذ المخطط الأمني والجداول (Schema & RLS)
1. افتح **SQL Editor** في لوحة تحكم Supabase.
2. الصق محتوى ملف الهجرة:
   [`supabase/migrations/20260910000000_initial_schema.sql`](supabase/migrations/20260910000000_initial_schema.sql)
3. اضغط **RUN**. سينشئ هذا الإجراء:
   - الجداول: `subjects`, `content_types`, `weeks`, `resources`, `reports`, `ad_slots`, `direct_ads`, `admins`.
   - سياسات الأمان الصارمة (Row Level Security - RLS).
   - الدوال الآمنة (RPCs): `increment_resource_views`, `increment_resource_downloads`, `increment_ad_impressions`, `increment_ad_clicks`.

### ج. إدخال البيانات المبدئية للمنهج المصري (Seed Data)
1. في **SQL Editor**، الصق محتوى الملف:
   [`supabase/seed.sql`](supabase/seed.sql)
2. اضغط **RUN** لتعبئة المواد (عربي، لغات، كيمياء، فيزياء، رياضيات بحتة...) وأنواع المحتوى والأسابيع.

### د. إنشاء حساب المدير الأول (Admin User Setup)
1. اذهب إلى `Authentication` -> `Users` في Supabase واضغط **Add user** (أدخل البريد وكلمة المرور).
2. انسخ الـ `User UID`.
3. شغل الاستعلام التالي في **SQL Editor** لمنح الحساب صلاحيات الإدارة:
   ```sql
   INSERT INTO public.admins (id, email, role, is_active)
   VALUES ('USER-UID-HERE', 'admin@thanaya.com', 'super_admin', true);
   ```

---

## 2️⃣ إعداد وحدات التخزين للملفات (Direct PDF Storage)

لتفادي رسوم استهلاك الباندويث (Bandwidth) العالية على Vercel:
1. أنشئ Bucket في **Cloudflare R2** أو **Supabase Storage** أو **AWS S3** باسم `thanaya-pdfs` واجعله عامًا (Public).
2. عند رفع ملفات PDF للتقييمات، ضع رابط التحميل المباشر `file_url` في لوحة الإدارة.
3. يقوم زر التحميل في المنصة بتوجيه المتصفح لتنزيل الملف مباشرة من رابط التخزين عبر الـ CDN.

---

## 3️⃣ النشر على Vercel (Monorepo Deployment)

المستودع مبني كـ Monorepo يحتوي على تطبيقين منفصلين على Vercel:

### 🌐 المشروع الأول: موقع الطلاب (`apps/web`)
1. اضغط **Add New Project** في Vercel واختر مستودع `thanaya`.
2. حدد **Root Directory**: `apps/web`.
3. اختر **Framework Preset**: `Astro`.
4. إعدادات البناء:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. أضف متغيرات البيئة (Environment Variables):
   - `PUBLIC_SUPABASE_URL`: `https://<YOUR-PROJECT>.supabase.co`
   - `PUBLIC_SUPABASE_ANON_KEY`: `<YOUR-SUPABASE-ANON-KEY>`
   - `PUBLIC_SITE_URL`: `https://thanaya.com` (أو دومين Vercel)
6. اضغط **Deploy**.

### 🛡️ المشروع الثاني: لوحة الإدارة (`apps/admin`)
1. اضغط **Add New Project** مرة أخرى في Vercel لنفس المستودع.
2. حدد **Root Directory**: `apps/admin`.
3. اختر **Framework Preset**: `Vite`.
4. إعدادات البناء:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. أضف متغيرات البيئة (Environment Variables):
   - `VITE_SUPABASE_URL`: `https://<YOUR-PROJECT>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `<YOUR-SUPABASE-ANON-KEY>`
6. اضغط **Deploy** واربط النطاق الفرعي (مثل `admin.thanaya.com`).

---

## 4️⃣ إعداد الإعلانات والأرباح (Adsterra & Direct Ads)

1. **شبكات الإعلانات الرقمية (Adsterra / Ad Networks):**
   - تم ضبط ودمج كود الإعلانات المباشر في المكون [`apps/web/src/components/AdSlot.astro`](apps/web/src/components/AdSlot.astro).
2. **الإعلانات المباشرة والرعاة (Direct Ads):**
   - من لوحة الإدارة `admin.thanaya.com`، ادخل إلى تبويب **الإعلانات**.
   - أضف بنرات الرعاة والمدرسين مع تحديد المواضع والروابط.
3. **الدعم والتبرع (Platform Support):**
   - في حال عدم وجود إعلانات نشطة، تظهر بطاقة الدعم النظيف تلقائيًا مع منع أي انزياح في الصفحة (Zero CLS).

---

## 5️⃣ اختبارات ما بعد النشر (Smoke Test Checklist)

- [ ] زيارة الصفحة الرئيسية والتأكد من سرعة التحميل وظهور المواد.
- [ ] فحص خريطة الموقع عبر الرابط `/sitemap-index.xml`.
- [ ] فحص صفحة الخطأ عبر الرابط `/404`.
- [ ] فتح صفحة تقييم وتشغيل فيديو الحل السريع والتأكد من عمل مشغل الـ Facade الخفيف.
- [ ] تجربة زر "تحميل ملف PDF" والتأكد من زيادة عداد التحميلات الآمن.
- [ ] تجربة إرسال بلاغ عن مشكلة من نافذة الإبلاغ والتأكد من وصوله للوحة الإدارة.
- [ ] تسجيل الدخول إلى لوحة الإدارة وإضافة تقييم تجريبي وحذفه.
- [ ] فحص اختبار الأداء في Google PageSpeed Insights (الهدف: 95+ في Performance و SEO).

---

## 🔒 ملاحظات الأمان
- مفتاح `anon` في Supabase آمن للنشر العام بفضل سياسات `RLS` المفعلة على جميع الجداول.
- لا تضع مفتاح `service_role` في أي متغير بيئة بالواجهات الأمامية.
