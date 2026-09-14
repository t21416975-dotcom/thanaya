import type { APIRoute } from 'astro';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { VAPID_PUBLIC_KEY } from '../../lib/push';

export const prerender = false;

// GET: Return public VAPID key
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ publicKey: VAPID_PUBLIC_KEY }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// POST: Save subscription
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { endpoint, keys } = body || {};

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return new Response(JSON.stringify({ error: 'بيانات الاشتراك غير مكتملة' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (isSupabaseConfigured) {
      // Upsert subscription
      const { error } = await (supabase.from('push_subscriptions') as any).upsert(
        {
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        { onConflict: 'endpoint' }
      );

      if (error) {
        console.error('[Push API] Error inserting subscription:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[Push API] Exception in push-subscribe:', err);
    return new Response(JSON.stringify({ error: err.message || 'خطأ في الخادم' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE: Remove subscription
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { endpoint } = body || {};

    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'Endpoint مطلوب' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (isSupabaseConfigured) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'خطأ في الخادم' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
