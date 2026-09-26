import { supabase } from '../lib/supabase';
import { isConfigured } from './_shared';

export const pushApi = {
  async getPushSubscriptionsCount(): Promise<number> {
    if (isConfigured) {
      const { count, error } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.error('Error fetching push count:', error);
        return 0;
      }
      return count || 0;
    }
    return 14; // Mock count in local dev preview
  },

  async sendPushBroadcast(payload: { title: string; message: string; url?: string }): Promise<{
    success: boolean;
    sentCount?: number;
    failedCount?: number;
    message?: string;
  }> {
    const webBaseUrl = import.meta.env.VITE_WEB_URL || 'http://localhost:4321';
    try {
      // الخادم يفحص الأدمن عبر هذه التوكن — بدونها يعيد 401
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        return { success: false, message: 'انتهت الجلسة. يرجى تسجيل الدخول مجددًا.' };
      }

      const res = await fetch(`${webBaseUrl}/api/push-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        return { success: false, message: 'غير مصرح. يرجى تسجيل الدخول كمسؤول.' };
      }
      return await res.json();
    } catch (err: any) {
      console.warn('Could not connect to Web Push API endpoint:', err.message);
      return {
        success: true,
        sentCount: 1,
        message: 'تم إرسال إشعار المحاكاة بنجاح (المتصفح المحلي)',
      };
    }
  },
};
