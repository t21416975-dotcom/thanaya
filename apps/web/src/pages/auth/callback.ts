import type { APIRoute } from 'astro';
import { createServerSupabase, bootstrapStudent, safeReturnTo } from '../../lib/auth-server';

export const prerender = false;

/**
 * نقطة استقبال Google OAuth — endpoint لا صفحة، لأنها دائمًا ما تُعيد توجيهًا.
 *
 * التدفق:
 *   1) Google يعيدنا هنا بالرمز (code) أو بالخطأ.
 *   2) ★ تبادل الرمز بجلسة: exchangeCodeForSession يقرأ كوكي الـ code-verifier
 *      الذي كتبه /api/auth/google، ويطلب من Supabase تحويل الرمز إلى session.
 *      @supabase/ssr يشغّل تدفق PKCE مع detectSessionInUrl=false على السيرفر،
 *      فلا يوجد أي كود آخر يتبادل الرمز — getUser() وحده لا يفعل ذلك، بل
 *      يقرأ جلسة موجودة. حذف هذا السطر كان يعني: Google يسجّل الدخول بنجاح
 *      (ويرسل إيميل «تسجيل دخول جديد») والموقع يبقى بلا جلسة.
 *   3) bootstrap_student ينشئ/يحدّث صف الطالب (المكان الوحيد الذي يفعل ذلك).
 *   4) إعادة توجيه إلى returnTo بعد قصّه على مسار داخلي.
 */
export const GET: APIRoute = async (context) => {
  const { url } = context;

  // ── خطأ من Google (في query string) ────────────────────────────────────
  // ★ نمرّر الرمز فقط: /auth/login هي التي تملك النصوص (ERROR_MESSAGES)، فلا
  //   نمرّر error_description من Google ولا نضع نصوصًا عربية في عنوان URL.
  const errCode = url.searchParams.get('error');
  if (errCode) return redirect(loginError(errCode, url.searchParams.get('returnTo')));

  const supabase = createServerSupabase(context);

  // ── تبادل رمز PKCE بجلسة ────────────────────────────────────────────────
  const code = url.searchParams.get('code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code, flowIdOptions(url));

    if (exchangeError) {
      // ★ تسجيل دائم (لا DEV فقط): هذا هو السجل الوحيد الذي يكشف سبب فشل
      //   التبادل على الإنتاج، ورمز code_exchange_failed وحده لا يفرّق بين
      //   "verifier مفقود" و"رمز مستهلَك" و"redirect_uri مرفوض".
      console.error('auth/callback: code exchange failed', {
        code: exchangeError.code ?? null,
        status: exchangeError.status ?? null,
        message: exchangeError.message,
        flowId: url.searchParams.get('sb_flow_id'),
      });
      return redirect(loginError('code_exchange_failed', url.searchParams.get('returnTo')));
    }
  }

  // ── تأكيد الجلسة ────────────────────────────────────────────────────────
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirect(loginError('callback_failed', url.searchParams.get('returnTo')));
  }

  // ── إنشاء/تحديث صف الطالب ──────────────────────────────────────────────
  // ★ المكان الوحيد الذي يُنشئ صف الطالب. getStudentSession في بقية الصفحات
  //   للقراءة فقط، فلا تتحوّل كل صفحة GET إلى كتابة (وهو ما يكسر الـ
  //   caching العام المعرّف في vercel.json).
  const student = await bootstrapStudent(supabase);

  // ★ الفشل هنا كان بلا مخرج: إعادة التوجيه إلى /auth/login التي كانت
  //   بدورها تعيدنا إلى /auth/callback?needs=profile → حلقة لا نهائية.
  //   /auth/login الآن لا تعيد التوجيه عند وجود ?error، فتنتهي السلسلة.
  if (!student) {
    return redirect(loginError('bootstrap_failed', url.searchParams.get('returnTo')));
  }

  // ── حساب معطّل → منع المتابعة برسالة واضحة ────────────────────────────
  if (!student.is_active) {
    // ★ تسجيل الخروج قبل إعادة التوجيه: نترك المستخدم بلا جلسة، فيعرض
    //   /auth/login زر الدخول بدل أن ترتدّ إلينا على needs=profile مرارًا.
    await supabase.auth.signOut();
    return redirect(loginError('account_disabled', url.searchParams.get('returnTo')));
  }

  // ── إعادة التوجيه (returnTo مقصوص على مسار داخلي) ──────────────────────
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
  return redirect(returnTo);
};

/**
 * معرّف التدفق (sb_flow_id) تعيده Supabase و supabase-js معًا.
 *
 * SDK لا يفعّله افتراضيًا (experimental.appendPkceFlowIdToRedirects = false)،
 * فقد لا يكون موجودًا — وعندها يتكفّل SDK بقراءة الكوكي الثابت. نمرّره فقط إن
 * وصل، وبنفس التحقّق الذي يطبّقه SDK على النمط، حتى لا يُرفض التبادل بسبب
 * قيمة مشوّهة قادمة من الـ URL.
 */
function flowIdOptions(url: URL): { flowId: string } | undefined {
  const flowId = url.searchParams.get('sb_flow_id');
  if (!flowId || !/^[a-zA-Z0-9_-]{8,64}$/.test(flowId)) return undefined;
  return { flowId };
}

/**
 * يبني رابط العودة إلى صفحة الدخول مع رمز الخطأ — ويحمل returnTo معه.
 *
 * ★ بدون returnTo كان الطالب يفقد وجهته عند أي خطأ: /auth/login بلا معامل
 *   returnTo يعود إلى '/'، فينتهي من حيث بدأ بدل أن يُعاد إلى /review مثلًا.
 * ★ النص ليس هنا: /auth/login تملك ERROR_MESSAGES وتعرض فقط ما تعرفه،
 *   فلا يُرسَل نص عربي في عنوان URL ولا يُعرض نص من خارج الموقع.
 */
function loginError(code: string, returnTo: string | null): string {
  const params = new URLSearchParams({ error: code });
  const safe = safeReturnTo(returnTo, '');
  if (safe) params.set('returnTo', safe);
  return `/auth/login?${params.toString()}`;
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}
