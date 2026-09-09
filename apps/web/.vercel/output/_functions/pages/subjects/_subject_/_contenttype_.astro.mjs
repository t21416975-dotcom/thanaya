/* empty css                                       */
import { e as createAstro, f as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead, h as addAttribute } from '../../../chunks/astro/server_Cs2yQakW.mjs';
import 'piccolore';
import { p as publicApi, $ as $$Layout, a as $$AdSlot } from '../../../chunks/Layout_DTFe-pFG.mjs';
import { $ as $$Breadcrumb } from '../../../chunks/Breadcrumb_BakRj-e9.mjs';
import { $ as $$ResourceCard } from '../../../chunks/ResourceCard_D1XGUdhT.mjs';
export { renderers } from '../../../renderers.mjs';

const $$Astro = createAstro("https://thanaya.com");
const $$contentType = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$contentType;
  const { subject: subjectSlug, contentType: contentTypeSlug } = Astro2.params;
  const subject = await publicApi.getSubjectBySlug(subjectSlug || "");
  const contentType = await publicApi.getContentTypeBySlug(contentTypeSlug || "");
  if (!subject || !contentType) {
    return Astro2.redirect("/404");
  }
  const resources = await publicApi.getPublishedResources({
    subjectId: subject.id,
    contentTypeId: contentType.id
  });
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": `${contentType.name} - ${subject.name} | \u0645\u0646\u0635\u0629 \u062B\u0646\u0627\u064A\u0627`, "description": `\u062A\u0635\u0641\u062D \u0648\u062A\u062D\u0645\u064A\u0644 ${contentType.name} \u0644\u0645\u0627\u062F\u0629 ${subject.name} \u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627 \u0627\u0644\u0645\u0635\u0631\u064A\u0629.` }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="space-y-8"> ${renderComponent($$result2, "Breadcrumb", $$Breadcrumb, { "items": [
    { label: subject.name, href: `/subjects/${subject.slug}` },
    { label: contentType.name }
  ] })}  <header class="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm"> <div class="space-y-2"> <div class="flex items-center gap-2"> <span class="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-100"> ${subject.name} </span> <span class="text-xs bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-full"> ${contentType.name} </span> </div> <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900"> ${contentType.name} في ${subject.name} </h1> ${contentType.description && renderTemplate`<p class="text-sm text-slate-600 max-w-2xl">${contentType.description}</p>`} </div> </header> ${renderComponent($$result2, "AdSlot", $$AdSlot, { "position": "subject_page" })}  <section class="space-y-4"> <div class="flex items-center justify-between"> <h2 class="text-lg font-bold text-slate-900">الملفات والموارد المتاحة</h2> <span class="text-xs text-slate-400">إجمالي: ${resources.length} ملف</span> </div> <div class="space-y-3"> ${resources.map((res) => renderTemplate`${renderComponent($$result2, "ResourceCard", $$ResourceCard, { "resource": res })}`)} ${resources.length === 0 && renderTemplate`<div class="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400"> <p class="text-sm">لا توجد ملفات مرفوعة في قسم (${contentType.name}) لمادة ${subject.name} حتى الآن.</p> <a${addAttribute(`/subjects/${subject.slug}`, "href")} class="inline-block mt-4 text-xs font-semibold text-emerald-700 hover:underline">
← العودة لصفحة مادة ${subject.name} </a> </div>`} </div> </section> </div> ` })}`;
}, "/home/omsa/Projects/thanaya/apps/web/src/pages/subjects/[subject]/[contentType].astro", void 0);

const $$file = "/home/omsa/Projects/thanaya/apps/web/src/pages/subjects/[subject]/[contentType].astro";
const $$url = "/subjects/[subject]/[contentType]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$contentType,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
