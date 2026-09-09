import { e as createAstro, f as createComponent, m as maybeRenderHead, h as addAttribute, r as renderTemplate, l as renderScript, k as renderComponent, n as renderSlot, o as renderHead, u as unescapeHTML } from './astro/server_Cs2yQakW.mjs';
import 'piccolore';
import 'clsx';
import { createClient } from '@supabase/supabase-js';
/* empty css                         */

const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "SITE": "https://thanaya.com", "SSR": true};
function getEnv(key) {
  try {
    if (typeof import.meta !== "undefined" && Object.assign(__vite_import_meta_env__, { _: process.env._ }) && Object.assign(__vite_import_meta_env__, { _: process.env._ })[key]) {
      return String(Object.assign(__vite_import_meta_env__, { _: process.env._ })[key]).trim();
    }
  } catch {
  }
  try {
    if (typeof process !== "undefined" && process.env && process.env[key]) {
      return String(process.env[key]).trim();
    }
  } catch {
  }
  return "";
}
const rawUrl = getEnv("PUBLIC_SUPABASE_URL");
const rawKey = getEnv("PUBLIC_SUPABASE_ANON_KEY");
function isValidHttpUrl(str) {
  try {
    const parsed = new URL(str);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
const isSupabaseConfigured = Boolean(
  rawUrl && isValidHttpUrl(rawUrl) && !rawUrl.includes("your-project.supabase.co") && !rawUrl.includes("placeholder.supabase.co") && rawKey && rawKey !== "placeholder-anon-key" && rawKey !== "your-anon-key-here"
);
const effectiveUrl = isSupabaseConfigured ? rawUrl : "https://placeholder.supabase.co";
const effectiveKey = isSupabaseConfigured ? rawKey : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder";
const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

class SmartMemoryCache {
  store = /* @__PURE__ */ new Map();
  /**
   * Get cached item or null if expired/not found
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }
  /**
   * Set item in cache with TTL in seconds
   */
  set(key, data, ttlSeconds = 60) {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1e3
    });
  }
  /**
   * Wrap an async fetcher with smart caching and crash-proof fallback
   */
  async wrap(key, ttlSeconds, fetcher, fallback) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    try {
      const fresh = await fetcher();
      this.set(key, fresh, ttlSeconds);
      return fresh;
    } catch (err) {
      console.error(`[SmartCache Error] Fetch failed for key "${key}":`, err);
      if (fallback !== void 0) {
        return fallback;
      }
      throw err;
    }
  }
  /**
   * Invalidate specific key or keys starting with prefix
   */
  invalidate(keyOrPrefix) {
    if (!keyOrPrefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
  }
}
const smartCache = new SmartMemoryCache();

