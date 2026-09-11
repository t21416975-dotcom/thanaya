import { supabase } from './supabase';

const isLive =
  !!import.meta.env.PUBLIC_SUPABASE_URL &&
  import.meta.env.PUBLIC_SUPABASE_URL !== 'https://your-project.supabase.co';

/**
 * Records a page view for a resource with session deduplication
 */
export async function recordResourceView(resourceId: string): Promise<void> {
  if (!resourceId || typeof window === 'undefined') return;

  const sessionKey = `thanaya_view_${resourceId}`;
  if (sessionStorage.getItem(sessionKey)) {
    return; // Already counted in this browsing session
  }

  sessionStorage.setItem(sessionKey, '1');

  if (isLive) {
    try {
      await (supabase.rpc as any)('increment_resource_views', {
        p_resource_id: resourceId,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to increment view count:', err);
      }
    }
  }
}

/**
 * Records a PDF download with rate-limiting cooldown protection
 */
export async function recordResourceDownload(resourceId: string): Promise<void> {
  if (!resourceId || typeof window === 'undefined') return;

  const downloadKey = `thanaya_dl_${resourceId}`;
  const lastDownload = sessionStorage.getItem(downloadKey);
  const now = Date.now();

  // Cooldown: limit increments to once per 10 seconds per user session
  if (lastDownload && now - Number(lastDownload) < 10000) {
    return;
  }

  sessionStorage.setItem(downloadKey, String(now));

  if (isLive) {
    try {
      await (supabase.rpc as any)('increment_resource_downloads', {
        p_resource_id: resourceId,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to increment download count:', err);
      }
    }
  }
}
