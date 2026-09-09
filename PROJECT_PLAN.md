أريد منك العمل كـ **Software Architect + Senior Full-Stack Engineer + Performance/SEO Engineer** لتخطيط مشروع ويب حقيقي Production-Ready.

## 1. فكرة المشروع

نريد إنشاء منصة ويب مصرية مخصصة لطلاب **البكالوريا المصرية**.

الفكرة الأساسية:

> **التقييمات كلها في مكان واحد.**

المنصة ليست منصة تعليمية كاملة، وليست شبكة اجتماعية، ولا تحتاج حسابات للطلاب.

هي عبارة عن **مكتبة منظمة وسريعة جدًا للموارد الدراسية**، وعلى رأسها:

* التقييمات الأسبوعية.
* حلول التقييمات.
* الامتحانات.
* المذكرات.
* الملخصات.
* أي نوع آخر من الموارد يمكن أن يضيفه الأدمن مستقبلًا.

المهم جدًا أن الأدمن يستطيع إنشاء **أنواع محتوى جديدة من لوحة التحكم بدون الحاجة إلى تعديل كود الموقع**.

مثال:

الطالب يدخل:

`المادة → نوع المحتوى → المورد`

مثل:

`رياضيات → تقييمات أسبوعية → تقييم الأسبوع الرابع`

أو:

`رياضيات → امتحانات → امتحان تجريبي 1`

وهكذا.

---

# 2. الهدف الأساسي

الأولوية في المشروع:

1. السرعة Performance.
2. سهولة الوصول للمحتوى.
3. تنظيم ممتاز.
4. SEO قوي.
5. تجربة استخدام بسيطة ونظيفة.
6. قابلية التوسع.
7. تحقيق دخل من الإعلانات بدون تخريب تجربة الطالب.

لا نريد تصميمًا يشبه مواقع الـAI startups.

لا نريد:

* Glassmorphism مبالغ فيه.
* Blur في كل مكان.
* Animations كثيرة.
* Cards مستديرة بشكل مبالغ.
* واجهة مزدحمة.
* JavaScript غير ضروري.
* مكتبات ضخمة بدون سبب.

الواجهة يجب أن تكون:

**Simple + Clean + Fast + Serious + Educational**

وبألوان فاتحة ومتناسقة.

---

# 3. الطلاب

لا توجد حسابات للطلاب.

لا يوجد:

* Login للطلاب.
* Profile.
* Social system.
* Comments.
* Chat.
* Search.

## مهم جدًا:

**لا تضف Search Engine للموقع.**

المستخدم يتنقل من خلال التصنيفات والمواد وأنواع المحتوى.

---

# 4. الموقع العام

التقنية المفضلة:

## Astro

نريد استخدام Astro للموقع العام بسبب:

* Static/SSR حسب الحاجة.
* أقل JavaScript ممكن.
* صفحات سريعة.
* SEO ممتاز.
* مناسب جدًا لموقع يعتمد على القراءة والتصفح.
* إمكانية استخدام Islands فقط عند الحاجة.

اجعل الموقع العام في الأساس Server/Static rendered، ولا تحول المشروع إلى SPA بدون سبب.

---

# 5. لوحة التحكم

لوحة الأدمن يمكن أن تستخدم تقنية مختلفة عن الموقع العام.

التفضيل الحالي:

**React + TanStack / TanStack Start**

لكن لا تعتبر ذلك قرارًا نهائيًا.

قم بمقارنة الخيارات المناسبة، ثم اختر الأنسب بناءً على:

* سهولة التطوير.
* الأداء.
* SEO (إن كان له تأثير على لوحة التحكم).
* إدارة النماذج.
* Authentication.
* CRUD.
* قابلية التوسع.
* بساطة Deployment على Vercel.

يمكن أن يكون:

Public Site → Astro

Admin → React/TanStack

ولا توجد مشكلة في استخدام تقنيتين مختلفتين.

---

# 6. قاعدة البيانات

استخدم:

**Supabase PostgreSQL**

مع:

**Row Level Security (RLS)**

نريد تصميم قاعدة البيانات بشكل Production-Ready.

اقترح Schema واضحًا على الأقل للمكونات التالية:

