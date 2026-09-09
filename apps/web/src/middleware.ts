import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Attach smart SWR caching headers to all public GET requests
  if (context.request.method === 'GET') {
    response.headers.set(
      'Cache-Control',
      'public, max-age=30, s-maxage=60, stale-while-revalidate=86400'
    );
  }

  return response;
});
