import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  try {
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
          "script-src 'self' 'unsafe-inline' https://pl31266860.profitableratecpmnetwork.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          "frame-src 'self' https://drive.google.com https://www.youtube.com https://www.youtube-nocookie.com",
          "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com",
          "media-src 'self' https:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');
        response.headers.set('Content-Security-Policy', csp);

        // LOW-3: Reasonable cache-control stale window (300s instead of 86400s)
        if (context.request.method === 'GET' && response.status === 200) {
          response.headers.set(
            'Cache-Control',
            'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
          );
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
    return next();
  }
});
