import type { APIRoute } from 'astro';
import { createServerSupabase, json, assertSameOrigin } from '../../../lib/auth-server';
import { isSupabaseConfigured } from '../../../lib/supabase';
import type { StartAttemptResult } from '@thanaya/types';

export const prerender = false;

/** أقصى حجم مقبول لطلب JSON (يُرفض أكبر منه مبكرًا). */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * بدء محاولة امتحان على السيرفر.
 *
 * ★ هذا هو مصدر "محاولة" واحد فقط لكل (طالب + امتحان) مفتوحة؛ الاستئناف
 *   يعيد المحاولة نفسها بدل إنشاء جديد (is_new = false).
 *
 * ★ يطلب origin مطابقًا لمنع CSRF: الطلب مُغيّر للحالة (ينشئ صفًا في القاعدة).
 */
export const POST: APIRoute = async (context) => {
  if (!assertSameOrigin(context.request)) {
    return json({ error: 'طلب غير مصرح' }, 403);
  }

  if (!isSupabaseConfigured) {
    return json({ error: 'تسجيل الدخول غير مُفعّل' }, 503);
  }

  const supabase = createServerSupabase(context);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return json({ error: 'يجب تسجيل الدخول أولاً' }, 401);
  }

  const raw = await readBody(context.request);
  if (raw === null) return json({ error: 'طلب غير صالح' }, 400);

  const examId = typeof raw.exam_id === 'string' ? raw.exam_id.trim() : '';
  if (!examId) return json({ error: 'exam_id مطلوب' }, 400);

  // isValidUuid: يمنع تمرير نص عشوائي إلى RPC بلا فائدة
  if (!UUID_RE.test(examId)) return json({ error: 'exam_id غير صالح' }, 400);

  const { data, error } = await supabase.rpc('start_exam_attempt', {
    p_exam_id: examId,
    p_mode: 'exam',
  });

  if (error) {
    return json({ error: friendlyError(error.message) }, statusFor(error.message));
  }

  const result = (Array.isArray(data) ? data[0] : data) as StartAttemptResult | null;
  if (!result?.attempt_id) {
    return json({ error: 'تعذّر بدء المحاولة' }, 500);
  }

  return json(result, 200);
};

// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get('content-length') || '0');
  if (length > MAX_BODY_BYTES) return null;

  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return null;
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function friendlyError(message: string): string {
  if (message.includes('تسجيل الدخول')) return 'يجب تسجيل الدخول أولاً';
  if (message.includes('معطّل')) return 'حسابك معطّل. يرجى التواصل مع الإدارة.';
  if (message.includes('غير موجود')) return 'الامتحان غير موجود';
  if (message.includes('غير منشور')) return 'هذا الامتحان غير منشور بعد';
  if (message.includes('الحد المسموح')) return 'محاولات كثيرة في وقت قصير. انتظر قليلًا ثم أعد المحاولة.';
  return 'تعذّر بدء المحاولة';
}

function statusFor(message: string): number {
  if (message.includes('تسجيل الدخول')) return 401;
  if (message.includes('معطّل')) return 403;
  if (message.includes('غير موجود')) return 404;
  if (message.includes('غير منشور')) return 403;
  if (message.includes('الحد المسموح')) return 429;
  return 500;
}
