import { createClient } from '@supabase/supabase-js';
import type { APIRoute } from 'astro';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { webpush } from '../../lib/push';
import type { MyPermissions, PushSubscriptionRecord } from '@thanaya/types';

export const prerender = false;

// origins المسموح لها فقط: دومين لوحة الأدمن. لا '*' أبدًا — فجوة أمنية حرجة.
function getEnv(key: string): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return String(import.meta.env[key]).trim();
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return String(process.env[key]).trim();
    }
  } catch {}
  return '';
}

const ADMIN_ORIGINS = [getEnv('ADMIN_SITE_URL'), 'http://localhost:5173']
  .map((o) => o.replace(/\/+$/, ''))
  .filter(Boolean);

/** يرد بـ origin المسموح فقط (أو بدون رأس CORS إطلاقًا لمصدر غير مصرّح). */
function corsHeadersFor(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowed = origin && ADMIN_ORIGINS.includes(origin.replace(/\/+$/, '')) ? origin : null;
  if (!allowed) return {};
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

// Helper for CORS preflight
export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, { status: 204, headers: corsHeadersFor(request) });
};

/**
 * يتحقق من أن المستدعي أدمن مُفعّل حقيقي (نفس منهج admin-invite):
 * عميل بجلسة المستدعي (لا service_role) → get_user ثم get_my_permissions.
 */
async function isAuthorizedAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false;

  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return false;

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error: userError } = await caller.auth.getUser();
  if (userError || !data?.user) return false;

  const { data: perms, error: permError } = await caller.rpc('get_my_permissions');
  if (permError || !perms) return false;

  const p = perms as MyPermissions;
  return !!p.is_staff && p.is_active === true;
}

export const POST: APIRoute = async ({ request }) => {
  const corsHeaders = { 'Content-Type': 'application/json', ...corsHeadersFor(request) };

  try {
    // 1) المصادقة أولًا — قبل أي قراءة أو إرسال
    if (!(await isAuthorizedAdmin(request))) {
      return new Response(JSON.stringify({ error: 'غير مصرح. يرجى تسجيل الدخول كمسؤول.' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = await request.json();
    const { title, message, url, icon } = body || {};

    if (!title || !message) {
      return new Response(JSON.stringify({ error: 'العنوان ونص الإشعار مطلوبان' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!isSupabaseConfigured) {
      return new Response(
        JSON.stringify({
          success: true,
          mock: true,
          sentCount: 1,
          failedCount: 0,
          message: 'تم إرسال الإشعار بنجاح (وضع المعاينة المحلي)',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Fetch all active subscriptions from Supabase
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) {
      console.error('[Push API] Error fetching subscriptions:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const subscriptions = (data as unknown as PushSubscriptionRecord[]) || [];

    if (subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sentCount: 0,
          failedCount: 0,
          message: 'لا يوجد مشتركون في إشعارات المتصفح حالياً',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: url || '/',
      icon: icon || '/icon-192.png',
    });

    let sentCount = 0;
    let failedCount = 0;
    const expiredEndpoints: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          sentCount++;
        } catch (pushErr: any) {
          failedCount++;
          // If status is 404 or 410, subscription is no longer valid
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            expiredEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        failedCount,
        expiredCount: expiredEndpoints.length,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[Push API] Exception in push-send:', err);
    return new Response(JSON.stringify({ error: err.message || 'خطأ في إرسال الإشعارات' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};
