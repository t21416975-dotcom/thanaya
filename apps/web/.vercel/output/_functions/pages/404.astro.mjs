/* empty css                                 */
import { f as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_Cs2yQakW.mjs';
import 'piccolore';
import { p as publicApi, $ as $$Layout } from '../chunks/Layout_B9en39FS.mjs';
import { $ as $$SubjectCard } from '../chunks/SubjectCard_CIjTUpp-.mjs';
export { renderers } from '../renderers.mjs';

const $$404 = createComponent(async ($$result, $$props, $$slots) => {
  const subjects = await publicApi.getActiveSubjects();
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "\u0627\u0644\u0635\u0641\u062D\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 404 | \u0645\u0646\u0635\u0629 \u062B\u0646\u0627\u064A\u0627" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="max-w-3xl mx-auto text-center py-12 space-y-8"> <div class="space-y-4"> <span class="inline-block text-6xl font-black text-emerald-600 bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100">
404
</span> <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900">
عفوًا، الصفحة أو الملف غير موجود
</h1> <p class="text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
قد يكون الرابط خاطئًا أو تم نقل التقييم إلى قسم آخر. يمكنك العودة للصفحة الرئيسية أو اختيار مادتك مباشرة من الأسفل:
</p> <div class="pt-2"> <a href="/" class="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition text-sm">
العودة للصفحة الرئيسية
</a> </div> </div>  ${subjects.length > 0 && renderTemplate`<div class="pt-8 border-t border-slate-200 text-right space-y-4"> <h2 class="text-lg font-bold text-slate-800">
تصفح المواد الدراسية مباشرة:
</h2> <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"> ${subjects.map((subj) => renderTemplate`${renderComponent($$result2, "SubjectCard", $$SubjectCard, { "subject": subj })}`)} </div> </div>`} </div> ` })}`;
}, "/home/omsa/Projects/thanaya/apps/web/src/pages/404.astro", void 0);

const $$file = "/home/omsa/Projects/thanaya/apps/web/src/pages/404.astro";
const $$url = "/404";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$404,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