* subjects
* content_types
* resources
* weeks
* admins/users
* reports
* analytics
* advertisements
* ad_slots
* direct_ads أو أي abstraction مناسب
* videos إذا كان الفصل عن resources أفضل

لكن لا تفترض أن هذا التصميم هو النهائي.

صمم الـSchema بناءً على العلاقات الحقيقية.

---

# 7. نظام المحتوى

هذه نقطة أساسية جدًا.

الأدمن يجب أن يستطيع من لوحة التحكم:

### إضافة مادة

مثل:

* رياضيات
* فيزياء
* برمجة
* إلخ

### إضافة نوع محتوى

مثل:

* تقييم أسبوعي
* حل تقييم
* امتحان
* مذكرة
* ملخص
* مراجعة
* أي نوع آخر

### إضافة Resource

ويحتوي مثلًا على:

* العنوان.
* المادة.
* نوع المحتوى.
* الأسبوع إن وجد.
* وصف اختياري.
* رابط PDF.
* رابط فيديو الحل اختياري.
* حالة النشر.
* تاريخ النشر.
* بيانات SEO عند الحاجة.

ويجب أن يكون التصميم مرنًا بحيث يمكن إضافة أنواع جديدة مستقبلًا بدون تغيير بنية الكود كل مرة.

---

# 8. الـPDF والملفات

لدينا حساب تخزين خارجي يحتوي على حوالي **400GB** وسيتم استخدامه لتخزين ملفات PDF.

لا نريد في البداية أن تمر ملفات الـPDF عبر Vercel.

المبدأ:

Student Browser
→ Vercel / Astro
→ Direct PDF URL

الـPDF نفسه موجود على خدمة التخزين الخارجية.

الأدمن يستطيع إدخال:

`PDF URL`

أو رفع الملف للخدمة الخارجية بالطريقة المناسبة إذا كان ذلك ممكنًا.

لكن لا تبنِ Upload Infrastructure معقدًا بدون حاجة.

ادرس أفضل طريقة لاستخدام التخزين الخارجي مع:

* Direct URLs.
* PDF viewing.
* Download.
* CORS إن كان مطلوبًا.
* Content-Type.
* Content-Disposition.
* Bandwidth limits.
* Reliability.
* Hotlinking إن كان خطرًا.
* إمكانية فشل الرابط.

**مهم:** اسم مزود التخزين غير محسوم حاليًا، لذلك لا تفترض API أو خصائص غير معروفة.

ضع هذه النقطة كقرار يجب تأكيده عند التنفيذ.

---

# 9. صفحة المورد

كل Resource يجب أن يمتلك URL مستقلًا وقابلًا للمشاركة.

مثال:

`/resources/math/week-4-assessment`

أو بنية URL أفضل تقترحها أنت.

الصفحة يجب أن تحتوي على:

* عنوان المورد.
* المادة.
* نوع المحتوى.
* الأسبوع إن وجد.
* وصف مختصر.
* PDF Viewer.
* زر Download.
* فيديو الحل إن وجد.
* زر مشاركة.
* Copy Link.
* Report Problem.
* معلومات مناسبة لمحركات البحث.

الفيديو لا يتم استضافته على منصتنا.

الأدمن يضع:

**YouTube URL**

ونقوم بعمل Embed/Link بطريقة مناسبة.

يجب أن يكون تحميل فيديو YouTube Lazy/Deferred حتى لا يؤثر على الأداء الأولي للصفحة.

---

# 10. PDF Viewer

ادرس الخيارات:

1. Browser native PDF viewer.
2. PDF.js.
3. حلول أخرى.

اختر الأبسط والأسرع طالما يلبي المتطلبات.

لا تستخدم PDF.js فقط لأنه يبدو أكثر احترافية إذا كان Native Viewer يؤدي الغرض.

يجب أن يكون هناك دائمًا:

**Download PDF**

كخيار واضح.

---

# 11. SEO

SEO جزء أساسي من المشروع.

نريد أن تظهر صفحات الموارد في Google.

مثال لطلبات بحث محتملة:

