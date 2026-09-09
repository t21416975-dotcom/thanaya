import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const response = await next();

    // Attach smart SWR caching headers to public HTML GET requests safely
    if (context.request.method === 'GET' && response && response.status === 200) {
      try {
        response.headers.set(
          'Cache-Control',
          'public, max-age=30, s-maxage=60, stale-while-revalidate=86400'
        );
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
