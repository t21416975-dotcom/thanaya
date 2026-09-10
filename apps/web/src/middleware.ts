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

        if (context.request.method === 'GET' && response.status === 200) {
          response.headers.set(
            'Cache-Control',
            'public, max-age=30, s-maxage=60, stale-while-revalidate=86400'
          );
        }
      } catch {
        // Headers might be immutable on certain stream responses
      }
    }

    return response;
  } catch (err) {
    console.error('Middleware execution caught error:', err);
    return next();
  }
});
