import { createClient } from 'npm:@supabase/supabase-js@2';

// الدومين المسموح به: دومين لوحة الأدمن المحدد في ADMIN_INVITE_REDIRECT فقط.
// لا '*' — أي مصدر آخر (.attacker.com) لا يحصل على أي Access-Control-Allow-Origin.
const ALLOWED_ORIGIN = (Deno.env.get('ADMIN_INVITE_REDIRECT') || '').trim().replace(/\/+$/, '');

function corsHeaders(req: Request): Record<string, string> {
  const origin = (req.headers.get('origin') || '').replace(/\/+$/, '');
  const allowOrigin = origin && ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN ? origin : '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin;
  return headers;
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const authHeader = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // (1) عميل بجلسة المستدعي للتحقق من هوية صاحب الطلب
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return json({ error: 'غير مصادق. يرجى تسجيل الدخول مجدداً.' }, 401, CORS);

  // (2) عميل بصلاحيات service_role للتحكم بالمسؤولين والـ Auth
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // فحص حالة ورتبة المستدعي من جدول admins
  const { data: callerAdmin } = await admin
    .from('admins')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!callerAdmin || !callerAdmin.is_active) {
    return json({ error: 'حسابك غير مسجل كمسؤول أو تم تعطيله' }, 403, CORS);
  }

  const isSuperAdmin = callerAdmin.role === 'super_admin';

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'صيغة الطلب غير صحيحة' }, 400, CORS);
  }

  const action = payload.action || (payload.password ? 'create' : 'invite');

  // =========================================================================
  // 1. حذف موظف نهائياً (مقتصر على super_admin فقط)
  // =========================================================================
  if (action === 'delete') {
    if (!isSuperAdmin) {
      return json({ error: 'حذف المسؤولين مقتصر على المدير العام (Super Admin) فقط' }, 403, CORS);
    }

    const staffId = payload.staffId;
    if (!staffId) return json({ error: 'معرّف الموظف مطلوب' }, 400, CORS);
    if (staffId === user.id) return json({ error: 'لا يمكنك حذف حسابك الحالي بنفسك' }, 400, CORS);

    // حذف الصلاحيات وسجل المسؤول
    await admin.from('admin_permissions').delete().eq('admin_id', staffId);
    const { error: deleteAdminErr } = await admin.from('admins').delete().eq('id', staffId);
    if (deleteAdminErr) {
      return json({ error: `فشل حذف الموظف من قاعدة البيانات: ${deleteAdminErr.message}` }, 500, CORS);
    }

    // حذف الحساب نهائياً من Supabase Auth
    const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(staffId);
    if (deleteAuthErr) {
      console.warn('Could not delete auth user:', deleteAuthErr);
    }

    return json({ message: 'تم حذف الموظف وحسابه نهائياً بنجاح' }, 200, CORS);
  }

  // =========================================================================
  // 2. إنشاء موظف مباشر بالإيميل وكلمة السر (بدون إرسال إيميل)
  // =========================================================================
  if (action === 'create') {
    // التحقق من صلاحية إدارة الفريق
    if (!isSuperAdmin) {
      const { data: perms } = await caller.rpc('get_my_permissions');
      if (!perms?.global?.includes('staff.manage')) {
        return json({ error: 'غير مصرح لك بإضافة موظفين' }, 403, CORS);
      }
    }

    const { email, password, role } = payload;
    if (!email || !password || !['admin', 'editor'].includes(role)) {
      return json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور واختيار الرتبة' }, 400, CORS);
    }

    if (password.length < 6) {
      return json({ error: 'كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل' }, 400, CORS);
    }

    // إنشاء الحساب وتأكيد البريد تلقائياً حتى يتمكن من الدخول فوراً
    const { data: newUser, error: createAuthError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { role },
    });

    if (createAuthError) {
      if (createAuthError.message.includes('already')) {
        return json({ error: 'هذا البريد الإلكتروني مسجل بالفعل في النظام' }, 400, CORS);
      }
      return json({ error: createAuthError.message }, 400, CORS);
    }

    // ربطه بجدول admins
    const { error: insertError } = await admin.from('admins').upsert(
      {
        id: newUser.user.id,
        email: email.trim().toLowerCase(),
        role,
        is_active: true,
      },
      { onConflict: 'id' }
    );

    if (insertError) {
      return json({ error: `فشل تسجيل رتبة الموظف: ${insertError.message}` }, 500, CORS);
    }

    return json({ message: `تم إنشاء حساب الموظف (${email}) بنجاح ويمكنه تسجيل الدخول فوراً` }, 200, CORS);
  }

  // =========================================================================
  // 3. دعوة عبر البريد الإلكتروني (الوضع التقليدي)
  // =========================================================================
  if (!isSuperAdmin) {
    const { data: perms } = await caller.rpc('get_my_permissions');
    if (!perms?.global?.includes('staff.manage')) {
      return json({ error: 'غير مصرح بإدارة الفريق' }, 403, CORS);
    }
  }

  const { email, role, redirectTo } = payload;
  if (!email || !['admin', 'editor'].includes(role)) {
    return json({ error: 'بيانات غير صالحة' }, 400, CORS);
  }

  // يُقبل redirectTo فقط إذا طابق ADMIN_INVITE_REDIRECT تمامًا.
  // لا يُؤخذ أبدًا من Origin header أو من جسم الطلب كقيمة احتياطية (Open Redirect).
  const allowlistedRedirect = (Deno.env.get('ADMIN_INVITE_REDIRECT') || '').trim();
  const redirectTarget =
    redirectTo && allowlistedRedirect && redirectTo.trim() === allowlistedRedirect
      ? allowlistedRedirect
      : undefined;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    redirectTo: redirectTarget,
  });
  if (inviteError) return json({ error: inviteError.message }, 400, CORS);

  const { error: insertError } = await admin.from('admins').upsert(
    {
      id: invited.user!.id,
      email: email.trim().toLowerCase(),
      role,
      is_active: true,
    },
    { onConflict: 'id' }
  );
  if (insertError) return json({ error: insertError.message }, 500, CORS);

  return json({ message: `تم إرسال الدعوة إلى ${email}` }, 200, CORS);
});

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...extraHeaders, 'Content-Type': 'application/json' },
  });
}
