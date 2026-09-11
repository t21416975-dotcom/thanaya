# Thanaya Platform — Pre-Publication Security Report
**Scan Date:** 2026-09-11 | **Scanner:** Antigravity (full manual static analysis)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 4 |
| 🟠 HIGH | 7 |
| 🟡 MEDIUM | 6 |
| 🔵 LOW / INFO | 5 |
| **Total** | **22** |

> [!CAUTION]
> Three CRITICAL findings must be fixed before publication. Two are in live npm CVEs affecting the deployed Astro version. One is a broken authentication bypass in the admin panel.

---

## 🔴 CRITICAL

---

### CRIT-1 — Astro CVE: Multiple XSS + RCE + SSRF in installed version

**File:** `apps/web/package.json` (astro dependency chain)
**CVE advisories:**
- `GHSA-j687-52p2-xcff` — XSS in `define:vars` via incomplete `</script>` tag sanitization
- `GHSA-jrpj-wcv7-9fh9` — XSS via unescaped spread attribute names
- `GHSA-f48w-9m4c-m7f5` — XSS via unescaped spread attribute names (incomplete prior fix)
- `GHSA-7pw4-f3q4-r2p2` — XSS via unescaped `transition:*` directive values on hydrated islands
- `GHSA-4g3v-8h47-v7g6` — Reflected XSS via unescaped View Transition animation properties
- `GHSA-8hv8-536x-4wqp` — Reflected XSS via unescaped slot name
- `GHSA-26w7-cxv4-gfx2` — **Remote Code Execution** through AVIF image optimization
- `GHSA-2pvr-wf23-7pc7` — **Host header SSRF** in prerendered error page fetch
- `GHSA-xr5h-phrj-8vxv` — Server island encrypted parameters vulnerable to cross-component replay
- `GHSA-376h-93r7-7g6f` — Authorization bypass from missing path-segment boundary check

**npm audit output:**
```
astro <=7.2.7
Severity: critical
fix available via `npm audit fix --force`
Will install astro@7.3.2
```

**Description:** The installed Astro version has 10 known CVEs including XSS, RCE via image processing, and SSRF. This is a **critical pre-publication blocker** — the site is SSR (`output: 'server'`) so all XSS vectors are live.

**Fix:**
```bash
npm audit fix --force
# Then verify build still works:
cd apps/web && npm run build
```

---

### CRIT-2 — Gemini API Key stored in plaintext in Supabase DB (world-readable via admin)

**File:** `apps/admin/src/components/AISettingsManager.tsx`, line 56–60  
**File:** `apps/web/src/pages/api/ai/extract-exam.ts`, line 101–105

**Evidence:**
```typescript
// AISettingsManager.tsx:56
await api.updateSystemSetting(
  'gemini_api_key',
  apiKey.trim(),
  'مفتاح Google Gemini API'
);
```
```typescript
// extract-exam.ts:101
const apiKeyRow = settings.find((s) => s.key === 'gemini_api_key');
if (!geminiApiKey && apiKeyRow?.value) geminiApiKey = apiKeyRow.value.trim();
```

**Description:** The Gemini API key is stored in the `system_settings` Supabase table in plaintext. Any compromised admin account, or a future RLS misconfiguration, exposes the key. The server-side API route reads it from the DB and uses it directly. The key has full Gemini API quota — an attacker with DB read access can rack up unlimited billing charges.

**Fix:** Store only in Vercel environment variables (`GEMINI_API_KEY`). Remove the `gemini_api_key` DB row. The fallback in `extract-exam.ts` to `process.env.GEMINI_API_KEY` is correct — use only that path.

---

### CRIT-3 — Admin auth bypass: any credentials accepted in demo/offline mode

**File:** `apps/admin/src/components/AuthLogin.tsx`, lines 28–35

**Evidence:**
```typescript
} else {
  // Local preview fallback authentication
  if (email === 'admin@thanaya.com' && password === 'admin123') {
    localStorage.setItem('thanaya_admin_session', 'mock_token');
  } else {
    // Allow any admin email for demo if entered or hint default credentials
    localStorage.setItem('thanaya_admin_session', 'mock_token');  // ← ANY credential accepted
  }
}
```

