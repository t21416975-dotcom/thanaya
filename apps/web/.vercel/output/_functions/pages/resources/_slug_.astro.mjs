/* empty css                                    */
import { e as createAstro, f as createComponent, m as maybeRenderHead, h as addAttribute, r as renderTemplate, l as renderScript, k as renderComponent } from '../../chunks/astro/server_Cs2yQakW.mjs';
import 'piccolore';
import { p as publicApi, $ as $$Layout, a as $$AdSlot } from '../../chunks/Layout_B9en39FS.mjs';
import { $ as $$Breadcrumb } from '../../chunks/Breadcrumb_BakRj-e9.mjs';
import 'clsx';
import { $ as $$ResourceCard } from '../../chunks/ResourceCard_D1XGUdhT.mjs';
export { renderers } from '../../renderers.mjs';

function extractYouTubeVideoId(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = trimmed.match(regExp);
  return match && match[1] ? match[1] : null;
}
function getYouTubeEmbedUrl(urlOrId) {
  const videoId = extractYouTubeVideoId(urlOrId) || (urlOrId.length === 11 ? urlOrId : null);
  if (!videoId) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

const $$Astro$2 = createAstro("https://thanaya.com");
const $$LazyYouTube = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$LazyYouTube;
  const { url, title = "\u0641\u064A\u062F\u064A\u0648 \u0634\u0631\u062D \u0648\u062D\u0644 \u0627\u0644\u062A\u0642\u064A\u064A\u0645" } = Astro2.props;
  const videoId = extractYouTubeVideoId(url);
  const embedUrl = getYouTubeEmbedUrl(url);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  return renderTemplate`${embedUrl && renderTemplate`${maybeRenderHead()}<div class="space-y-3"><div class="flex items-center justify-between"><h3 class="font-bold text-slate-900 text-base flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-red-600 inline-block"></span><span>${title}</span></h3><span class="text-xs text-slate-400">مشاهدة مباشرة بدون إعلانات خارج المنصة</span></div><div class="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 shadow-sm group" data-youtube-facade${addAttribute(embedUrl, "data-embed-url")}>${thumbnailUrl && renderTemplate`<img${addAttribute(thumbnailUrl, "src")}${addAttribute(title, "alt")} loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300 opacity-90">`}<button type="button" class="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition cursor-pointer"${addAttribute(`\u062A\u0634\u063A\u064A\u0644 ${title}`, "aria-label")}><div class="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition"><svg class="w-7 h-7 fill-current translate-x-[-2px]" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg></div></button></div></div>`}${renderScript($$result, "/home/omsa/Projects/thanaya/apps/web/src/components/LazyYouTube.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/omsa/Projects/thanaya/apps/web/src/components/LazyYouTube.astro", void 0);

const $$Astro$1 = createAstro("https://thanaya.com");
const $$ReportProblemDialog = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$ReportProblemDialog;
  const { resourceId, resourceTitle } = Astro2.props;
  return renderTemplate`<!-- Trigger Button -->${maybeRenderHead()}<button type="button" id="open-report-dialog" class="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 transition font-medium px-3 py-1.5 rounded-lg hover:bg-rose-50 border border-slate-200"> <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"> <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path> <line x1="4" y1="22" x2="4" y2="15"></line> </svg> <span>الإبلاغ عن مشكلة في الملف</span> </button> <!-- Native Accessible Dialog --> <dialog id="report-dialog" class="backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm rounded-2xl p-0 border border-slate-200 shadow-2xl max-w-md w-full text-right"> <div class="bg-white p-6 space-y-4"> <div class="flex items-center justify-between border-b border-slate-100 pb-3"> <h3 class="font-bold text-base text-slate-900">الإبلاغ عن مشكلة</h3> <button type="button" id="close-report-dialog" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
✕
</button> </div> <p class="text-xs text-slate-500">
المورد: <strong class="text-slate-800">${resourceTitle}</strong> </p> <form id="report-form" class="space-y-4"${addAttribute(resourceId, "data-resource-id")}> <div> <label class="block text-xs font-semibold text-slate-700 mb-1">نوع المشكلة *</label> <select name="issue_type" required class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"> <option value="broken_file">الملف تالف أو لا يفتح</option> <option value="broken_link">رابط التحميل لا يعمل</option> <option value="incorrect_content">المحتوى خاطئ علميًا أو به نقص</option> <option value="outdated">المحتوى قديم / لا يطابق منهج العام الحالي</option> <option value="other">مشكلة أخرى</option> </select> </div> <div> <label class="block text-xs font-semibold text-slate-700 mb-1">تفاصيل إضافية (اختياري)</label> <textarea name="details"${addAttribute(3, "rows")} placeholder="وضح المشكلة لمساعدتنا في إصلاحها بأسرع وقت..." class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"></textarea> </div> <div id="report-status" class="hidden text-xs p-2 rounded-lg"></div> <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100"> <button type="button" id="cancel-report" class="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
إلغاء
</button> <button type="submit" id="submit-report" class="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition">
إرسال البلاغ
</button> </div> </form> </div> </dialog> ${renderScript($$result, "/home/omsa/Projects/thanaya/apps/web/src/components/ReportProblemDialog.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/omsa/Projects/thanaya/apps/web/src/components/ReportProblemDialog.astro", void 0);

const $$Astro = createAstro("https://thanaya.com");
const $$slug = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$slug;
  const { slug } = Astro2.params;
  const resource = await publicApi.getResourceBySlug(slug || "");
  if (!resource) {
    return Astro2.redirect("/404");
  }
  const relatedResources = await publicApi.getPublishedResources({
    subjectId: resource.subject_id,
    contentTypeId: resource.content_type_id,
    limit: 4
  });
  const filteredRelated = relatedResources.filter((r) => r.id !== resource.id).slice(0, 3);
  const pageTitle = `${resource.title} | ${resource.subject?.name || ""} \u062B\u0627\u0646\u0648\u064A\u0629 \u0639\u0627\u0645\u0629 \u0648\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627`;
  const pageDescription = resource.description || `\u062A\u062D\u0645\u064A\u0644 \u0648\u0645\u0639\u0627\u064A\u0646\u0629 ${resource.title} \u0641\u064A \u0645\u0627\u062F\u0629 ${resource.subject?.name || ""} (${resource.content_type?.name || "\u0645\u0648\u0631\u062F \u062A\u0639\u0644\u064A\u0645\u064A"}) \u0628\u0635\u064A\u063A\u0629 PDF \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0639 \u062D\u0644\u0648\u0644 \u0648\u0634\u0631\u062D \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627 \u0627\u0644\u0645\u0635\u0631\u064A\u0629.`;
  const currentUrl = `https://thanaya.com/resources/${resource.slug}`;
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629",
        item: "https://thanaya.com"
      },
      ...resource.subject ? [
        {
          "@type": "ListItem",
          position: 2,
          name: resource.subject.name,
          item: `https://thanaya.com/subjects/${resource.subject.slug}`
        }
      ] : [],
      ...resource.subject && resource.content_type ? [
        {
          "@type": "ListItem",
          position: 3,
          name: resource.content_type.name,
          item: `https://thanaya.com/subjects/${resource.subject.slug}/${resource.content_type.slug}`
        }
      ] : [],
      {
        "@type": "ListItem",
        position: resource.subject && resource.content_type ? 4 : 2,
        name: resource.title,
        item: currentUrl
      }
    ]
  };
  const learningResourceSchema = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: resource.title,
    description: pageDescription,
    educationalLevel: "\u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 / \u0627\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627 \u0627\u0644\u0645\u0635\u0631\u064A\u0629",
    learningResourceType: resource.content_type?.name || "\u062A\u0642\u064A\u064A\u0645 \u0623\u0633\u0628\u0648\u0639\u064A",
    inLanguage: "ar-EG",
    url: currentUrl,
    datePublished: resource.published_at || resource.created_at,
    dateModified: resource.updated_at || resource.created_at,
    isAccessibleForFree: true,
    provider: {
      "@type": "Organization",
      name: "\u0645\u0646\u0635\u0629 \u062B\u0646\u0627\u064A\u0627 \u0627\u0644\u062A\u0639\u0644\u064A\u0645\u064A\u0629",
      url: "https://thanaya.com"
    }
  };
  const jsonLd = [breadcrumbSchema, learningResourceSchema];
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": pageTitle, "description": pageDescription, "canonicalUrl": currentUrl, "ogType": "article", "jsonLd": jsonLd }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="space-y-8 max-w-4xl mx-auto"> ${renderComponent($$result2, "Breadcrumb", $$Breadcrumb, { "items": [
    ...resource.subject ? [{ label: resource.subject.name, href: `/subjects/${resource.subject.slug}` }] : [],
    ...resource.subject && resource.content_type ? [{ label: resource.content_type.name, href: `/subjects/${resource.subject.slug}/${resource.content_type.slug}` }] : [],
    { label: resource.title }
  ] })}  <article class="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6"> <div class="space-y-3">  <div class="flex items-center gap-2 flex-wrap text-xs"> ${resource.subject && renderTemplate`<a${addAttribute(`/subjects/${resource.subject.slug}`, "href")} class="bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full hover:bg-emerald-100 transition border border-emerald-100"> ${resource.subject.name} </a>`} ${resource.content_type && renderTemplate`<span class="bg-slate-100 text-slate-700 font-semibold px-3 py-1 rounded-full"> ${resource.content_type.name} </span>`} ${resource.week && renderTemplate`<span class="bg-slate-100 text-slate-700 font-semibold px-3 py-1 rounded-full"> ${resource.week.title} </span>`} </div>  <h1 class="text-2xl sm:text-3xl font-black text-slate-900 leading-tight"> ${resource.title} </h1>  ${resource.description && renderTemplate`<p class="text-sm sm:text-base text-slate-600 leading-relaxed pt-1"> ${resource.description} </p>`} </div>  <div class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">  <a${addAttribute(resource.pdf_url, "href")} target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3.5 rounded-xl text-sm transition shadow-sm hover:shadow active:scale-[0.99]" id="direct-download-btn"${addAttribute(resource.id, "data-resource-id")}> <svg class="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24"> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path> <polyline points="7 10 12 15 17 10"></polyline> <line x1="12" y1="15" x2="12" y2="3"></line> </svg> <span>تحميل ملف الـ PDF المباشر</span> </a>  <div class="flex items-center gap-2 self-center sm:self-auto flex-wrap">  <button type="button" id="copy-link-btn" class="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 font-medium px-3.5 py-2.5 rounded-lg transition cursor-pointer"> <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"> <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path> <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path> </svg> <span id="copy-btn-text">نسخ الرابط</span> </button>  <a${addAttribute(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${resource.title}
