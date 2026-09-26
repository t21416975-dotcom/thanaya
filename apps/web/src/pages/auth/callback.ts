import type { APIRoute } from 'astro';
import { createServerSupabase, bootstrapStudent } from '../../lib/auth-server';

export const prerender = false;

/**
 * نقطة استقبال Google OAuth — endpoint لا صفحة، لأنها دائمًا ما تُعيد توجيهًا.
 *
 * التدفق:
 *   1) Google يعيدنا هنا بالرمز أو بالخطأ.
 *   2) @supabase/ssr يتكفّل بالتبادل عبر setAll في createServerSupabase:
 *      عند استدعاء getUser() تُكتب الكوكيز على Astro.cookies تلقائيًا.
 *   3) bootstrap_student ينشئ/يحدّث صف الطالب (المكان الوحيد الذي يفعل ذلك).
 *   4) إعادة توجيه إلى returnTo بعد قصّه على مسار داخلي.
 */
export const GET: APIRoute = async (context) => {
  const { url } = context;

  // ── خطأ من Google (في query string) ────────────────────────────────────
  const errCode = url.searchParams.get('error');
  if (errCode) {
    const messages: Record<string, string> = {
      access_denied: 'ألغيت عملية تسجيل الدخول.',
      server_error: 'واجه Google خطأً مؤقتًا. حاول مرة أخرى.',
      temporarily_unavailable: 'خدمة Google غير متاحة مؤقتًا. حاول بعد قليل.',
    };
    const message = messages[errCode] || url.searchParams.get('error_description') || 'تعذّر إتمام تسجيل الدخول.';
    return redirect(`/auth/login?error=${encodeURIComponent(errCode)}&message=${encodeURIComponent(message)}`);
  }

  const supabase = createServerSupabase(context);

  // ── تأكيد الجلسة وتبادل الرمز ───────────────────────────────────────────
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirect(
      `/auth/login?error=callback_failed&message=${encodeURIComponent('لم نتمكن من تأكيد جلستك. حاول مرة أخرى.')}`
    );
  }

  // ── إنشاء/تحديث صف الطالب ──────────────────────────────────────────────
  // ★ المكان الوحيد الذي يُنشئ صف الطالب. getStudentSession في بقية الصفحات
  //   للقراءة فقط، فلا تتحوّل كل صفحة GET إلى كتابة (وهو ما يكسر الـ
  //   caching العام المعرّف في vercel.json).
  const student = await bootstrapStudent(supabase);

  if (!student) {
    return redirect(
      `/auth/login?error=bootstrap_failed&message=${encodeURIComponent('سجّلنا دخولك لكن تعذّر إنشاء ملفك. جرّب مرة أخرى.')}`
    );
  }

  // ── حساب معطّل → منع المتابعة برسالة واضحة ────────────────────────────
  if (!student.is_active) {
    await supabase.auth.signOut();
    return redirect(
      `/auth/login?error=account_disabled&message=${encodeURIComponent('حسابك معطّل. يرجى التواصل مع إدارة المنصة.')}`
    );
  }

  // ── إعادة التوجيه (returnTo مقصوص على مسار داخلي) ──────────────────────
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
  return redirect(returnTo);
};

/**
 * قصّ returnTo على مسار داخلي فقط.
 * يوقف: موقعًا خارجيًا بالكامل، و protocol-relative (//evil.com)،
 * وخدعة الشرطة المائلة العكسية (\/\/evil.com) التي تتبعها بعض المتصفحات.
 */
function safeReturnTo(value: string | null): string {
  if (!value) return '/account';
  if (!value.startsWith('/')) return '/account';
  if (value.startsWith('//')) return '/account';
  if (value.includes('\\')) return '/account';
  return value;
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}