* حل تقييم الأسبوع الرابع رياضيات بكالوريا
* تقييم الأسبوع الثالث بكالوريا مصر
* تقييمات البرمجة بكالوريا
* حل تقييم الأسبوع الخامس

لذلك كل Resource يجب أن يكون:

* Indexable.
* له URL ثابت.
* Title مناسب.
* Meta Description.
* Canonical URL.
* Open Graph metadata.
* Sitemap.
* Robots.
* Structured Data عند الحاجة.
* Internal linking جيد.

اقترح أفضل بنية URL.

لا تستخدم Query Parameters للموارد إذا كان هناك تصميم أفضل للـSEO.

---

# 12. الصفحة الرئيسية

الصفحة الرئيسية يجب أن تكون بسيطة.

تحتوي مثلًا على:

* تعريف مختصر جدًا بالمنصة.
* المواد.
* أنواع المحتوى المهمة.
* قسم واضح للتقييمات الأسبوعية/المحتوى المطلوب حاليًا.
* روابط مباشرة للمحتوى.

**لا تنشئ قسمًا مستقلًا باسم "آخر الإضافات".**

يمكن عرض أحدث التقييمات ضمن قسم مفيد للمستخدم، لكن لا نريد تحويل الصفحة إلى Feed.

---

# 13. لا يوجد Search

هذا قرار واضح:

**NO SEARCH**

لا تضف:

* Search bar.
* Full-text search.
* Algolia.
* Meilisearch.
* Elasticsearch.

إلا إذا تغير القرار مستقبلًا.

---

# 14. Analytics

نريد Analytics بسيطة داخل Supabase.

على الأقل:

* Resource views.
* PDF downloads.

ويمكن مستقبلًا إضافة:

* Unique visitors.
* Referrer.
* Device category.
* Popular resources.
* Popular subjects.
* Popular content types.

لكن لا تجمع بيانات شخصية غير ضرورية.

الأهم:

**لا تجعل client-side المستخدم قادرًا على إرسال UPDATE مباشر للعدادات بشكل غير آمن.**

صمم آلية آمنة، مثل:

* Server endpoint.
* RPC مضبوط.
* Edge Function.
* Rate limiting / anti-abuse.

بحيث لا يستطيع شخص بسهولة عمل:

`+100000 views`

عن طريق تعديل request.

---

# 15. Report Problem

كل Resource يجب أن يحتوي على:

**الإبلاغ عن مشكلة**

والطالب يستطيع اختيار:

* الملف لا يعمل.
* الرابط لا يعمل.
* المحتوى خاطئ.
* المحتوى قديم.
* مشكلة أخرى.

مع وصف اختياري.

الأدمن يرى Reports داخل لوحة التحكم ويستطيع:

* مشاهدة البلاغ.
* تغيير الحالة.
* Mark as resolved.
* تجاهل البلاغ.
* معرفة المورد المرتبط.

لا نحتاج حسابًا للطالب من أجل الإبلاغ.

صمم آلية تمنع Spam قدر الإمكان.

---

# 16. الإعلانات — جزء أساسي من المشروع

المشروع سيتم Monetize من خلال:

## Hybrid Advertising

### 1. Google Ads

استخدام Google Ads / AdSense بالطريقة المسموح بها حاليًا.

### 2. Direct Ads

إعلانات مباشرة من معلنين، خصوصًا إذا أصبح لدينا جمهور مصري جيد.

نريد أن تكون بنية المشروع قادرة على التعامل مع النوعين بدون إعادة تصميم الموقع.

---

# 17. فلسفة الإعلانات

الهدف:

**تحقيق دخل جيد بدون تدمير تجربة الطالب.**

لا نريد:

* Popups عشوائية.
* Ads تغطي المحتوى.
* Fake Download Buttons.
* إعلانات تجعل الطالب يضغط بالخطأ.
* إعلانات داخل PDF Viewer.
* Layout shifts مزعجة.
* عشرات الإعلانات في الصفحة.
* تحميل Ad scripts الثقيلة قبل المحتوى الأساسي إذا كان يمكن تجنب ذلك.

الإعلان يجب أن يكون واضحًا كإعلان.

---

# 18. أماكن الإعلانات

