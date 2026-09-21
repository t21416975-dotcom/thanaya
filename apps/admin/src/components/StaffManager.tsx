import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { PermissionEditor } from './PermissionEditor';
import type { AdminPermission, AdminUser, AdminRole } from '@thanaya/types';

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'مدير عام',
  admin: 'أدمن',
  editor: 'محرر محتوى',
};

export function StaffManager() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminRole>('editor');
  const [selectedStaff, setSelectedStaff] = useState<AdminUser | null>(null);

  const { data: staff = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => api.getStaff() });
  const { data: grants = [] } = useQuery({ queryKey: ['staff_permissions'], queryFn: () => api.getStaffPermissions() });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['staff_permissions'] });
    queryClient.invalidateQueries({ queryKey: ['my_permissions'] });
  };

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) => api.updateStaffRole(id, role),
    onSuccess: invalidate,
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => api.setStaffActive(id, is_active),
    onSuccess: invalidate,
  });

  const grantsByAdmin = useMemo(() => {
    const map = new Map<string, AdminPermission[]>();
    for (const g of grants) {
      const list = map.get(g.admin_id) ?? [];
      list.push(g);
      map.set(g.admin_id, list);
    }
    return map;
  }, [grants]);

  const sendInvite = async () => {
    // إنشاء الحساب يحتاج service_role، لذا يمر عبر Edge Function (القسم 8)
    const { data, error } = await supabase.functions.invoke('admin-invite', {
      body: {
        email: inviteEmail,
        role: inviteRole,
        redirectTo: window.location.origin,
      },
    });
    if (error) { alert(error.message); return; }
    alert((data as { message?: string })?.message ?? 'تم إرسال الدعوة');
    setInviteOpen(false);
    setInviteEmail('');
    invalidate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" /> الفريق والصلاحيات
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            الرتبة تحدّد الافتراضي، والحدود المخصّصة تحدّد ما يُسمح فعليًا
            (نطاق مادة/مورد/امتحان، أو منع صريح، أو صلاحية مؤقتة بتاريخ انتهاء).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer"
        >
          <UserPlus className="w-4 h-4" /> إضافة موظف
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-right p-3">البريد</th>
              <th className="text-right p-3">الرتبة</th>
              <th className="text-right p-3">الحالة</th>
              <th className="text-right p-3">حدود مخصّصة</th>
              <th className="text-right p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td className="p-3 text-slate-500" colSpan={5}>جاري التحميل...</td></tr>
            )}
            {staff.map((member) => {
              const memberGrants = grantsByAdmin.get(member.id) ?? [];
              return (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium text-slate-700" dir="ltr">{member.email}</td>
                  <td className="p-3">
                    <select
                      value={member.role}
                      onChange={(e) => roleMutation.mutate({ id: member.id, role: e.target.value as AdminRole })}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
                    >
                      {(['super_admin', 'admin', 'editor'] as AdminRole[]).map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => activeMutation.mutate({ id: member.id, is_active: !member.is_active })}
                      className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer ${
                        member.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {member.is_active ? 'مُفعَّل' : 'مُعطَّل'}
                    </button>
                  </td>
                  <td className="p-3 text-xs text-slate-600">
                    {memberGrants.length === 0
                      ? '— القالب الافتراضي'
                      : `${memberGrants.length} سطر (منها ${memberGrants.filter((g) => g.effect === 'deny').length} منع)`}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setSelectedStaff(member)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer"
                    >
                      تعديل الحدود
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedStaff && (
        <PermissionEditor
          member={selectedStaff}
          grants={grantsByAdmin.get(selectedStaff.id) ?? []}
          onClose={() => setSelectedStaff(null)}
          onSaved={invalidate}
        />
      )}

      {inviteOpen && (
        <Modal isOpen={inviteOpen} title="إضافة موظف جديد" onClose={() => setInviteOpen(false)}>
          <div className="space-y-3 p-1">
            <input
              type="email" dir="ltr" value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="staff@thanaya.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AdminRole)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {(['editor', 'admin'] as AdminRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={sendInvite}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
            >
              إرسال الدعوة
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