${currentUrl}`)}`, "href")} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-semibold px-3.5 py-2.5 rounded-lg transition" title="مشاركة عبر واتساب"> <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"> <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"></path> </svg> <span>مشاركة</span> </a>  ${renderComponent($$result2, "ReportProblemDialog", $$ReportProblemDialog, { "resourceId": resource.id, "resourceTitle": resource.title })} </div> </div> </article>  ${renderComponent($$result2, "AdSlot", $$AdSlot, { "position": "resource_after_meta" })}  <section class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm"> <div class="flex items-center justify-between"> <h3 class="font-bold text-slate-900 text-base flex items-center gap-2"> <svg class="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"> <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path> <polyline points="14 2 14 8 20 8"></polyline> <line x1="16" y1="13" x2="8" y2="13"></line> <line x1="16" y1="17" x2="8" y2="17"></line> <polyline points="10 9 9 9 8 9"></polyline> </svg> <span>معاينة ملف الـ PDF</span> </h3> <a${addAttribute(resource.pdf_url, "href")} target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"> <span>فتح في نافذة كاملة</span> <span>↗</span> </a> </div> <!-- Native Browser PDF Embed Frame --> <div class="w-full h-[650px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex flex-col items-center justify-center"> <object${addAttribute(resource.pdf_url, "data")} type="application/pdf" class="w-full h-full"> <div class="p-8 text-center space-y-3"> <p class="text-sm text-slate-600">
متصفحك لا يدعم معاينة ملف الـ PDF مباشرة داخل الصفحة.
</p> <a${addAttribute(resource.pdf_url, "href")} target="_blank" rel="noopener noreferrer" class="inline-block px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold">
انقر هنا لتحميل أو فتح الملف مباشرة
</a> </div> </object> </div> </section>  ${resource.youtube_url && renderTemplate`<section class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"> ${renderComponent($$result2, "LazyYouTube", $$LazyYouTube, { "url": resource.youtube_url, "title": `\u0641\u064A\u062F\u064A\u0648 \u0634\u0631\u062D: ${resource.title}` })} </section>`}  ${filteredRelated.length > 0 && renderTemplate`<section class="space-y-4 pt-4"> <h3 class="font-bold text-slate-900 text-lg">تقييمات وملفات ذات صلة</h3> <div class="space-y-3"> ${filteredRelated.map((rel) => renderTemplate`${renderComponent($$result2, "ResourceCard", $$ResourceCard, { "resource": rel })}`)} </div> </section>`} </div> ` })} ${renderScript($$result, "/home/omsa/Projects/thanaya/apps/web/src/pages/resources/[slug].astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/omsa/Projects/thanaya/apps/web/src/pages/resources/[slug].astro", void 0);

const $$file = "/home/omsa/Projects/thanaya/apps/web/src/pages/resources/[slug].astro";
const $$url = "/resources/[slug]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$slug,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
