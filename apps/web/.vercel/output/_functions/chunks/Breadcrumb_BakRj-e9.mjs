import { e as createAstro, f as createComponent, m as maybeRenderHead, h as addAttribute, r as renderTemplate } from './astro/server_Cs2yQakW.mjs';
import 'piccolore';
import 'clsx';

const $$Astro = createAstro("https://thanaya.com");
const $$Breadcrumb = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Breadcrumb;
  const { items } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<nav aria-label="مسار التنقل" class="flex items-center text-xs text-slate-500 mb-6 flex-wrap gap-1.5 font-medium"> <a href="/" class="hover:text-emerald-700 transition flex items-center gap-1"> <span>الرئيسية</span> </a> ${items.map((item, index) => renderTemplate`<div class="flex items-center gap-1.5"> <span class="text-slate-300">/</span> ${item.href && index < items.length - 1 ? renderTemplate`<a${addAttribute(item.href, "href")} class="hover:text-emerald-700 transition"> ${item.label} </a>` : renderTemplate`<span class="text-slate-800 font-semibold">${item.label}</span>`} </div>`)} </nav>`;
}, "/home/omsa/Projects/thanaya/apps/web/src/components/Breadcrumb.astro", void 0);

export { $$Breadcrumb as $ };
