import { e as createAstro, f as createComponent, m as maybeRenderHead, h as addAttribute, r as renderTemplate } from './astro/server_Cs2yQakW.mjs';
import 'piccolore';
import 'clsx';

const $$Astro = createAstro("https://thanaya.com");
const $$SubjectCard = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$SubjectCard;
  const { subject } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<a${addAttribute(`/subjects/${subject.slug}`, "href")} class="group block bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-500 hover:shadow-md transition duration-150"> <div class="flex items-start justify-between"> <div class="space-y-1.5"> <h3 class="font-bold text-slate-900 group-hover:text-emerald-700 transition text-base"> ${subject.name} </h3> ${subject.description && renderTemplate`<p class="text-xs text-slate-500 line-clamp-2 leading-relaxed"> ${subject.description} </p>`} </div> <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition"> <span class="text-sm font-bold">←</span> </div> </div> </a>`;
}, "/home/omsa/Projects/thanaya/apps/web/src/components/SubjectCard.astro", void 0);

export { $$SubjectCard as $ };
