import webpush from 'web-push';

function getEnv(key: string): string {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key]!;
    }
  } catch {}
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch {}
  return '';
}

// لا fallback مكتوب في الكود أبدًا — أي مفتاح هنا يُعتبر مكشوفًا في Git history.
// يجب أن تأتي المفاتيح من متغيرات البيئة فقط (Vercel / .env.local).
function requireEnv(key: string): string {
  const value = getEnv(key).trim();
  if (!value) {
    throw new Error(
      `[WebPush] متغير البيئة ${key} غير مضبوط. ` +
        `ولّد زوج مفاتيح جديدًا ثم اضبط ${key} في متغيرات بيئة النشر.`
    );
  }
  return value;
}

export const VAPID_PUBLIC_KEY = requireEnv('PUBLIC_VAPID_PUBLIC_KEY');
export const VAPID_PRIVATE_KEY = requireEnv('VAPID_PRIVATE_KEY');
export const VAPID_SUBJECT = getEnv('VAPID_SUBJECT') || 'mailto:admin@thanaya.com';

// Initialize web-push details
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.error('[WebPush] Failed to set VAPID details:', err);
}

export { webpush };
