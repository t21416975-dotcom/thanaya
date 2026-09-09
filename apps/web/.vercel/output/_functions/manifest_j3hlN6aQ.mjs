import 'piccolore';
import { p as decodeKey } from './chunks/astro/server_Cs2yQakW.mjs';
import 'clsx';
import './chunks/astro-designed-error-pages_DbnW0kOF.mjs';
import 'es-module-lexer';
import { N as NOOP_MIDDLEWARE_FN } from './chunks/noop-middleware_BygsCWC5.mjs';

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///home/omsa/Projects/thanaya/apps/web/","cacheDir":"file:///home/omsa/Projects/thanaya/apps/web/node_modules/.astro/","outDir":"file:///home/omsa/Projects/thanaya/apps/web/dist/","srcDir":"file:///home/omsa/Projects/thanaya/apps/web/src/","publicDir":"file:///home/omsa/Projects/thanaya/apps/web/public/","buildClientDir":"file:///home/omsa/Projects/thanaya/apps/web/dist/client/","buildServerDir":"file:///home/omsa/Projects/thanaya/apps/web/dist/server/","adapterName":"@astrojs/vercel","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","component":"_server-islands.astro","params":["name"],"segments":[[{"content":"_server-islands","dynamic":false,"spread":false}],[{"content":"name","dynamic":true,"spread":false}]],"pattern":"^\\/_server-islands\\/([^/]+?)\\/?$","prerender":false,"isIndex":false,"fallbackRoutes":[],"route":"/_server-islands/[name]","origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image\\/?$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"../../node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.BZyp_xzt.css"}],"routeData":{"route":"/404","isIndex":false,"type":"page","pattern":"^\\/404\\/?$","segments":[[{"content":"404","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/404.astro","pathname":"/404","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.BZyp_xzt.css"}],"routeData":{"route":"/resources/[slug]","isIndex":false,"type":"page","pattern":"^\\/resources\\/([^/]+?)\\/?$","segments":[[{"content":"resources","dynamic":false,"spread":false}],[{"content":"slug","dynamic":true,"spread":false}]],"params":["slug"],"component":"src/pages/resources/[slug].astro","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.BZyp_xzt.css"}],"routeData":{"route":"/subjects/[subject]/[contenttype]","isIndex":false,"type":"page","pattern":"^\\/subjects\\/([^/]+?)\\/([^/]+?)\\/?$","segments":[[{"content":"subjects","dynamic":false,"spread":false}],[{"content":"subject","dynamic":true,"spread":false}],[{"content":"contentType","dynamic":true,"spread":false}]],"params":["subject","contentType"],"component":"src/pages/subjects/[subject]/[contentType].astro","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.BZyp_xzt.css"}],"routeData":{"route":"/subjects/[subject]","isIndex":false,"type":"page","pattern":"^\\/subjects\\/([^/]+?)\\/?$","segments":[[{"content":"subjects","dynamic":false,"spread":false}],[{"content":"subject","dynamic":true,"spread":false}]],"params":["subject"],"component":"src/pages/subjects/[subject].astro","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.BZyp_xzt.css"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}}],"site":"https://thanaya.com","base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["/home/omsa/Projects/thanaya/apps/web/src/pages/404.astro",{"propagation":"none","containsHead":true}],["/home/omsa/Projects/thanaya/apps/web/src/pages/index.astro",{"propagation":"none","containsHead":true}],["/home/omsa/Projects/thanaya/apps/web/src/pages/resources/[slug].astro",{"propagation":"none","containsHead":true}],["/home/omsa/Projects/thanaya/apps/web/src/pages/subjects/[subject].astro",{"propagation":"none","containsHead":true}],["/home/omsa/Projects/thanaya/apps/web/src/pages/subjects/[subject]/[contentType].astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener(\"change\",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000@astro-page:src/pages/404@_@astro":"pages/404.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astro-page:src/pages/resources/[slug]@_@astro":"pages/resources/_slug_.astro.mjs","\u0000@astro-page:src/pages/subjects/[subject]/[contentType]@_@astro":"pages/subjects/_subject_/_contenttype_.astro.mjs","\u0000@astro-page:src/pages/subjects/[subject]@_@astro":"pages/subjects/_subject_.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000astro-internal:middleware":"_astro-internal_middleware.mjs","\u0000virtual:astro:actions/noop-entrypoint":"noop-entrypoint.mjs","\u0000@astro-page:../../node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-manifest":"manifest_j3hlN6aQ.mjs","/home/omsa/Projects/thanaya/node_modules/astro/dist/assets/services/sharp.js":"chunks/sharp_BHEi020u.mjs","/home/omsa/Projects/thanaya/apps/web/src/components/AdSlot.astro?astro&type=script&index=0&lang.ts":"_astro/AdSlot.astro_astro_type_script_index_0_lang.CGNxywIe.js","/home/omsa/Projects/thanaya/apps/web/src/components/LazyYouTube.astro?astro&type=script&index=0&lang.ts":"_astro/LazyYouTube.astro_astro_type_script_index_0_lang.CDrf0TFV.js","/home/omsa/Projects/thanaya/apps/web/src/components/ReportProblemDialog.astro?astro&type=script&index=0&lang.ts":"_astro/ReportProblemDialog.astro_astro_type_script_index_0_lang.BymXLJAv.js","/home/omsa/Projects/thanaya/apps/web/src/pages/resources/[slug].astro?astro&type=script&index=0&lang.ts":"_astro/_slug_.astro_astro_type_script_index_0_lang.De-HoHMf.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[["/home/omsa/Projects/thanaya/apps/web/src/components/LazyYouTube.astro?astro&type=script&index=0&lang.ts","document.querySelectorAll(\"[data-youtube-facade]\").forEach(t=>{t.addEventListener(\"click\",()=>{const l=t.getAttribute(\"data-embed-url\");if(!l)return;const e=document.createElement(\"iframe\");e.src=`${l}?autoplay=1`,e.title=\"فيديو شرح المورد\",e.className=\"w-full h-full\",e.allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\",e.allowFullscreen=!0,t.innerHTML=\"\",t.appendChild(e)},{once:!0})});"]],"assets":["/_astro/index.BZyp_xzt.css","/robots.txt","/_astro/AdSlot.astro_astro_type_script_index_0_lang.CGNxywIe.js","/_astro/ReportProblemDialog.astro_astro_type_script_index_0_lang.BymXLJAv.js","/_astro/_slug_.astro_astro_type_script_index_0_lang.De-HoHMf.js","/_astro/supabase.gDVC3dZ-.js"],"buildFormat":"directory","checkOrigin":true,"allowedDomains":[],"actionBodySizeLimit":1048576,"serverIslandNameMap":[],"key":"dJlNDoZ1ewuasSiZprvjrPedW5v71KT1DZmQW5GZAKY="});
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = null;

export { manifest };
