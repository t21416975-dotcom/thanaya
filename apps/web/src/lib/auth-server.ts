import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { APIContext } from 'astro';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database, StudentBootstrap } from '@thanaya/types';
import { isSupabaseConfigured, rawSupabaseUrl, rawSupabaseKey } from './supabase';

// ============================================================================
// طبقة المصادقة على السيرفر (Astro SSR)
//
// لماذا @supabase/ssr وليس supabase-js العادي؟
//   supabase-js يخزّن الجلسة في localStorage — لا يصل إلى Astro.cookies، فلا
//   يستطيع السيرفر معرفة من زار الصفحة. @supabase/ssr يقرأ/يكتب كوكيز
//   (sb-access-token) في كل استجابة، فيصبح getUser() على السيرفر موثوقًا.
//
// ★ لا نستخدم getSession() على السيرفر أبدًا: هي تقرأ كوكي موقّع فقط ولا
//   تتحقق منه. getUser() تستدعي Auth API وتتحقق من التوقيع فعليًا.
// ============================================================================

function cookieOptions(): CookieOptions {
  return {
    path: '/',
    sameSite: 'lax', // ★ ضروري: يمنع إرسال الكوكي في طلبات POST خارجية (CSRF)
    secure: import.meta.env.PROD,
    httpOnly: true, // ★ لا يُقرأ من JavaScript → يقلّل أثر XSS
    maxAge: 60 * 60 * 24 * 30,
  };
}

/**
 * Astro 7 لا يوفّر AstroCookies.getAll()، فنقرأ ترويسة Cookie بأنفسنا.
 * الترويسة بصيغة "a=1; b=2". نتجاهل القيم الفارغة (كوكي محذوف).
 */
function parseCookieHeader(request: Request): { name: string; value: string }[] {
  const header = request.headers.get('cookie');
  if (!header) return [];

  const out: { name: string; value: string }[] = [];
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      value = decodeURIComponent(value);
    } catch {
      // قيمة غير مُرمَّزة: نستخدمها كما هي
    }
    out.push({ name, value });
  }
  return out;
}

/**
 * ينشئ عميل Supabase مرتبطًا بكوكيز الطلب/الاستجابة.
 * يُستدعى داخل endpoints على حدة، وفي src/middleware.ts لكل الطلبات.
 */
export function createServerSupabase(context: APIContext): SupabaseClient<Database> {
  if (!isSupabaseConfigured) {
    // لا شيء مُعدّ — نرجع null-ish حتى لا يفشل البناء
    return null as unknown as SupabaseClient<Database>;
  }

  return createServerClient<Database>(rawSupabaseUrl, rawSupabaseKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(context.request);
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          context.cookies.set(name, value, { ...cookieOptions(), ...options });
        }
      },
    },
  });
}

// ---------------------------------------------------------------------------
// قراءة الجلسة
// ---------------------------------------------------------------------------

export type StudentSession = {
  /** مستخدم auth.uid — قد يكون موجودًا بدون صف طالب (أول دخول). */
  user: User | null;
  /** صف الطالب في public.students، أو null إن لم يُنشأ بعد / معطّل. */
  student: Database['public']['Tables']['students']['Row'] | null;
  isSignedIn: boolean;
  /** حساب موجود في auth لكن بلا صف طالب — يحتاج bootstrap. */
  needsBootstrap: boolean;
  isConfigured: boolean;
};

/**
 * يقرأ الجلسة الحالية من الكوكيز.
 *
 * ★ لا يستدعي bootstrap_student — استدعاؤه هنا يجعل كل طلب GET كتابةً
 *   (last_seen_at) ويُكسر الـ caching العام. صفحة /auth/callback هي المكان
 *   الوحيد الذي ينشئ الصف.
 */
export async function getStudentSession(context: APIContext): Promise<StudentSession> {
  if (!isSupabaseConfigured) {
    return { user: null, student: null, isSignedIn: false, needsBootstrap: false, isConfigured: false };
  }

  const supabase = createServerSupabase(context);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, student: null, isSignedIn: false, needsBootstrap: false, isConfigured: true };
  }

  // محاولة قراءة صف الطالب مباشرة (SELECT مسموح لمالكه فقط عبر RLS)
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (studentError) {
    // خطأ في الاستعلام لا يعني absence — نُبقي المستخدم مسجّلًا بلا صف
    if (import.meta.env.DEV) console.error('getStudentSession: students read failed', studentError);
  }

  return {
    user,
    student: student ?? null,
    isSignedIn: true,
    // المستخدم موجود لكن بلا صف: أول دخول بعد التفعيل، أو حساب معطّل
    // (نُبقي needsBootstrap=false معطّلًا حتى لا نُعيد إنشاء صفه).
    needsBootstrap: !student,
    isConfigured: true,
  };
}

/**
 * يعيد صف الطالب أو يحوّل الاستجابة ويوقف التنفيذ.
 * الاستعمال في endpoints المحمية: إن لم يكن مسجّلًا → 401.
 */
export async function requireStudent(
  context: APIContext
): Promise<{ student: Database['public']['Tables']['students']['Row']; supabase: SupabaseClient<Database> } | Response> {
  const supabase = createServerSupabase(context);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: 'يجب تسجيل الدخول أولاً' }, 401);
  }

  // نجيب عبر الـ RPC لا عبر SELECT: يضمن التفعيل ويحمي من انتحال الصف
  const { data, error } = await supabase.rpc('get_my_dashboard');

  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('معطّل') || msg.includes('غير موجود')) {
      return json({ error: 'حسابك معطّل. يرجى التواصل مع الإدارة.' }, 403);
    }
    if (import.meta.env.DEV) console.error('requireStudent failed:', error);
    return json({ error: 'تعذّر التحقق من الحساب' }, 500);
  }

  // get_my_dashboard يرجع كائنًا واحدًا كـ JSONB
  const dashboard = (Array.isArray(data) ? data[0] : data) as { student?: { id: string } } | null;
  if (!dashboard?.student?.id) {
    return json({ error: 'تعذّر تحميل بيانات الحساب' }, 500);
  }

  // نعيد الصف نفسه من الجدول (dashboard يعطي ملخصًا لا الصف الكامل)
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!student) {
    return json({ error: 'تعذّر تحميل بيانات الحساب' }, 500);
  }

  return { student, supabase };
}

// ---------------------------------------------------------------------------
// مساعدات الاستجابة
// ---------------------------------------------------------------------------

export function json(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // ★ صفحات/بيانات شخصية: بلا تخزين مؤقت (لا في المتصفح ولا في CDN)
      'Cache-Control': 'private, no-store, max-age=0',
      ...extraHeaders,
    },
  });
}

/** يمنع CSRF: الطلبات المُغيّرة للحالة يجب أن تأتي من نفس الأصل. */
export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // بعض العملاء لا يرسلون Origin (نفس الأصل في المتصفح يرسله)
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** ينشئ/يحدّث صف الطالب (يُستدعى من /auth/callback فقط). */
export async function bootstrapStudent(supabase: SupabaseClient<Database>): Promise<StudentBootstrap | null> {
  const { data, error } = await supabase.rpc('bootstrap_student');
  if (error) {
    if (import.meta.env.DEV) console.error('bootstrap_student failed:', error);
    return null;
  }
  return (Array.isArray(data) ? data[0] : data) as StudentBootstrap | null;
}
