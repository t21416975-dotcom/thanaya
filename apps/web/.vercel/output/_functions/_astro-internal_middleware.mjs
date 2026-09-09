import { e as defineMiddleware, s as sequence } from './chunks/render-context_Jt9QGG72.mjs';
import 'es-module-lexer';
import './chunks/astro-designed-error-pages_DbnW0kOF.mjs';
import 'piccolore';
import './chunks/astro/server_Cs2yQakW.mjs';
import 'clsx';

const onRequest$1 = defineMiddleware(async (context, next) => {
  try {
    const response = await next();
    if (context.request.method === "GET" && response && response.status === 200) {
      try {
        response.headers.set(
          "Cache-Control",
          "public, max-age=30, s-maxage=60, stale-while-revalidate=86400"
        );
      } catch {
      }
    }
    return response;
  } catch (err) {
    console.error("Middleware execution caught error:", err);
    return next();
  }
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