استخدم Slots ثابتة ومحددة بدل أن يكون الأدمن قادرًا على وضع إعلان عشوائي في أي مكان في الـDOM.

الأماكن المقترحة:

### Homepage

* Top / بعد المقدمة.
* Middle عند الحاجة.
* Footer/Lower area عند الحاجة.

### Subject Page

* Slot مناسب داخل الصفحة.

### Resource Page

* Slot بعد المعلومات الأساسية.
* Slot في مكان مناسب بعيدًا عن PDF controls.

**لا تضع الإعلان داخل PDF Viewer.**

ولا تجعل الإعلان يختلط مع زر Download.

---

# 19. إعلان قبل فتح الملف

كانت الفكرة الأولية:

عندما يضغط الطالب لفتح الملف، يظهر إعلان لمدة حوالي 15 ثانية.

لكن:

**لا تفترض أن Google AdSense يسمح بهذا الأسلوب.**

لا تستخدم Google Ads كـForced 15-second gate.

بدلًا من ذلك، نريد تصميمًا يحافظ على الربح وحق الطالب في الوصول للمحتوى.

يمكن استخدام رسالة دعم من المنصة نفسها إذا كانت مناسبة:

> "ساعدنا نستمر ❤️
> المنصة مجانية، والإعلانات تساعدنا في الحفاظ عليها وتطويرها.
> سيتم فتح الملف خلال لحظات."

لكن:

* لا تجعلها مزعجة.
* لا تظهر عند كل فتح ملف.
* لا تجعل المستخدم يضطر للتفاعل مع إعلان.
* لا تمنع الوصول للمحتوى بشكل مبالغ فيه.
* لا تستخدمها كطريقة للتحايل على سياسات Google.

اقترح أفضل UX لتحقيق نفس الهدف.

يمكن مثلًا أن تكون الرسالة:

* قصيرة جدًا.
* لها Frequency Cap.
* تظهر فقط أحيانًا.
* يمكن تخطيها إذا كان ذلك أفضل.
* أو تتحول إلى مجرد رسالة دعم بدون انتظار.

**أنت مسؤول عن اقتراح النموذج الأفضل بعد التحقق من سياسات Google الحالية.**

---

# 20. Direct Ads

نريد إمكانية إضافة إعلان مباشر من لوحة التحكم.

مثلًا:

* اسم المعلن.
* عنوان الإعلان.
* صورة/banner.
* الرابط.
* Slot.
* تاريخ البداية.
* تاريخ النهاية.
* Active/Inactive.
* Priority.
* Impressions.
* Clicks.
* CTR إن أمكن.

ويجب أن يستطيع الأدمن:

* تشغيل الإعلان.
* إيقافه.
* تحديد مكانه.
* تحديد مدة تشغيله.
* تغييره.
* حذفه/أرشفته.
* مشاهدة إحصائياته.

الإعلانات المباشرة يجب أن تظهر بوضوح كإعلانات.

---

# 21. Admin Ad Manager

لوحة التحكم يجب أن تحتوي على قسم:

**Ads**

وفيه:

### Google Ads

* تفعيل/تعطيل.
* إدارة الـslots.
* إعدادات العرض المناسبة.

### Direct Ads

* إضافة إعلان.
* تعديل.
* حذف/Archive.
* تشغيل/إيقاف.
* Slot.
* Schedule.
* Statistics.

### Ad Slots

الأدمن يرى Slots مثل:

* homepage_top
* homepage_middle
* subject_page
* resource_after_meta
* footer

ويستطيع التحكم فيها.

لا تجعل الأدمن يكتب HTML/JS خامًا في قاعدة البيانات إلا إذا كان هناك سبب قوي جدًا.

---

# 22. Performance

الأداء من أعلى أولويات المشروع.

ضع Performance Budget واضحًا.

يجب أن يكون:

* أقل JavaScript ممكن.
* Static rendering حيثما أمكن.
* Lazy loading.
* Deferred third-party scripts.
* YouTube iframe lazy.
* Images optimized.
* Fonts قليلة.
* لا توجد مكتبات UI ضخمة بدون سبب.
* لا توجد animations ثقيلة.
* لا يوجد global client state غير ضروري.
* CDN/Vercel caching حيثما يناسب.
* Direct PDF delivery من storage.
* Ads لا تمنع الـcritical rendering قدر الإمكان.

