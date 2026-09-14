import type { APIRoute } from 'astro';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { webpush } from '../../lib/push';
import type { PushSubscriptionRecord } from '@thanaya/types';

export const prerender = false;

// Helper for CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
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
