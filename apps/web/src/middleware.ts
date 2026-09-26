import { defineMiddleware } from 'astro:middleware';
import { createServerSupabase } from './lib/auth-server';
import { isSupabaseConfigured } from './lib/supabase';

/**
 * المسارات التي تتطلّب جلسة طالب.
 * نمطها منطقي على مستوى المكوّنات (components) وليس regex،
 * لذلك التوسّع لاحقًا بسطر واحد.
 */
const PROTECTED_PREFIXES = ['/account', '/review'];

/** مسارات المصادقة نفسها — لا تحميها (وإلا حلقة إعادة توجيه). */
const AUTH_PREFIXES = ['/auth'];

function isProtected(pathname: string): boolean {
  if (AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    // ================================================================
    // 1) الجلسة: قراءة الكوكيز مرة واحدة وتمريرها عبر locals
    //    ★ لا نُنشئ صف طالب هنا — القراءة فقط (انظر /auth/callback).
    //      ذلك يحافظ على caching العام للصفحات العامة.
    // ================================================================
    let sessionUserId: string | null = null;

    if (isSupabaseConfigured && context.cookies.get('sb-access-token')) {
      try {
        const supabase = createServerSupabase(context);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        sessionUserId = user?.id ?? null;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Middleware: session read failed', err);
        }
      }
    }

    (context.locals as Record<string, unknown>).studentUserId = sessionUserId;
    (context.locals as Record<string, unknown>).isSignedIn = sessionUserId !== null;

    // ================================================================
    // 2) حماية المسارات
    // ================================================================
    if (isProtected(context.url.pathname) && !sessionUserId) {
      const returnTo = encodeURIComponent(context.url.pathname + context.url.search);
      return context.redirect(`/auth/login?returnTo=${returnTo}`, 302);
    }

    const response = await next();

    // Attach security and caching headers
    if (response) {
      try {
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'SAMEORIGIN');
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        // HIGH-1: Content Security Policy
        const csp = [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https:",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https:",
          "font-src 'self' https://fonts.gstatic.com data: https:",
          "img-src 'self' data: blob: https:",
          "frame-src 'self' https: data:",
          "connect-src 'self' https: wss:",
          "media-src 'self' https:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');
        response.headers.set('Content-Security-Policy', csp);

        // LOW-3: Reasonable cache-control stale window (300s instead of 86400s)
        // ★ لا تخزين مؤقت على المسارات المحمية (بيانات شخصية) ولا على
        //   أي طلب يحمل جلسة: نُبطل الكاش العام حتى لو مرّ الطلب من CDN.
        const isPrivate =
          isProtected(context.url.pathname) ||
          sessionUserId !== null ||
          context.request.method !== 'GET';

        if (context.request.method === 'GET' && response.status === 200 && !isPrivate) {
          response.headers.set(
            'Cache-Control',
            'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
          );
        } else if (isPrivate) {
          response.headers.set('Cache-Control', 'private, no-store, max-age=0');
        }
      } catch {
        // Headers might be immutable on certain stream responses
      }
    }

    return response;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Middleware execution caught error:', err);
    }
    // ★ نُعيد next() بعد تخطّي حمايتنا: طبقات الحماية أعلاه تبقى فعّالة،
    //   والمحتوى العام متاح دائمًا (لا يتحوّل خلل المصادقة إلى انقطاع موقع).
    return next();
  }
});
