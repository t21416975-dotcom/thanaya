# GEO Audit & Improvement Plan — منصة ثنايا

## Current State Summary

### ✅ ما هو موجود وسليم
- **Layout.astro**: `WebSite` JSON-LD schema + OG/Twitter tags + canonical URLs + `robots` meta
- **resources/[slug].astro**: `LearningResource` + `BreadcrumbList` JSON-LD (hardcoded inline)
- **robots.txt**: يشير لـsitemap
- **site.webmanifest**: بيانات صحيحة
- **Astro sitemap integration**: مفعّل في `astro.config.mjs`
- **Title/Description**: موجود على كل الصفحات

### ❌ ما ينقص (الفجوات)

| Gap | Impact |
|-----|--------|
| **لا يوجد `Organization` schema** | محركات البحث والـAI لا تفهم هوية "ثنايا" ككيان تعليمي مستقل |
| **`WebSite` بدون `SearchAction`** | فرصة ضائعة لـsitelinks searchbox |
| **لا يوجد `sameAs`** على Organization | لا ربط بصفحات سوشيال/ويكي |
| **Subject page: لا JSON-LD** | لا BreadcrumbList + لا CollectionPage |
| **ContentType page: لا JSON-LD** | نفس المشكلة |
| **Exams index: لا JSON-LD** | لا CollectionPage |
| **Exam detail: لا JSON-LD** | لا Quiz/LearningResource schema |
| **Homepage: لا JSON-LD خاص** | لا CollectionPage للموارد الأخيرة |
| **About page: لا JSON-LD** | فرصة ضائعة لتعزيز Entity signal |
| **Structured data مبعثرة (hardcoded)** | كل resource page يبني schema يدوي. أي نوع محتوى جديد يحتاج copy-paste |
| **لا GEO layer مركزية** | Admin يضيف محتوى بدون auto-generated metadata/schema |

---

## Proposed Changes

### 1. Create Centralized GEO Utility Layer

> **New file**: `apps/web/src/lib/geo.ts`

دالة مركزية واحدة تنتج JSON-LD schemas ديناميكيًا بناءً على نوع الصفحة والبيانات:

```typescript
// Types of pages supported
type GeoPageType = 
  | 'home' 
  | 'subject' 
  | 'contentTypeListing' 
  | 'resource' 
  | 'examListing' 
  | 'exam' 
  | 'about';

// Central function
export function buildPageSchema(pageType: GeoPageType, data: PageData): JsonLdSchema[]
```

**Features:**
- يبني `BreadcrumbList` تلقائيًا حسب هيكل الصفحة
- يبني `LearningResource` / `Quiz` / `CollectionPage` حسب نوع المحتوى
- يضيف `provider` = Organization reference تلقائيًا
- يستخدم `datePublished` / `dateModified` من بيانات DB الفعلية
- يبني `educationalLevel` و `learningResourceType` ديناميكيًا من `content_type.name`
- قابل للتوسع: إضافة نوع محتوى جديد = إضافة case واحد

### 2. Add `Organization` Schema (Global)

> **Modified file**: `apps/web/src/layouts/Layout.astro`

إضافة Organization schema بجانب WebSite الموجود:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://thanaya.dpdns.org/#organization",
  "name": "منصة ثنايا البكالوريا",
  "alternateName": ["ثنايا", "Thanaya", "منصة ثنايا التعليمية"],
  "url": "https://thanaya.dpdns.org",
  "description": "منصة تعليمية مصرية مخصصة لطلاب الثانوية العامة والبكالوريا المصرية، توفر التقييمات الأسبوعية وحلولها والامتحانات التجريبية والملخصات والمذكرات.",
  "inLanguage": "ar-EG"
}
```

**ملاحظة مهمة**: لا `sameAs` حاليًا لأن لا توجد صفحات سوشيال معروفة. تُضاف لاحقًا عند توفرها.

### 3. Enhance `WebSite` Schema

> **Modified file**: `apps/web/src/layouts/Layout.astro`

ربط WebSite بـOrganization عبر `@id` reference + إضافة `publisher`:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://thanaya.dpdns.org/#website",
  "name": "منصة ثنايا للبكالوريا المصرية",
  "url": "https://thanaya.dpdns.org",
  "description": "...",
  "inLanguage": "ar-EG",
  "publisher": { "@id": "https://thanaya.dpdns.org/#organization" }
}
```

### 4. Add JSON-LD to Missing Pages

كل صفحة تستدعي `buildPageSchema()` بدل hardcoding:

| Page | Schema Types Added |
|------|-------------------|
| **Homepage** | `CollectionPage` (for latest resources) |
| **Subject page** | `CollectionPage` + `BreadcrumbList` |
| **ContentType listing** | `CollectionPage` + `BreadcrumbList` |
| **Resource detail** | **Refactor existing** to use `geo.ts` (same output, centralized) |
| **Exams index** | `CollectionPage` + `BreadcrumbList` |
| **Exam detail** | `Quiz` + `BreadcrumbList` |
| **About** | `AboutPage` + `BreadcrumbList` |

### 5. Auto-GEO for Admin-Created Content

**لا تغيير على Admin side.** كل المنطق في `geo.ts` يعتمد على:
- `resource.subject` (المادة)
- `resource.content_type` (نوع المحتوى)
- `resource.week` (الأسبوع)
- `resource.published_at` / `resource.updated_at` (تواريخ)
- `resource.title` / `resource.description` (العنوان والوصف)

أي محتوى جديد يُنشر من Admin يحصل **تلقائيًا** على metadata + structured data مناسبة عند render الصفحة.

---

## Files Changed Summary

| File | Action | What |
|------|--------|------|
| `apps/web/src/lib/geo.ts` | **New** | GEO utility layer |
| `apps/web/src/layouts/Layout.astro` | **Edit** | Organization + enhanced WebSite schemas (global `<head>`) |
| `apps/web/src/pages/index.astro` | **Edit** | Add `jsonLd` from `geo.ts` |
| `apps/web/src/pages/about.astro` | **Edit** | Add `jsonLd` from `geo.ts` |
| `apps/web/src/pages/subjects/[subject].astro` | **Edit** | Add `jsonLd` from `geo.ts` |
| `apps/web/src/pages/subjects/[subject]/[contentType].astro` | **Edit** | Add `jsonLd` from `geo.ts` |
| `apps/web/src/pages/resources/[slug].astro` | **Edit** | Replace inline schemas with `geo.ts` call |
| `apps/web/src/pages/exams/index.astro` | **Edit** | Add `jsonLd` from `geo.ts` |
| `apps/web/src/pages/exams/[id].astro` | **Edit** | Add `jsonLd` from `geo.ts` |

---

## What Will NOT Change

- ❌ UI/Design/Content
- ❌ URLs or routing
- ❌ Canonical URLs
- ❌ Existing `<title>` and `<meta description>` values
- ❌ Admin panel code
- ❌ Database schema
- ❌ robots.txt or sitemap config
- ❌ Performance (schemas are rendered server-side, zero client JS)

---

## Extensibility

إضافة نوع محتوى مستقبلي (مثلاً: "حصص مباشرة" أو "بنك أسئلة"):
1. أضف `case` جديد في `buildPageSchema()` في `geo.ts`
2. أو ببساطة: إذا كان نوع المحتوى يقع تحت `resource` أو `exam`، لا تحتاج تغيير أصلاً — الـGEO layer هتولّد schema مناسب تلقائيًا بناءً على `content_type.name` الموجود في DB.