**Description:** When `VITE_SUPABASE_URL` is not set or equals the placeholder, the admin panel accepts **any email/password** and grants full admin access. If Vercel deployment ever has a missing env var (deployment error, preview env, etc.), this fallback activates and the admin panel is open to everyone.

**Fix:** Remove the fallback auth entirely. If Supabase is not configured, render an "Admin panel not configured" page instead of granting access.

```typescript
// Replace the else block with:
} else {
  throw new Error('لوحة التحكم غير مُهيأة. يرجى تعيين VITE_SUPABASE_URL في متغيرات البيئة.');
}
```

---

### CRIT-4 — `@astrojs/vercel` + `path-to-regexp` ReDoS + route override

**File:** `apps/web/package.json` (transitive via `@astrojs/vercel`)
**CVE:** `GHSA-9wv6-86v2-598j` (path-to-regexp backtracking), `GHSA-mr6q-rp88-fx84` (unauthenticated path override via `x-astro-path`)

**npm audit output:**
```
@astrojs/vercel *
Severity: high
Astro: Unauthenticated Path Override via `x-astro-path` / `x_astro_path`
fix: npm audit fix --force → @astrojs/vercel@11.0.10
```

**Description:** An attacker can send an HTTP request with `x-astro-path` header to override which route is served — potentially serving admin pages or bypassing middleware to unauthenticated users. Covered by the same `npm audit fix --force` as CRIT-1.

---

## 🟠 HIGH

---

### HIGH-1 — No Content Security Policy (CSP) header

**File:** `apps/web/src/middleware.ts`, `vercel.json`

**Description:** Neither the Astro middleware nor `vercel.json` sets a `Content-Security-Policy` header. With third-party ad scripts loaded (Adsterra `pl31266860.profitableratecpmnetwork.com`), XSS via a compromised ad network has no browser-side mitigation. The site uses `dangerouslySetInnerHTML`-equivalent `set:html` in components (none found currently) and dynamic `innerHTML` in exam JS — CSP would constrain these.

**Fix:** Add a CSP. Minimum viable for this app:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' pl31266860.profitableratecpmnetwork.com; frame-src 'self' drive.google.com; img-src 'self' data: *; connect-src 'self' *.supabase.co generativelanguage.googleapis.com;
```
Add to `vercel.json` headers block for `"source": "/(.*)"`.

> [!WARNING]
> `unsafe-inline` is required for the current inline scripts in the exam page. Long-term, move scripts to external files and use nonces.

---

### HIGH-2 — XSS via `innerHTML` with unsanitized DB content in exam page

**File:** `apps/web/src/pages/exams/[id].astro`, lines 411–421, 547–603

**Evidence:**
```javascript
// Line 411-421 — option text from DB inserted into innerHTML:
optCard.innerHTML = `
  ...
  <span class="text-sm font-semibold text-slate-800 flex-1 leading-relaxed">${optText}</span>
`;

// Line 585 — explanation from DB inserted into innerHTML:
<p class="leading-relaxed text-slate-700 font-medium">${q.explanation}</p>

// Line 597-598 — question text AND image_url from DB:
<h4 class="text-base font-bold text-slate-900 leading-relaxed">${q.question_text}</h4>
${q.image_url ? `<img src="${q.image_url}" ...>` : ''}
```

**Description:** All exam question content (`question_text`, `options[]`, `explanation`, `image_url`) is fetched from Supabase and injected via `innerHTML` **without sanitization**. An admin who stores `<script>alert(1)</script>` in a question will XSS every student who takes that exam. The `image_url` is also injected directly into an `<img src>` attribute — a javascript: URL would execute.

**Fix:** Use `textContent` for text fields, and validate `image_url` before use:
```javascript
// Instead of innerHTML string interpolation:
const span = document.createElement('span');
span.textContent = optText;  // Safe

