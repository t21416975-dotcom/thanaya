/**
 * ★ طبقة الحركة الخفيفة لواجهة "حسابي".
 *   - عدّاد تصاعدي للأرقام (data-count)
 *   - ظهور تدريجي للعناصر (data-reveal)
 *   - تفاعل تمرير الفأرة مع رسم الخط الزمني (data-trend)
 * كلها تحترم prefers-reduced-motion عبر CSS، وتُعاد تهيئتها مع انتقالات Astro.
 */

const EASE_OUT = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function countUp(el: HTMLElement) {
  if (el.dataset.counted === '1') return;
  el.dataset.counted = '1';

  const target = Number(el.dataset.count ?? '0');
  const decimals = Number(el.dataset.countDecimals ?? '0');
  const duration = Number(el.dataset.countDuration ?? '900');
  const suffix = el.dataset.countSuffix ?? '';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || duration <= 0) {
    el.textContent = target.toFixed(decimals) + suffix;
    return;
  }

  const start = performance.now();
  const step = (now: number) => {
    const t = clamp((now - start) / duration, 0, 1);
    const value = target * EASE_OUT(t);
    el.textContent = (decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString('en-US')) + suffix;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initReveal(root: ParentNode) {
  const items = root.querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal-done])');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => {
      el.dataset.revealDone = '1';
      el.classList.add('is-revealed');
    });
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        io.unobserve(el);
        el.dataset.revealDone = '1';
        // تأخير متدرّج ← إحساس "تسلسل" سلس بدل ظهور دفعة واحدة
        const delay = Number(el.dataset.revealDelay ?? '0');
        window.setTimeout(() => el.classList.add('is-revealed'), delay);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  items.forEach((el) => io.observe(el));
}

function initCounters(root: ParentNode) {
  const nums = root.querySelectorAll<HTMLElement>('[data-count]');
  if (!nums.length) return;

  if (!('IntersectionObserver' in window)) {
    nums.forEach(countUp);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        countUp(entry.target as HTMLElement);
      });
    },
    { threshold: 0.4 }
  );

  nums.forEach((el) => io.observe(el));
}

type TrendPoint = { x: number; y: number; label: string; value: string; raw: number };

function initTrendCharts(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-trend]').forEach((wrap) => {
    if (wrap.dataset.trendReady === '1') return;
    wrap.dataset.trendReady = '1';

    const svg = wrap.querySelector<SVGSVGElement>('svg');
    const tip = wrap.querySelector<HTMLElement>('[data-trend-tip]');
    const guide = wrap.querySelector<HTMLElement>('[data-trend-guide]');
    if (!svg || !tip) return;

    let points: TrendPoint[] = [];
    try {
      points = JSON.parse(wrap.dataset.points ?? '[]');
    } catch {
      return;
    }
    if (points.length < 2) return;

    const vbW = Number(wrap.dataset.vbW ?? '640');
    const padL = Number(wrap.dataset.padL ?? '8');
    const padR = Number(wrap.dataset.padR ?? '34');
    const plotW = vbW - padL - padR;

    const show = (index: number) => {
      const p = points[index];
      if (!p) return;
      const leftPct = clamp((p.x / vbW) * 100, 6, 94);
      tip.innerHTML = `<span class="block text-[10px] font-medium text-slate-400">${p.label}</span><span class="block text-sm font-bold text-slate-900">${p.value}</span>`;
      tip.style.left = `${leftPct}%`;
      tip.style.opacity = '1';
      if (guide) {
        guide.style.opacity = '1';
        guide.style.insetInlineStart = 'auto';
        guide.style.left = `${leftPct}%`;
      }
    };

    const hide = () => {
      tip.style.opacity = '0';
      if (guide) guide.style.opacity = '0';
    };

    const indexFromEvent = (clientX: number) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return -1;
      const vbX = ((clientX - rect.left) / rect.width) * vbW;
      const ratio = 1 - (vbX - padL) / plotW; // RTL: الأحدث يسارًا
      return clamp(Math.round(ratio * (points.length - 1)), 0, points.length - 1);
    };

    const onMove = (e: PointerEvent) => {
      const idx = indexFromEvent(e.clientX);
      if (idx >= 0) show(idx);
    };

    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerdown', onMove);
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('focusin', () => show(points.length - 1));
    svg.addEventListener('focusout', hide);
  });
}

export function initAccountMotion() {
  const root = document;
  initReveal(root);
  initCounters(root);
  initTrendCharts(root);
}
