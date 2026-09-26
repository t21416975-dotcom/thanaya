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

---

## 6️⃣ نظام الطالب وتسجيل الدخول بحساب Google

منظومة كاملة أُضيفت في ترحيلات `20261001*`:
تسجيل دخول Google، حفظ نتائج الامتحانات، ولوحة متابعة للطالب والإدارة.

### خطوات التفعيل

1. **طبّق الترحيلات الخمسة** بالترتيب (مع نسخة احتياطية قبل ذلك):
   ```bash
   supabase db push
   ```
   الترحيلات: `20261001000000_student_auth.sql` ← `..._student_rls.sql` ←
   `..._student_functions.sql` ← `..._student_permissions.sql` ← `..._backfill.sql`

2. **فعّل Google OAuth** — [التفاصيل الكاملة في `STUDENT_AUTH_SETUP.md`](STUDENT_AUTH_SETUP.md).
   باختصار: عميل OAuth من نوع Web في Google Cloud، ثم تفعيل المزوّد في
   Supabase، ثم إضافة `<site>/auth/callback` إلى Redirect URLs.

3. **لا متغيرات بيئة جديدة.** النظام يقرأ الجلسة من الكوكيز
   (`@supabase/ssr`) بنفس `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY`
   الموجودين. **لا تضف `SUPABASE_SERVICE_ROLE_KEY` في `apps/web`.**

4. **امنح الصلاحيات** (اختياري): المفاتيح الأربعة
   `students.view` / `students.manage` / `attempts.view` / `attempts.manage`
   **خارج قوالب الأدوار عمدًا** — بيانات شخصية. افتراضيًا المدير العام فقط.
   منحها من: **الفريق والصلاحيات ← الاختيار ← المفتاح** (مع دعم الحصر بمادة).

5. **تحقّق بعد النشر** (استعلامات جاهزة في `STUDENT_AUTH_SETUP.md` §3):
   - 6 جداول طلبة موجودة وكلها عليها RLS
   - `anon` لا يملك أي صلاحية عليها
   - `admin_role_presets` لا تحتوي مفاتيح بيانات الطلبة

### بنية المسارات

| المسار | الحماية | الوصف |
|---|---|---|
| `/auth/login` · `/auth/callback` | عامة | Google OAuth |
| `/account` · `/account/wrong-questions` | جلسة | لوحة الطالب + الأسئلة الخاطئة |
| `/review` · `/review/attempt/[id]` | جلسة | ★ «امتحان الأخطاء» |
| `/api/exams/{start,attempt/answer,attempt/submit,review/create}` | جلسة | دورة حياة المحاولة |

### فحوص إضافية في قائمة ما بعد النشر

- [ ] تسجيل الدخول بحساب Google حقيقي ينجح ويعيد توجيهًا إلى `/account`.
- [ ] `/account` محمي: الزائر يُعاد توجيهه إلى `/auth/login`.
- [ ]_view source_ لصفحة `/exams/[id]` كمسجّل: **لا** يوجد `correct_index`
      (تحقّق: افتح DevTools وابحث داخل `<script id="exam-data">`).
- [ ] امتحان كمسجّل يظهر في **الامتحانات والنتائج** بلوحة التحكم.
- [ ] «امتحان أخطاء» يختار من الأسئلة الخاطئة فعلًا، والعدد يلتزم بالاختيار.
- [ ] إجابة سؤال صحيحًا مرتين يُخرجه من قائمة «الأسئلة التي أخطأت فيها».
- [ ] تبويب «الطلاب» لا يظهر لغير من يملك `students.view`.

### سلوك مهم: الزائر مقابل الطالب المسجّل

| الحالة | مفتاح الإجابة في HTML | تُحفظ النتيجة | مكان التصحيح |
|---|---|---|---|
| زائر | موجود (سلوك قديم) | ❌ | المتصفح |
| طالب مسجّل | **مفقود** | ✅ | **الخادم (SQL)** |

مقصود: الزائر يجرّب بلا احتكاك، والطالب يحصل على نتيجة لا يمكن التلاعب بها.
لجعل التسجيل إلزاميًا: احذف فرع `isSignedIn` في
`apps/web/src/pages/exams/[id].astro` وأضف `/exams` إلى
`PROTECTED_PREFIXES` في `apps/web/src/middleware.ts` (غير مستحسَن — يكسر التحويل).