// For image_url, validate before use:
const safeImageUrl = q.image_url && /^https?:\/\//.test(q.image_url) ? q.image_url : null;
```
Or use DOMPurify for the HTML blocks.

---

### HIGH-3 — `extract-exam` API endpoint has no authentication

**File:** `apps/web/src/pages/api/ai/extract-exam.ts`, line 25

**Description:** The `/api/ai/extract-exam` POST endpoint accepts PDF files and calls the Gemini API. There is **no authentication check** — any anonymous internet user can call this endpoint, upload arbitrary files, and consume the Gemini API quota. At scale, this causes denial-of-wallet attacks.

**Fix:** Add an auth check at the top of the handler:
```typescript
// Check Supabase session from request cookies
const { data: { session } } = await supabase.auth.getSession();
// Or verify a Bearer token from Authorization header
if (!session) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
// Then verify the user is an admin:
const { data: adminRow } = await supabase.from('admins').select('id').eq('id', session.user.id).single();
if (!adminRow) {
  return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
}
```

---

### HIGH-4 — No rate limiting on `extract-exam` API or report submission

**File:** `apps/web/src/pages/api/ai/extract-exam.ts`  
**File:** `apps/web/src/components/ReportProblemDialog.astro`

**Description:** The AI extraction endpoint accepts unlimited requests from any IP. The report submission endpoint (`supabase.from('reports').insert(...)`) also has no server-side rate limiting — the RLS policy (`WITH CHECK (true)`) allows unlimited anonymous inserts, enabling report spam that floods the admin panel.

**Fix for extract-exam:** Vercel rate limiting middleware, or check request count per IP using an edge KV store.
**Fix for reports:** Add a Supabase function to rate-limit inserts per IP per hour, or add a cooldown check on the server side.

---

### HIGH-5 — `sharp` library RCE/memory corruption vulnerabilities

**npm audit output:**
```
sharp <=0.35.4-rc.0
Severity: high  
CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 (libvips)
GHSA-g89c-p67h-r497, GHSA-2jg2-4ch7-h545 (libheif)
```

**Description:** Astro uses `sharp` for image optimization. The installed version has multiple high-severity memory corruption CVEs in the underlying libvips/libheif libraries. An attacker who can cause Astro to process a malicious image (via a crafted AVIF/HEIF file) could achieve RCE. Covered by the Astro upgrade.

---

### HIGH-6 — API key transmitted in client-side form to server endpoint

**File:** `apps/admin/src/lib/gemini.ts`, lines 138, 207–209

**Evidence:**
```typescript
// Line 138 — API key sent in FormData to the server endpoint:
if (apiKey) formData.append('api_key', apiKey);

// Line 207-209 — Direct client→Gemini call with API key in URL query param:
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
  modelName.trim()
)}:generateContent?key=${encodeURIComponent(activeKey.trim())}`;
```

**Description:** When the admin provides an API key in the UI, it's sent in the request body (FormData) which is fine, but also used for **direct client-side calls to the Gemini API with the key in the URL query string**. URL query parameters appear in browser history, server access logs, and any CDN/proxy logs. The key leaks.

**Fix:** Never put API keys in URL query parameters. Use the `Authorization: Bearer <key>` header instead:
```typescript
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${activeKey.trim()}`
  },
  body: JSON.stringify(body),
});
```

---

### HIGH-7 — `is_admin()` SECURITY DEFINER function — recursive RLS risk

**File:** `supabase/migrations/20260910000000_initial_schema.sql`, lines 22–29

**Evidence:**
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Description:** The `is_admin()` function is `SECURITY DEFINER` (runs as the function owner, bypassing RLS) and is called in every RLS policy. This is the correct pattern **only if** the `admins` table itself has tight RLS. Currently it does: only `is_admin()` can SELECT from `admins`, and only super_admins can INSERT/UPDATE. However, if the function is ever modified to query other tables, it could bypass their RLS. More critically: the `admins` table SELECT policy calls `is_admin()` which queries `admins` — this is fine in Postgres (no infinite recursion since SECURITY DEFINER skips RLS on the target table), but it's a pattern that should be documented.

**Recommendation:** Add a comment in the migration warning about this pattern. Consider using a direct auth.uid() check in a SECURITY DEFINER context without the function wrapper to reduce complexity.

---

## 🟡 MEDIUM

---

### MED-1 — Personal email address exposed in contact page placeholder

**File:** `apps/web/src/pages/contact.astro`, line 78

**Evidence:**
```html
<input placeholder="omar280sayed@gmail.com" .../>
```

**Description:** A personal Gmail address (`omar280sayed@gmail.com`) is hardcoded as the placeholder in the public contact form. This is likely the developer's personal email, exposed to scrapers.

**Fix:** Replace with a generic placeholder like `your@email.com` or `مثال@gmail.com`.

---

### MED-2 — Adsterra third-party ad script loaded without Subresource Integrity (SRI)

**File:** `apps/web/src/components/AdSlot.astro`, line 130

**Evidence:**
```html
<script async="async" data-cfasync="false" crossorigin="anonymous"
  src="https://pl31266860.profitableratecpmnetwork.com/ccae9d506cf77407ce62d684b21d33c5/invoke.js">