يجب أن تشرح في الخطة كيف سنحافظ على الأداء حتى بعد زيادة عدد الموارد والزوار.

---

# 23. Security

ضع Security Architecture مناسبة.

على الأقل:

* Supabase RLS.
* Admin authentication.
* Role-based access إذا احتجنا أكثر من Admin.
* عدم كشف Supabase service-role key.
* Validation لكل Admin input.
* حماية Admin routes.
* URL validation.
* YouTube URL validation.
* منع XSS.
* حماية Reports.
* Rate limiting للـanalytics/reports.
* عدم السماح للمستخدم العادي بتعديل resources.
* Secure handling للإعلانات المباشرة.

---

# 24. Architecture

أريد منك رسم Architecture واضح للمشروع.

مثلًا:

Student
↓
Vercel
↓
Astro
↓
Supabase

و:

Admin
↓
Admin App
↓
Supabase

و:

PDF
↓
External Storage
↓
Direct URL

و:

YouTube
↓
YouTube Embed

و:

Ads
↓
Google Ads + Direct Ads

لكن لا تلتزم بهذا الرسم إذا وجدت Architecture أفضل.

---

# 25. Deployment

الموقع سيعمل على:

**Vercel**

ضع تصورًا واضحًا لـ:

* Public deployment.
* Admin deployment.
* Environment variables.
* Production/Preview.
* Supabase.
* External storage.
* Domain.
* Sitemap.
* Analytics.
* Ads.

ادرس هل الأفضل:

### Option A

مشروع Vercel واحد:

`domain.com`
`domain.com/admin`

أم:

### Option B

مشروعان منفصلان:

`domain.com`
`admin.domain.com`

ثم اختر الأفضل مع شرح السبب.

---

# 26. Cost

نريد المشروع بأقل تكلفة ممكنة في البداية.

تحقق من:

* Vercel limits.
* Supabase free tier/current limits.
* Astro/TanStack costs.
* Storage provider limits بعد معرفة المزود.
* Google Ads requirements.
* أي خدمات خارجية.

**لا تعتمد على معلومات قديمة.**

قبل تثبيت أي قرار متعلق بالـFree Tier أو Limits أو Policies، تحقق من المصادر الرسمية الحالية.

---

# 27. Documentation Research

قبل كتابة الخطة النهائية، راجع Documentation الرسمية للتقنيات التي ستعتمد عليها.

على الأقل:

* Astro
* React
* TanStack/TanStack Start إن تم اختياره
* Supabase
* Vercel
* Google AdSense / Google publisher policies
* YouTube embedding
* أي storage provider إذا كان معروفًا

لا تعتمد على Blog عشوائي عندما تكون المعلومة موجودة في Documentation الرسمية.

---

# 28. المطلوب منك الآن

**ممنوع تبدأ كتابة الكود.**

أريد منك في هذه المرحلة فقط إنشاء ملف:

`PROJECT_PLAN.md`

يحتوي على خطة تنفيذ كاملة للمشروع.

---

# 29. محتوى PROJECT_PLAN.md

يجب أن يحتوي على:

## 1. Project Overview

## 2. Goals

## 3. Non-Goals

وضح الأشياء التي لن نبنيها.

## 4. Final Architecture

مع Diagram نصي.

## 5. Technology Decisions

لكل تقنية:

* لماذا؟
* البدائل.
* لماذا تم رفض البدائل؟

## 6. Database Architecture

مع ERD منطقي وشرح الجداول والعلاقات.

## 7. RLS & Security Model

## 8. Public Site Architecture

## 9. Admin Architecture

## 10. Content Management System

## 11. PDF / Storage Architecture

## 12. YouTube Architecture

## 13. SEO Architecture

## 14. Analytics Architecture

## 15. Reporting System

## 16. Advertising Architecture

بالتفصيل:

* Google Ads.
* Direct Ads.
* Ad Slots.
* Admin control.
* Frequency.
* UX.
* Performance.
* Policy constraints.