const mockSubjects = [
  { id: "1", name: "اللغة العربية", slug: "arabic", icon: "book-open", description: "النحو والبلاغة والنصوص والأدب", order_index: 1, is_active: true, created_at: "", updated_at: "" },
  { id: "2", name: "الفيزياء", slug: "physics", icon: "zap", description: "الكهربية والمغناطيسية والفيزياء الحديثة", order_index: 2, is_active: true, created_at: "", updated_at: "" },
  { id: "3", name: "الرياضيات البحتة", slug: "pure-math", icon: "calculator", description: "الجبر والتفاضل والتكامل والهندسة الفراغية", order_index: 3, is_active: true, created_at: "", updated_at: "" },
  { id: "4", name: "الكيمياء", slug: "chemistry", icon: "flask-conical", description: "الكيمياء العضوية والتحليلية والكهربية", order_index: 4, is_active: true, created_at: "", updated_at: "" },
  { id: "5", name: "الأحياء", slug: "biology", icon: "dna", description: "الدعامة والهرمونات والتكاثر والبيولوجيا الجزيئية", order_index: 5, is_active: true, created_at: "", updated_at: "" },
  { id: "6", name: "الجيولوجيا", slug: "geology", icon: "mountain", description: "علوم الأرض والبيئة", order_index: 6, is_active: true, created_at: "", updated_at: "" },
  { id: "7", name: "اللغة الإنجليزية", slug: "english", icon: "languages", description: "القصة والقواعد والمفردات", order_index: 7, is_active: true, created_at: "", updated_at: "" },
  { id: "8", name: "التاريخ", slug: "history", icon: "hourglass", description: "تاريخ مصر والعالم الحديث", order_index: 8, is_active: true, created_at: "", updated_at: "" }
];
const mockContentTypes = [
  { id: "1", name: "التقييمات الأسبوعية", slug: "weekly-assessments", description: "التقييمات الرسمية لوزارة التربية والتعليم", order_index: 1, is_active: true, created_at: "", updated_at: "" },
  { id: "2", name: "حلول التقييمات", slug: "assessment-solutions", description: "نماذج الإجابة وفيديوهات شرح خطوات الحل", order_index: 2, is_active: true, created_at: "", updated_at: "" },
  { id: "3", name: "الامتحانات التجريبية", slug: "mock-exams", description: "امتحانات شاملة وتدريبية على نمط البكالوريا", order_index: 3, is_active: true, created_at: "", updated_at: "" },
  { id: "4", name: "المذكرات والملخصات", slug: "study-notes", description: "مذكرات مراجعة وتلخيص لأهم القوانين والنقاط", order_index: 4, is_active: true, created_at: "", updated_at: "" }
];
const mockWeeks = Array.from({ length: 16 }, (_, i) => ({
  id: `w-${i + 1}`,
  week_number: i + 1,
  title: `الأسبوع ${i + 1}`,
  term: 1,
  created_at: ""
}));
const mockResources = [
  {
    id: "res-1",
    title: "تقييم الأسبوع الرابع في الرياضيات البحتة (الجبر)",
    slug: "pure-math-assessment-week-4",
    subject_id: "3",
    content_type_id: "1",
    week_id: "w-4",
    pdf_url: "https://example.com/storage/math-week-4.pdf",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    description: "أسئلة التقييم الوزاري الأسبوعي لمادة الجبر والهندسة الفراغية.",
    is_published: true,
    published_at: (/* @__PURE__ */ new Date()).toISOString(),
    views_count: 512,
    downloads_count: 240,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    subject: mockSubjects[2],
    content_type: mockContentTypes[0],
    week: mockWeeks[3]
  },
  {
    id: "res-2",
    title: "حل تقييم الأسبوع الرابع في الرياضيات البحتة",
    slug: "pure-math-solution-week-4",
    subject_id: "3",
    content_type_id: "2",
    week_id: "w-4",
    pdf_url: "https://example.com/storage/math-solution-week-4.pdf",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    description: "نموذج الإجابة التفصيلي لتقييم الأسبوع الرابع مع فيديو الشرح.",
    is_published: true,
    published_at: (/* @__PURE__ */ new Date()).toISOString(),
    views_count: 820,
    downloads_count: 430,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    subject: mockSubjects[2],
    content_type: mockContentTypes[1],
    week: mockWeeks[3]
  },
  {
    id: "res-3",
    title: "تقييم الأسبوع الرابع في الفيزياء (قانون كيرشوف)",
    slug: "physics-assessment-week-4",
    subject_id: "2",
    content_type_id: "1",
    week_id: "w-4",
    pdf_url: "https://example.com/storage/physics-week-4.pdf",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    description: "تقييم الوزارة للأسبوع الرابع في فيزياء الثانوية العامة.",
    is_published: true,
    published_at: (/* @__PURE__ */ new Date()).toISOString(),
    views_count: 670,
    downloads_count: 310,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    subject: mockSubjects[1],
    content_type: mockContentTypes[0],
    week: mockWeeks[3]
  },
  {
    id: "res-4",
    title: "امتحان تجريبي شامل في الكيمياء العضوية",
    slug: "chemistry-mock-exam-organic",
    subject_id: "4",
    content_type_id: "3",
    week_id: null,
    pdf_url: "https://example.com/storage/chemistry-exam.pdf",
    youtube_url: null,
    description: "نموذج اختبار شامل مع سلم التقدير والتصحيح.",
    is_published: true,
    published_at: (/* @__PURE__ */ new Date()).toISOString(),
    views_count: 380,
    downloads_count: 190,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    subject: mockSubjects[3],
    content_type: mockContentTypes[2]
  }
];
const publicApi = {
  /**
   * Get all active subjects (Cached for 60s)
   */
  async getActiveSubjects() {
    return smartCache.wrap("subjects:active", 60, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from("subjects").select("*").eq("is_active", true).order("order_index");
          if (error) {
            console.error("Error fetching subjects from Supabase:", error);
            return mockSubjects.filter((s) => s.is_active);
          }
          return data || [];
        } catch (err) {
          console.error("Supabase exception in getActiveSubjects:", err);
          return mockSubjects.filter((s) => s.is_active);
        }
      }
      return mockSubjects.filter((s) => s.is_active).sort((a, b) => a.order_index - b.order_index);
    }, mockSubjects.filter((s) => s.is_active));
  },
  /**
   * Get single subject by slug (Cached for 60s)
   */
  async getSubjectBySlug(slug) {
    if (!slug) return null;
    return smartCache.wrap(`subject:${slug}`, 60, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from("subjects").select("*").eq("slug", slug).eq("is_active", true).single();
          if (error) {
            return null;
          }
          return data;
        } catch (err) {
          console.error(`Supabase exception in getSubjectBySlug (${slug}):`, err);
          return mockSubjects.find((s) => s.slug === slug && s.is_active) || null;
        }
      }
      return mockSubjects.find((s) => s.slug === slug && s.is_active) || null;
    }, null);
  },
  /**
   * Get all active content types (Cached for 60s)
   */
  async getActiveContentTypes() {
    return smartCache.wrap("content_types:active", 60, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from("content_types").select("*").eq("is_active", true).order("order_index");
          if (error) {
            console.error("Error fetching content types:", error);
            return mockContentTypes.filter((c) => c.is_active);
          }
          return data || [];
        } catch (err) {
          console.error("Supabase exception in getActiveContentTypes:", err);
          return mockContentTypes.filter((c) => c.is_active);
        }
      }
      return mockContentTypes.filter((c) => c.is_active).sort((a, b) => a.order_index - b.order_index);
    }, mockContentTypes.filter((c) => c.is_active));
  },
  /**
   * Get single content type by slug (Cached for 60s)
   */
  async getContentTypeBySlug(slug) {
    if (!slug) return null;
    return smartCache.wrap(`content_type:${slug}`, 60, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from("content_types").select("*").eq("slug", slug).eq("is_active", true).single();
          if (error) {
            return null;
          }
          return data;
        } catch (err) {
          console.error(`Supabase exception in getContentTypeBySlug (${slug}):`, err);
          return mockContentTypes.find((c) => c.slug === slug && c.is_active) || null;
        }
      }
      return mockContentTypes.find((c) => c.slug === slug && c.is_active) || null;
    }, null);
  },
  /**
   * Get weeks (Cached for 120s)
   */
  async getWeeks() {
    return smartCache.wrap("weeks:all", 120, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from("weeks").select("*").order("term").order("week_number");
          if (error) {
            console.error("Error fetching weeks:", error);
            return mockWeeks;
          }
          return data || [];
        } catch (err) {
          console.error("Supabase exception in getWeeks:", err);
          return mockWeeks;
        }
      }
      return mockWeeks;
    }, mockWeeks);
  },
  /**
   * Get published resources with optional filtering (Cached for 30s)
   */
  async getPublishedResources(filter) {
    const cacheKey = `resources:${filter?.subjectId || "all"}:${filter?.contentTypeId || "all"}:${filter?.limit || "all"}`;
    return smartCache.wrap(cacheKey, 30, async () => {
      if (isSupabaseConfigured) {
        try {
          let query = supabase.from("resources").select("*, subject:subjects(*), content_type:content_types(*), week:weeks(*)").eq("is_published", true).order("created_at", { ascending: false });
          if (filter?.subjectId) query = query.eq("subject_id", filter.subjectId);
          if (filter?.contentTypeId) query = query.eq("content_type_id", filter.contentTypeId);
          if (filter?.limit) query = query.limit(filter.limit);
          const { data, error } = await query;
          if (error) {
            console.error("Error fetching resources:", error);
            return [];
          }
          return data || [];
        } catch (err) {
          console.error("Supabase exception in getPublishedResources:", err);
          return [];
        }
      }
      let list = mockResources.filter((r) => r.is_published);
      if (filter?.subjectId) list = list.filter((r) => r.subject_id === filter.subjectId);
      if (filter?.contentTypeId) list = list.filter((r) => r.content_type_id === filter.contentTypeId);
      if (filter?.limit) list = list.slice(0, filter.limit);
      return list;
    }, []);
  },
  /**
   * Get single published resource by slug (Cached for 30s)
   */
  async getResourceBySlug(slug) {
    if (!slug) return null;
    return smartCache.wrap(`resource:${slug}`, 30, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from("resources").select("*, subject:subjects(*), content_type:content_types(*), week:weeks(*)").eq("slug", slug).eq("is_published", true).single();
          if (error) {
            return null;
          }
          return data;
        } catch (err) {
          console.error(`Supabase exception in getResourceBySlug (${slug}):`, err);
          return mockResources.find((r) => r.slug === slug && r.is_published) || null;
        }
      }
      return mockResources.find((r) => r.slug === slug && r.is_published) || null;
    }, null);
  },
  /**
   * Get ad slot config (Cached for 60s)
   */
  async getAdSlot(position) {
    if (!position) return null;
    return smartCache.wrap(`ad_slot:${position}`, 60, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.from("ad_slots").select("*").eq("position", position).eq("is_active", true).single();
          return data || null;
        } catch (err) {
          console.error(`Supabase exception in getAdSlot (${position}):`, err);
          return null;
        }
      }
      return {
        id: `slot-${position}`,
        name: position,
        position,
        is_active: true,
        slot_type: "google",
        created_at: "",
        updated_at: ""
      };
    }, null);
  },
  /**
   * Get direct ad for slot (Cached for 60s)
   */
  async getActiveDirectAdForSlot(position) {
    if (!position) return null;
    return smartCache.wrap(`direct_ad:${position}`, 60, async () => {
      if (isSupabaseConfigured) {
        try {
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const { data } = await supabase.from("direct_ads").select("*").eq("slot_position", position).eq("is_active", true).lte("start_date", now).gte("end_date", now).order("priority", { ascending: false }).limit(1).single();
          return data || null;
        } catch (err) {
          console.error(`Supabase exception in getActiveDirectAdForSlot (${position}):`, err);
          return null;
        }
      }
      return null;
    }, null);
  },
  /**
   * Manual cache purge helper
   */
  clearCache() {
    smartCache.invalidate();
  }
};