</script>
```

**Description:** The Adsterra script is loaded from a third-party CDN inside an iframe `srcdoc` without SRI. If the Adsterra CDN is compromised, the attacker controls script execution inside the iframe. While the iframe provides some sandboxing, `crossorigin="anonymous"` without SRI is still a supply chain risk. The iframe has no `sandbox` attribute either, so it inherits full scripting privileges.

**Fix:** Add `sandbox="allow-scripts allow-same-origin allow-popups"` to the iframe. SRI is not feasible for dynamic ad scripts, so sandboxing is the mitigation.

---

### MED-3 — `reports` table allows unlimited anonymous inserts with no data validation at DB level

**File:** `supabase/migrations/20260910000000_initial_schema.sql`, lines 293–296

**Evidence:**
```sql
CREATE POLICY "Public and users can submit reports"
    ON reports FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
```

**Description:** Anonymous users can insert unlimited rows into `reports`. While `issue_type` has a CHECK constraint, `details` is a free-text field with no length limit at the DB level. This enables: (1) spam flooding the admin's reports view, (2) storing large payloads in the DB.

**Fix:** Add a `details` length constraint in the migration:
```sql
ALTER TABLE reports ADD CONSTRAINT reports_details_length CHECK (char_length(details) <= 2000);
```
Add server-side rate limiting or a Supabase Edge Function as middleware.

---

### MED-4 — `esbuild` arbitrary file read vulnerability (dev server)

**npm audit output:**
```
esbuild 0.27.3 - 0.28.0
esbuild allows arbitrary file read when running the development server on Windows
Severity: low (but GHSA-g7r4-m6w7-qqqr)
```

**Description:** Only affects Windows dev servers. Not a production concern, but worth noting if any developer uses Windows.

---

### MED-5 — Admin panel has no server-side session validation on route load

**File:** `apps/admin/src/App.tsx`, lines 20–31

**Description:** The admin panel is a client-side React SPA. Auth is checked only at component mount via `supabase.auth.getSession()`. This is correct for SPAs (Supabase handles JWT verification server-side on every DB call), but there is no server-side guard on the `/admin` route itself — the admin panel HTML/JS is served to unauthenticated users. The JS bundle including all admin logic is publicly downloadable.

**Risk level:** Medium — attackers can read admin panel source code, enumerate all admin operations, and understand the data model. The actual data access is protected by RLS, but source enumeration aids targeted attacks.

**Fix:** Use Vercel's password protection or IP allowlisting for the admin subdomain if it's a separate deployment, or serve the admin panel from a non-guessable path.

---

### MED-6 — `questionsJson` injected via `set:html` into a JSON script tag

**File:** `apps/web/src/pages/exams/[id].astro`, line 276

**Evidence:**
```astro
<script is:inline type="application/json" id="exam-data" set:html={questionsJson}></script>
```

**Description:** `questionsJson` is `JSON.stringify(exam.questions)` from Supabase. If any question field contains the string `</script>`, it would break out of the script tag and allow XSS injection. JSON.stringify does NOT escape `</script>` — it produces the literal characters `<`, `/`, `s`, `c`, `r`, `i`, `p`, `t`, `>`.

**Evidence of risk:**
```javascript
JSON.stringify("</script><script>alert(1)</script>")
// → '"</script><script>alert(1)</script>"'
// This breaks the <script> tag context!
```

**Fix:** Escape forward slashes in JSON before injection:
```astro
const questionsJson = JSON.stringify(exam.questions).replace(/\//g, '\\/');
// Or better:
const questionsJson = JSON.stringify(exam.questions).replace(/<\//g, '<\\/');
```

---

## 🔵 LOW / INFO

---

### LOW-1 — `X-Frame-Options: SAMEORIGIN` does not protect iframe-embedded ad slots

**File:** `apps/web/src/middleware.ts`, line 11; `vercel.json`, line 32

**Description:** `X-Frame-Options: SAMEORIGIN` is set, which is correct. However the `AdSlot.astro` component renders an `<iframe srcdoc="...">` that loads a third-party ad script. This iframe has no `sandbox` attribute — it runs with full page privileges. Not a clickjacking issue (the header is correct for the main frame), but the unboxed iframe is a risk vector.

---

### LOW-2 — `privacy-policy.astro` is essentially empty

**File:** `apps/web/src/pages/privacy-policy.astro` (80 bytes)

**Description:** The file is nearly empty (80 bytes). A published educational platform serving Egyptian students (likely minors) needs a real privacy policy disclosing data collection, Supabase storage, Google Ads, Adsterra. Missing this creates legal exposure.

---

### LOW-3 — Cache-Control on GET responses is very permissive (`stale-while-revalidate=86400`)

**File:** `apps/web/src/middleware.ts`, lines 16–21

**Evidence:**
```typescript
response.headers.set(
  'Cache-Control',
  'public, max-age=30, s-maxage=60, stale-while-revalidate=86400'
);
```

**Description:** `stale-while-revalidate=86400` (24 hours) means CDN/proxy can serve 24-hour-old content after the 60s `s-maxage` expires. For an educational platform where exam answers or resources are updated, students could receive outdated content for up to 24 hours without knowing. Not a direct security vulnerability but a data integrity concern.

---

### LOW-4 — `googlece63fa79ba774bb2.html` Google Search Console verification file exposed

**File:** `apps/web/public/googlece63fa79ba774bb2.html`

**Description:** Google Search Console verification file is committed to the repo and publicly accessible. This is intentional and harmless by design — the file only proves domain ownership. No action needed, but confirm this is the intended verification method.

---

### LOW-5 — `console.error` logging in production leaks internal error details

**File:** `apps/web/src/lib/api.ts` (multiple lines), `apps/web/src/lib/analytics.ts`, `apps/admin/src/lib/gemini.ts`

**Evidence:**
```typescript
// api.ts line 173:
console.error('Error fetching subjects from Supabase:', error);
// gemini.ts line 298:
console.error('Direct Gemini extraction failed:', directErr);
```

**Description:** `console.error` statements in production expose internal Supabase error messages and stack traces in the browser console, visible to any user who opens DevTools. Supabase errors can reveal table names, query structures, and row-level security failures.

**Fix:** In production builds, replace `console.error` with a structured logging service (Sentry, LogRocket) or suppress non-critical errors entirely.

---

## Summary — Action Priority

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | Upgrade Astro (`npm audit fix --force`) | CRITICAL | 30 min |
| 2 | Remove admin auth bypass fallback | CRITICAL | 15 min |
| 3 | Remove Gemini API key from DB | CRITICAL | 30 min |
| 4 | Add auth check to `/api/ai/extract-exam` | CRITICAL | 1 hr |
| 5 | Fix `innerHTML` XSS in exam page | HIGH | 2 hrs |
| 6 | Fix API key in URL query param (Gemini calls) | HIGH | 30 min |
| 7 | Fix `</script>` injection in questionsJson | MEDIUM | 10 min |
| 8 | Add CSP header | HIGH | 1 hr |
| 9 | Add rate limiting to reports + AI endpoint | HIGH | 2 hrs |
| 10 | Add sandbox to Adsterra iframe | MEDIUM | 15 min |
| 11 | Remove personal email from placeholder | MEDIUM | 5 min |
| 12 | Add DB-level length constraint on reports.details | MEDIUM | 10 min |
| 13 | Write real privacy policy | LOW/Legal | — |

> [!IMPORTANT]
> Items 1–4 are **must-fix before publication**. Items 5–9 are **strongly recommended**. Items 10–13 can follow in first patch.
