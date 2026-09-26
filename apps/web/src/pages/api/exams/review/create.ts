import type { APIRoute } from 'astro';
import { createServerSupabase, json, assertSameOrigin } from '../../../../lib/auth-server';
import { isSupabaseConfigured } from '../../../../lib/supabase';
import type { CreateReviewResult } from '@thanaya/types';

export const prerender = false;

const MAX_BODY_BYTES = 8 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ★ إنشاء "امتحان الأخطاء".
 *
 * يختار الخادم من question_performance (الأسئلة غير المتقنة في مادة) بترجيح
 * زمني، ويُكمل من أسئلة لم تُحاول إن طُلب. p_count بين حد أدنى/أقصى يُتحقق
 * منهما على الخادم (القيم الافتراضية في system_settings).
 *
 * ★ لا يمكن للعميل influence الاختيار — كل منطق الترشيح في الـ RPC.
 *  _score أقل من الحد الأدنى: الخطأ يأتي من RPC (لا أخطاء في هذه المادة).
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

  const subjectId = typeof raw.subject_id === 'string' ? raw.subject_id.trim() : '';
  if (!UUID_RE.test(subjectId)) return json({ error: 'subject_id غير صالح' }, 400);

  // count: نتحقق من صحته رقميًا قبل إرساله؛ الـ RPC يتحقق من الحدود
  let count: number | null = null;
  if (raw.count !== undefined && raw.count !== null && raw.count !== '') {
    const n = Number(raw.count);
    if (!Number.isInteger(n)) return json({ error: 'عدد الأسئلة غير صالح' }, 400);
    count = n;
  }

  const onlyWrong = raw.include_unseen === undefined ? true : raw.include_unseen !== true;
  const includeUnseen = raw.include_unseen === true;

  const { data, error } = await supabase.rpc('create_review_exam', {
    p_subject_id: subjectId,
    p_count: count,
    p_only_wrong: onlyWrong,
    p_include_unseen: includeUnseen,
  });

  if (error) {
    return json({ error: friendlyError(error.message) }, statusFor(error.message));
  }

  const result = (Array.isArray(data) ? data[0] : data) as CreateReviewResult | null;
  if (!result?.attempt_id) {
    return json({ error: 'تعذّر إنشاء الامتحان' }, 500);
  }

  return json(result, 200);
};

// ---------------------------------------------------------------------------

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
  if (message.includes('لا توجد أسئلة أخطأت')) return 'لا توجد أسئلة أخطأت فيها في هذه المادة. تفوّق 🎉';
  if (message.includes('المتاح')) return message; // "المتاح N سؤال فقط في هذه المادة"
  if (message.includes('بين')) return message; // حدود p_count
  if (message.includes('المادة غير موجودة')) return 'المادة غير موجودة';
  if (message.includes('لا توجد أسئلة متاحة')) return 'لا توجد أسئلة متاحة في هذه المادة';
  if (message.includes('الحد المسموح')) return 'أنشأت امتحانات كثيرة في وقت قصير. انتظر قليلًا.';
  return 'تعذّر إنشاء امتحان الأخطاء';
}

function statusFor(message: string): number {
  if (message.includes('تسجيل الدخول')) return 401;
  if (message.includes('معطّل')) return 403;
  if (message.includes('غير موجودة')) return 404;
  if (message.includes('لا توجد') || message.includes('المتاح')) return 409;
  if (message.includes('الحد المسموح')) return 429;
  if (message.includes('بين')) return 400;
  return 500;
}