const $$Astro$1 = createAstro("https://thanaya.com");
const $$AdSlot = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$AdSlot;
  const { position } = Astro2.props;
  const slot = await publicApi.getAdSlot(position);
  const directAd = slot?.slot_type === "direct" ? await publicApi.getActiveDirectAdForSlot(position) : null;
  return renderTemplate`${slot && slot.is_active && renderTemplate`${maybeRenderHead()}<aside aria-label="مساحة إعلانية" class="w-full my-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition min-h-[100px] flex flex-col justify-between"${addAttribute(position, "data-ad-position")}><!-- Clear Disclosing Header --><div class="flex items-center justify-between px-4 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-medium"><span>إعلان معتمد</span><span>مساحة إعلانية</span></div><!-- Direct Ad Rendering -->${slot.slot_type === "direct" && directAd ? renderTemplate`<a${addAttribute(directAd.target_url, "href")} target="_blank" rel="noopener sponsored" class="block p-4 group text-center hover:bg-slate-50 transition"${addAttribute(directAd.id, "data-direct-ad-id")}>${directAd.image_url && renderTemplate`<img${addAttribute(directAd.image_url, "src")}${addAttribute(directAd.title, "alt")} loading="lazy" class="max-h-24 w-auto mx-auto rounded-lg object-contain">`}<div class="mt-2"><h4 class="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition">${directAd.title}</h4><span class="text-[10px] text-slate-400 mt-0.5 inline-block">
بواسطة: ${directAd.advertiser_name}</span></div></a>` : slot.slot_type === "google" ? renderTemplate`<!-- Google AdSense Container (Zero CLS Reserved Box) -->
        <div class="p-4 flex flex-col items-center justify-center min-h-[90px] text-center"><div class="text-xs text-slate-400"><!-- Google AdSense tag placeholder --><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"${addAttribute(slot.id, "data-ad-slot")} data-ad-format="auto" data-full-width-responsive="true"></ins><span class="text-[11px] text-slate-400 font-mono">Google Ads Area</span></div></div>` : renderTemplate`<!-- Platform Support Fallback Message -->
        <div class="p-5 text-center flex flex-col items-center justify-center space-y-1"><p class="text-xs sm:text-sm font-semibold text-slate-800">
منصة ثنايا مجانية لجميع طلاب مصر ❤️
</p><p class="text-[11px] text-slate-500">
الإعلانات تساعدنا في دفع تكاليف الاستضافة وتوفير كافة المذكرات والتقييمات للجميع.
</p></div>`}</aside>`}${renderScript($$result, "/home/omsa/Projects/thanaya/apps/web/src/components/AdSlot.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/omsa/Projects/thanaya/apps/web/src/components/AdSlot.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a, _b;
const $$Astro = createAstro("https://thanaya.com");
const $$Layout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Layout;
  const {
    title,
    description = "\u0645\u0646\u0635\u0629 \u062B\u0646\u0627\u064A\u0627 - \u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A\u0629 \u0648\u062D\u0644\u0648\u0644\u0647\u0627 \u0648\u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627 \u0627\u0644\u0645\u0635\u0631\u064A\u0629 \u0645\u062C\u0645\u0639\u0629 \u0648\u0645\u0646\u0638\u0645\u0629 \u0641\u064A \u0645\u0643\u0627\u0646 \u0648\u0627\u062D\u062F.",
    canonicalUrl = Astro2.url.href,
    ogType = "website",
    ogImage = "https://thanaya.com/og-image.png",
    jsonLd
  } = Astro2.props;
  const siteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "\u0645\u0646\u0635\u0629 \u062B\u0646\u0627\u064A\u0627 \u0644\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627 \u0627\u0644\u0645\u0635\u0631\u064A\u0629",
    url: "https://thanaya.com",
    description: "\u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0645\u0646\u0638\u0645\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A \u0648\u062D\u0644\u0648\u0644 \u0648\u0645\u0630\u0643\u0631\u0627\u062A \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627 \u0627\u0644\u0645\u0635\u0631\u064A\u0629.",
    inLanguage: "ar-EG"
  };
  return renderTemplate(_b || (_b = __template(['<html lang="ar" dir="rtl" class="scroll-smooth" data-astro-cid-sckkx6r4> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="generator"', "><!-- SEO Meta Tags --><title>", '</title><meta name="description"', '><link rel="canonical"', '><meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"><!-- Open Graph / Facebook --><meta property="og:type"', '><meta property="og:url"', '><meta property="og:title"', '><meta property="og:description"', '><meta property="og:site_name" content="\u0645\u0646\u0635\u0629 \u062B\u0646\u0627\u064A\u0627 \u0644\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627"><meta property="og:image"', '><meta property="og:locale" content="ar_EG"><!-- Twitter / X --><meta name="twitter:card" content="summary_large_image"><meta name="twitter:url"', '><meta name="twitter:title"', '><meta name="twitter:description"', '><meta name="twitter:image"', '><!-- Performance font preconnects --><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"><!-- Global JSON-LD Schema --><script type="application/ld+json">', "<\/script><!-- Page-Specific JSON-LD Schema (if provided) -->", "", '</head> <body class="bg-slate-50 text-slate-900 min-h-screen flex flex-col antialiased" data-astro-cid-sckkx6r4> <!-- Navbar --> <header class="bg-white border-b border-slate-200 sticky top-0 z-40" data-astro-cid-sckkx6r4> <div class="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between" data-astro-cid-sckkx6r4> <a href="/" class="flex items-center gap-2 text-xl font-extrabold text-slate-900 hover:text-emerald-700 transition" data-astro-cid-sckkx6r4> <span class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-base font-black" data-astro-cid-sckkx6r4>\n\u062B\n</span> <span data-astro-cid-sckkx6r4>\u062B\u0646\u0627\u064A\u0627</span> <span class="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold" data-astro-cid-sckkx6r4>\n\u0627\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627 \u0627\u0644\u0645\u0635\u0631\u064A\u0629\n</span> </a> <div class="flex items-center gap-4 text-xs font-semibold text-slate-600" data-astro-cid-sckkx6r4> <a href="/" class="hover:text-emerald-700 transition" data-astro-cid-sckkx6r4>\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629</a> </div> </div> </header> <!-- Main Content Container --> <main class="flex-1 max-w-5xl mx-auto px-4 py-8 w-full" data-astro-cid-sckkx6r4> ', ' </main> <!-- Footer Ad Slot --> <div class="max-w-5xl mx-auto px-4 w-full" data-astro-cid-sckkx6r4> ', ' </div> <!-- Footer --> <footer class="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-500 mt-auto" data-astro-cid-sckkx6r4> <div class="max-w-5xl mx-auto px-4 space-y-2" data-astro-cid-sckkx6r4> <p class="font-bold text-slate-700 text-sm" data-astro-cid-sckkx6r4>\u0645\u0646\u0635\u0629 \u062B\u0646\u0627\u064A\u0627 \u0627\u0644\u062A\u0639\u0644\u064A\u0645\u064A\u0629</p> <p data-astro-cid-sckkx6r4>\u0645\u0643\u062A\u0628\u0629 \u062A\u0646\u0638\u064A\u0645 \u0648\u062A\u0633\u0647\u064A\u0644 \u0648\u0635\u0648\u0644 \u062A\u0642\u064A\u064A\u0645\u0627\u062A \u0648\u062D\u0644\u0648\u0644 \u0648\u0645\u0630\u0643\u0631\u0627\u062A \u0627\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627 \u0627\u0644\u0645\u0635\u0631\u064A\u0629 \u0644\u062C\u0645\u064A\u0639 \u0627\u0644\u0637\u0644\u0627\u0628 \u0645\u062C\u0627\u0646\u064B\u0627 \u0648\u0628\u0623\u0639\u0644\u0649 \u0633\u0631\u0639\u0629.</p> <p class="text-slate-400 text-[11px] pt-2" data-astro-cid-sckkx6r4>\u062C\u0645\u064A\u0639 \u062D\u0642\u0648\u0642 \u0627\u0644\u0645\u0648\u0627\u062F \u0645\u062D\u0641\u0648\u0638\u0629 \u0644\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062A\u0631\u0628\u064A\u0629 \u0648\u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0627\u0644\u0645\u0635\u0631\u064A\u0629 \u0648\u0645\u0639\u062F\u064A\u0647\u0627.</p> </div> </footer> </body></html>'])), addAttribute(Astro2.generator, "content"), title, addAttribute(description, "content"), addAttribute(canonicalUrl, "href"), addAttribute(ogType, "content"), addAttribute(canonicalUrl, "content"), addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(ogImage, "content"), addAttribute(canonicalUrl, "content"), addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(ogImage, "content"), unescapeHTML(JSON.stringify(siteSchema)), jsonLd && renderTemplate(_a || (_a = __template(['<script type="application/ld+json">', "<\/script>"])), unescapeHTML(JSON.stringify(Array.isArray(jsonLd) ? jsonLd : jsonLd))), renderHead(), renderSlot($$result, $$slots["default"]), renderComponent($$result, "AdSlot", $$AdSlot, { "position": "footer", "data-astro-cid-sckkx6r4": true }));
}, "/home/omsa/Projects/thanaya/apps/web/src/layouts/Layout.astro", void 0);

export { $$Layout as $, $$AdSlot as a, publicApi as p };
