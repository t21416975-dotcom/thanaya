import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const authHeader = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // (1) عميل بجلسة المستدعي: يخضع لـRLS وللصلاحيات الفعلية
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return json({ error: 'غير مصادق' }, 401);

  // (2) الحكم النهائي من قاعدة البيانات (لا نثق بأي شيء من العميل)
  const { data: perms } = await caller.rpc('get_my_permissions');
  if (!perms?.global?.includes('staff.manage')) {
    return json({ error: 'غير مصرح بإدارة الفريق' }, 403);
  }

  const { email, role, redirectTo } = await req.json();
  if (!email || !['admin', 'editor'].includes(role)) {
    return json({ error: 'بيانات غير صالحة' }, 400);
  }

  const redirectTarget = redirectTo
    || Deno.env.get('ADMIN_INVITE_REDIRECT')
    || req.headers.get('origin')
    || undefined;

  // (3) التنفيذ بمفتاح service_role (يبقى في أسرار الدالة فقط)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectTarget,
  });
  if (inviteError) return json({ error: inviteError.message }, 400);

  const { error: insertError } = await admin.from('admins').insert({
    id: invited.user!.id,
    email,
    role,
    is_active: true,
  });
  if (insertError) return json({ error: insertError.message }, 500);

  return json({ message: `تم إرسال الدعوة إلى ${email}` }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