## 17. Performance Strategy

## 18. UI/UX Principles

## 19. URL Structure

## 20. Deployment Architecture

## 21. Environment Variables

## 22. Cost / Free Tier Analysis

## 23. Security Threat Model

## 24. Error Handling

## 25. Testing Strategy

## 26. Monitoring

## 27. Implementation Phases

قسم المشروع إلى مراحل عملية واضحة.

مثل:

Phase 0 — Setup
Phase 1 — Database
Phase 2 — Admin
Phase 3 — Public Site
Phase 4 — Resources
Phase 5 — SEO
Phase 6 — Analytics
Phase 7 — Ads
Phase 8 — Testing
Phase 9 — Deployment

لكن عدّل التقسيم إذا كان هناك تقسيم أفضل.

---

# 30. كل Phase يجب أن يحتوي على

* الهدف.
* المهام.
* الملفات/المكونات المتوقعة.
* Dependencies.
* Definition of Done.
* Tests المطلوبة.

---

# 31. Decision Log

أنشئ قسم:

`Architecture Decision Log`

ويحتوي على القرارات المهمة.

مثل:

* Astro للموقع العام.
* Supabase PostgreSQL.
* RLS.
* External PDF storage.
* YouTube hosting.
* No student accounts.
* No search.
* Hybrid advertising.
* Admin-controlled ad slots.

---

# 32. Open Questions

في النهاية أنشئ:

`OPEN_QUESTIONS.md`

أو قسمًا داخل `PROJECT_PLAN.md`.

ضع فقط القرارات التي لا يمكن حسمها الآن.

مثل:

* Storage provider.
* Domain.
* هل Admin في نفس Vercel project أم منفصل؟
* التفاصيل النهائية للـGoogle Ads بعد إعداد الحساب.
* أي قرار آخر يحتاج معلومات مني.

**لا تسألني عن أشياء يمكن حسمها هندسيًا بنفسك.**

---

# 33. Research Rules

أثناء التخطيط:

1. لا تختر تقنية لمجرد أنها مشهورة.
2. لا تضف dependency بدون سبب.
3. لا تبالغ في الهندسة.
4. لا تبنِ Backend كامل لمجرد وجود Backend.
5. لا تستخدم Microservices.
6. لا تستخدم Redis إلا إذا ظهر سبب حقيقي.
7. لا تستخدم Search Engine.
8. لا تستخدم CMS خارجي إلا إذا كان له فائدة واضحة.
9. لا تستضف PDFs على Vercel.
10. لا تجعل الموقع العام SPA.
11. لا تضع أسرارًا في frontend.
12. لا تجعل Analytics قابلة للتلاعب بسهولة.
13. لا تجعل الإعلانات تقتل الأداء.
14. لا تستخدم Google Ads بطريقة تخالف سياسات Google.

---

# 34. أهم قاعدة

إذا كان هناك قرار تقني غير محسوم، **لا تخمّن**.

ابحث في Documentation الحالية والمصادر الرسمية.

إذا كان هناك أكثر من خيار:

اعرض:

**Option A**
**Option B**
**Recommendation**

مع سبب واضح.

---

# 35. قبل إنهاء الخطة

راجع الخطة بالكامل وابحث عن:

* Overengineering.
* Security holes.
* SEO problems.
* Performance problems.
* Vercel limitations.
* Supabase limitations.
* Storage limitations.
* Ad policy problems.
* مشاكل في الـAdmin architecture.
* مشاكل scalability.
* مشاكل في تجربة الطالب.

ثم أصلح الخطة قبل حفظها.

---

# 36. ممنوع تنفيذ الكود الآن

هذه المرحلة **Planning Only**.

لا تنشئ:

* React components.
* Astro pages.
* API routes.
* SQL migrations.
* Supabase project.
* Vercel project.
* Ad integration.
* Authentication implementation.

فقط:

**Research → Architecture → Documentation → PROJECT_PLAN.md**

بعد الانتهاء، توقف تمامًا.

لا تبدأ Phase 0.

سأراجع `PROJECT_PLAN.md` أولًا، وبعد موافقتي نبدأ التنفيذ مرحلة بمرحلة.
