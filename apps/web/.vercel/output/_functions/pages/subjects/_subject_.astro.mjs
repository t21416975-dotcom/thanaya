/* empty css                                    */
import { e as createAstro, f as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead, h as addAttribute } from '../../chunks/astro/server_Cs2yQakW.mjs';
import 'piccolore';
import { p as publicApi, $ as $$Layout, a as $$AdSlot } from '../../chunks/Layout_B9en39FS.mjs';
import { $ as $$Breadcrumb } from '../../chunks/Breadcrumb_BakRj-e9.mjs';
import { $ as $$ResourceCard } from '../../chunks/ResourceCard_D1XGUdhT.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro("https://thanaya.com");
const $$subject = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$subject;
  const { subject: subjectSlug } = Astro2.params;
  const subject = await publicApi.getSubjectBySlug(subjectSlug || "");
  if (!subject) {
    return Astro2.redirect("/404");
  }
  const contentTypes = await publicApi.getActiveContentTypes();
  const resources = await publicApi.getPublishedResources({ subjectId: subject.id });
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": `${subject.name} | \u0645\u0646\u0635\u0629 \u062B\u0646\u0627\u064A\u0627`, "description": `\u062A\u0642\u064A\u064A\u0645\u0627\u062A \u0648\u062D\u0644\u0648\u0644 \u0648\u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A \u0645\u0627\u062F\u0629 ${subject.name} \u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627 \u0627\u0644\u0645\u0635\u0631\u064A\u0629.` }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="space-y-8"> ${renderComponent($$result2, "Breadcrumb", $$Breadcrumb, { "items": [{ label: subject.name }] })}  <header class="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm"> <div class="space-y-2"> <span class="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-100">
مادة دراسية
</span> <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900">${subject.name}</h1> ${subject.description && renderTemplate`<p class="text-sm text-slate-600 max-w-2xl">${subject.description}</p>`} </div> </header> ${renderComponent($$result2, "AdSlot", $$AdSlot, { "position": "subject_page" })}  <section class="space-y-4"> <div> <h2 class="text-lg font-bold text-slate-900">أقسام المحتوى لـ ${subject.name}</h2> <p class="text-xs text-slate-500">اختر نوع المحتوى المطلوب لتصفح الملفات المتاحة</p> </div> <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"> ${contentTypes.map((type) => {
    const typeCount = resources.filter((r) => r.content_type_id === type.id).length;
    return renderTemplate`<a${addAttribute(`/subjects/${subject.slug}/${type.slug}`, "href")} class="group bg-white rounded-xl border border-slate-200 p-5 hover:border-emerald-500 hover:shadow-sm transition flex flex-col justify-between"> <div class="space-y-1"> <h3 class="font-bold text-slate-900 group-hover:text-emerald-700 transition text-base"> ${type.name} </h3> ${type.description && renderTemplate`<p class="text-xs text-slate-500 line-clamp-2">${type.description}</p>`} </div> <div class="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs"> <span class="text-slate-400 font-medium">${typeCount} ملف</span> <span class="text-emerald-600 font-bold group-hover:translate-x-[-4px] transition">
تصفح القسم ←
</span> </div> </a>`;
  })} </div> </section>  <section class="space-y-4 pt-4"> <div class="flex items-center justify-between"> <div> <h2 class="text-lg font-bold text-slate-900">جميع تقييمات وملفات ${subject.name}</h2> <p class="text-xs text-slate-500">مرتبة من الأحدث إلى الأقدم</p> </div> <span class="text-xs text-slate-400">إجمالي: ${resources.length} مورد</span> </div> <div class="space-y-3"> ${resources.map((res) => renderTemplate`${renderComponent($$result2, "ResourceCard", $$ResourceCard, { "resource": res })}`)} ${resources.length === 0 && renderTemplate`<div class="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
لا توجد ملفات منشورة لهذه المادة حاليًا.
</div>`} </div> </section> </div> ` })}`;
}, "/home/omsa/Projects/thanaya/apps/web/src/pages/subjects/[subject].astro", void 0);

const $$file = "/home/omsa/Projects/thanaya/apps/web/src/pages/subjects/[subject].astro";
const $$url = "/subjects/[subject]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$subject,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
