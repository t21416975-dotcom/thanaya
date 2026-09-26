import type { APIRoute } from 'astro';
import { createServerSupabase, json, assertSameOrigin } from '../../../lib/auth-server';
import { isSupabaseConfigured } from '../../../lib/supabase';

export const prerender = false;

/**
 * يبدأ تدفق Google OAuth.
 *
 * ★ returnTo يُقصَّى على مسار داخلي فقط:
 *   - يجب أن يبدأ بـ "/" (مسار داخلي)
 *   - لا يبدأ بـ "//" (م protocol-relative → موقع خارجي)
 *   خطأ شائع في تطبيقات OAuth: إعادة توجيه المهاجم إلى موقعه.
 *
 * ★ redirectTo لـ Google يُبنى من أصل الطلب نفسه، لذلك يجب أن يكون
 *   مسجّلًا في Supabase → Authentication → URL Configuration.
 */
export const GET: APIRoute = async (context) => {
  const returnTo = safeReturnTo(context.url.searchParams.get('returnTo'));
  const redirectTo = `${context.url.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;

  if (!isSupabaseConfigured) {
    return redirect(`/auth/login?error=not_configured`);
  }

  const supabase = createServerSupabase(context);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // select_account يعرض دائمًا شاشة اختيار الحساب (يمنع تسجيل دخول
      // تلقائي بالحساب الخطأ على جهاز مشترك).
      queryParams: { access_type: 'offline', prompt: 'select_account' },
    },
  });

  if (error || !data?.url) {
    return redirect(`/auth/login?error=${encodeURIComponent('oauth_failed')}`);
  }

  return redirect(data.url, 302);
};

/** تسجيل خروج: يقبل POST فقط (CSRF) ونتحقق من نفس الأصل. */
export const POST: APIRoute = async (context) => {
  if (!assertSameOrigin(context.request)) {
    return json({ error: 'طلب غير مصرح' }, 403);
  }

  if (isSupabaseConfigured) {
    const supabase = createServerSupabase(context);
    await supabase.auth.signOut();
  }

  // 303 (See Other) بعد POST → المتصفح يتبع بـ GET
  return context.redirect('/', 303);
};

function safeReturnTo(value: string | null): string {
  if (!value) return '/account';
  if (!value.startsWith('/')) return '/account';
  if (value.startsWith('//')) return '/account';
  if (value.includes('\\')) return '/account';
  return value;
}

function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { Location: location } });
}
