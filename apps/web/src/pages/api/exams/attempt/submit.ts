import type { APIRoute } from 'astro';
import { createServerSupabase, json, assertSameOrigin } from '../../../../lib/auth-server';
import { isSupabaseConfigured } from '../../../../lib/supabase';
import type { SubmitAttemptResult } from '@thanaya/types';

export const prerender = false;

const MAX_BODY_BYTES = 256 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ★ تسليم المحاولة — نقطة التصحيح الرسمية.
 *
 * ما يحدث هنا بالترتيب:
 *   1) نرفع كل الإجابات عبر save_answer (المصدر الأضمن — sendBeacon قد يفشل).
 *   2) نطلب من submit_exam_attempt التصحيح على السيرفر.
 *   3) نُعيد النتيجة كاملة مع الشرح ومفتاح الإجابة.
 *
 * ★ التوكن: attempt.answer_token الذي استلمناه عند البدء. يقارنه السيرفر
 *   بما يحسبه الآن، فيرفض أي محاولة عبث.
 *
 * ★ هذا endpoint لا يكشف أي معلومة عن محاولة غير مملوكة: كل فحص
 *   (الملكية + التفعيل) يتم داخل الـ RPC.
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

  const attemptId = typeof raw.attempt_id === 'string' ? raw.attempt_id.trim() : '';
  const token = typeof raw.answer_token === 'string' ? raw.answer_token.trim() : '';
  if (!UUID_RE.test(attemptId)) return json({ error: 'attempt_id غير صالح' }, 400);
  if (!token) return json({ error: 'answer_token مطلوب' }, 400);

  // 1) رفع كل الإجابات أولًا — sendBeacon أثناء الامتحان قد يكون لم يصل
  if (Array.isArray(raw.answers) && raw.answers.length > 0) {
    for (const entry of raw.answers) {
      if (!entry || typeof entry !== 'object') continue;
      const rec = entry as Record<string, unknown>;
      const qid = typeof rec.question_id === 'string' ? rec.question_id.trim() : '';
      if (!UUID_RE.test(qid)) continue;
      await supabase.rpc('save_answer', {
        p_attempt_id: attemptId,
        p_question_id: qid,
        p_selected_index: normalizeIndex(rec.selected_index),
        p_time_taken: typeof rec.time_taken === 'number' ? rec.time_taken : null,
      });
    }
  }

  // 2) التصحيح على السيرفر
  const timeSpent = typeof raw.time_spent === 'number' ? Math.max(0, Math.round(raw.time_spent)) : 0;

  const { data, error } = await supabase.rpc('submit_exam_attempt', {
    p_attempt_id: attemptId,
    p_token: token,
    p_time_spent: timeSpent,
  });

  if (error) {
    return json({ error: friendlyError(error.message) }, statusFor(error.message));
  }

  const result = (Array.isArray(data) ? data[0] : data) as SubmitAttemptResult | null;
  if (!result) return json({ error: 'تعذّر تصحيح المحاولة' }, 500);

  return json(result, 200);
};

// ---------------------------------------------------------------------------

function normalizeIndex(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 3) return null;
  return n;
}

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
  if (message.includes('مسبقًا')) return 'تم تسليم هذه المحاولة مسبقًا';
  if (message.includes('سلامة')) return 'تعذّر التحقق من سلامة المحاولة. أعد تحميل الصفحة وحاول مجددًا.';
  if (message.includes('انتهى وقت')) return 'انتهى وقت المحاولة';
  if (message.includes('غير موجودة')) return 'المحاولة غير موجودة';
  if (message.includes('الحد المسموح')) return 'محاولات كثيرة في وقت قصير. انتظر قليلًا.';
  return 'تعذّر تسليم المحاولة';
}

function statusFor(message: string): number {
  if (message.includes('تسجيل الدخول')) return 401;
  if (message.includes('معطّل')) return 403;
  if (message.includes('مسبقًا') || message.includes('سلامة')) return 409;
  if (message.includes('انتهى وقت')) return 410;
  if (message.includes('غير موجودة')) return 404;
  if (message.includes('الحد المسموح')) return 429;
  return 500;
}
