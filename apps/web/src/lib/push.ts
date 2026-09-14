import webpush from 'web-push';

function getEnv(key: string, fallback: string): string {
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
  return fallback;
}

export const VAPID_PUBLIC_KEY = getEnv(
  'PUBLIC_VAPID_PUBLIC_KEY',
  'BIMOH53wqewI3MEItUAb8oXIL1i8PdlpW1VmXJl-Lacaal2_u152b5do_GlNQgm6hbw0LgbXAgu7RKNfXSWdCfY'
);

export const VAPID_PRIVATE_KEY = getEnv(
  'VAPID_PRIVATE_KEY',
  'ajK3alhuvx--eADREiHSmNRxeHlIVEvzjMzSffKCvM0'
);

export const VAPID_SUBJECT = getEnv('VAPID_SUBJECT', 'mailto:admin@thanaya.com');

// Initialize web-push details
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.error('[WebPush] Failed to set VAPID details:', err);
}

export { webpush };
