import type { APIRoute } from 'astro';
import { createServerSupabase, json, assertSameOrigin } from '../../../../lib/auth-server';
import { isSupabaseConfigured } from '../../../../lib/supabase';

export const prerender = false;

/** نسمح بجسم أكبر هنا: الطلب قد يحمل كل إجابات الاستئناف دفعة واحدة. */
const MAX_BODY_BYTES = 128 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * حفظ إجابات المحاولة.
 *
 * يقبل شكلين:
 *   (أ) إجابة واحدة:  { attempt_id, question_id, selected_index, time_taken }
 *       → هذا ما يرسله sendBeacon أثناء الامتحان.
 *   (ب) دفعة:        { attempt_id, answers: [{ question_id, selected_index }] }
 *       → استئناف الاستئناف + قبل التسليم.
 *
 * ★ يقبل Blob من sendBeacon، فيجب ألا نرمي خطأ 415 على نوع المحتوى
 *   (sendBeacon يرسل application/json لكن بعض المتصفحات تستخدم
 *   text/plain — لذلك نتجاهل نوع المحتوى ونقرأ النص مباشرة).
 *
 * ★ لا نكشف أي نتيجة هنا: التصحيح كله في /submit.
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
  if (!UUID_RE.test(attemptId)) return json({ error: 'attempt_id غير صالح' }, 400);

  // نوحّد الشكلين في قائمة
  const items: { questionId: string; selectedIndex: number | null; timeTaken: number | null }[] = [];

  if (Array.isArray(raw.answers)) {
    for (const entry of raw.answers) {
      if (!entry || typeof entry !== 'object') continue;
      const qid = (entry as Record<string, unknown>).question_id;
      if (typeof qid !== 'string' || !UUID_RE.test(qid)) continue;
      const idx = normalizeIndex((entry as Record<string, unknown>).selected_index);
      const tt = typeof (entry as Record<string, unknown>).time_taken === 'number'
        ? (entry as Record<string, unknown>).time_taken as number
        : null;
      items.push({ questionId: qid, selectedIndex: idx, timeTaken: tt });
    }
  } else {
    const qid = typeof raw.question_id === 'string' ? raw.question_id.trim() : '';
    if (!UUID_RE.test(qid)) return json({ error: 'question_id غير صالح' }, 400);
    const tt = typeof raw.time_taken === 'number' ? raw.time_taken : null;
    items.push({ questionId: qid, selectedIndex: normalizeIndex(raw.selected_index), timeTaken: tt });
  }

  if (items.length === 0) return json({ error: 'لا توجد إجابات' }, 400);
  if (items.length > 200) return json({ error: 'عدد الإجابات يتجاوز الحد' }, 413);

  let saved = 0;
  for (const item of items) {
    const { error } = await supabase.rpc('save_answer', {
      p_attempt_id: attemptId,
      p_question_id: item.questionId,
      p_selected_index: item.selectedIndex,
      p_time_taken: item.timeTaken,
    });
    if (!error) {
      saved++;
      continue;
    }
    // خطأ واحد يجب ألا يُسقط الباقي: نُسجّل ونكمل
    if (import.meta.env.DEV) {
      console.error('save_answer failed:', error.message);
    }
  }

  if (saved === 0) {
    return json({ error: 'تعذّر حفظ الإجابات' }, 400);
  }

  return json({ ok: true, saved });
};

// ---------------------------------------------------------------------------

/** يقبل 0..3 أو null (لم يُجب). أي رقم آخر يصبح null. */
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
