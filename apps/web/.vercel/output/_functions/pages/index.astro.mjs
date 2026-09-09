/* empty css                                 */
import { f as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_Cs2yQakW.mjs';
import 'piccolore';
import { p as publicApi, $ as $$Layout, a as $$AdSlot } from '../chunks/Layout_DTFe-pFG.mjs';
import { $ as $$SubjectCard } from '../chunks/SubjectCard_CIjTUpp-.mjs';
import { $ as $$ResourceCard } from '../chunks/ResourceCard_D1XGUdhT.mjs';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const subjects = await publicApi.getActiveSubjects();
  const latestAssessments = await publicApi.getPublishedResources({ limit: 6 });
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "\u0645\u0646\u0635\u0629 \u062B\u0646\u0627\u064A\u0627 | \u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A \u0648\u0627\u0644\u062D\u0644\u0648\u0644 \u0648\u0627\u0644\u0645\u0630\u0643\u0631\u0627\u062A \u0644\u0644\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0627 \u0627\u0644\u0645\u0635\u0631\u064A\u0629" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="space-y-10">  <section class="text-center py-10 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm"> <div class="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold mb-4 border border-emerald-100"> <span>دفعة الثانوية العامة والبكالوريا</span> </div> <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
التقييمات كلها في مكان واحد
</h1> <p class="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
تصفح وتحميل مباشر وسريع للتقييمات الأسبوعية، نماذج الإجابة، الامتحانات التجريبية، والمذكرات
        بدون إعلانات مزعجة وبأعلى سرعة ممكنة.
</p> </section>  ${renderComponent($$result2, "AdSlot", $$AdSlot, { "position": "homepage_top" })}  <section class="space-y-4"> <div class="flex items-center justify-between"> <div> <h2 class="text-xl font-bold text-slate-900">المواد الدراسية</h2> <p class="text-xs text-slate-500">اختر المادة لتصفح تقييماتها ومذكراتها مرتبة بالأسابيع</p> </div> </div> <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"> ${subjects.map((subj) => renderTemplate`${renderComponent($$result2, "SubjectCard", $$SubjectCard, { "subject": subj })}`)} </div> </section>  ${renderComponent($$result2, "AdSlot", $$AdSlot, { "position": "homepage_middle" })}  <section class="space-y-4"> <div> <h2 class="text-xl font-bold text-slate-900">أحدث التقييمات والموارد المضافة</h2> <p class="text-xs text-slate-500">وصول مباشر لأحدث الملفات المرفوعة على المنصة</p> </div> <div class="space-y-3"> ${latestAssessments.map((res) => renderTemplate`${renderComponent($$result2, "ResourceCard", $$ResourceCard, { "resource": res })}`)} ${latestAssessments.length === 0 && renderTemplate`<div class="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
جاري إضافة الموارد والتقييمات قريبًا.
</div>`} </div> </section> </div> ` })}`;
}, "/home/omsa/Projects/thanaya/apps/web/src/pages/index.astro", void 0);

const $$file = "/home/omsa/Projects/thanaya/apps/web/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
