import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserPlus, Loader2, Trash2, KeyRound } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import { PermissionEditor } from './PermissionEditor';
import { usePermissions } from '../lib/permissions';
import type { AdminPermission, AdminUser, AdminRole } from '@thanaya/types';

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'مدير عام',
  admin: 'أدمن',
  editor: 'محرر محتوى',
};

export function StaffManager() {
  const queryClient = useQueryClient();
  const { permissions } = usePermissions();
  const isSuperAdmin = permissions.is_super_admin;
  const currentAdminId = permissions.admin_id;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminRole>('editor');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteStaff(id),
    onSuccess: (res) => {
      alert(res?.message || 'تم حذف الموظف بنجاح');
      invalidate();
    },
    onError: (err: any) => {
      alert(err.message || 'فشل حذف الموظف');
    },
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

  const handleCreateStaff = async () => {
    if (isSendingInvite) return;
    if (!inviteEmail.trim()) {
      setInviteError('يرجى إدخال البريد الإلكتروني للموظف.');
      return;
    }
    if (!invitePassword || invitePassword.length < 6) {
      setInviteError('يرجى إدخال كلمة مرور مكونة من 6 خانات على الأقل.');
      return;
    }

    setIsSendingInvite(true);
    setInviteError(null);
    try {
      const res = await api.createStaff({
        email: inviteEmail.trim(),
        password: invitePassword,
        role: inviteRole,
      });

      alert(res?.message || 'تم إنشاء حساب الموظف بنجاح ويمكنه تسجيل الدخول فوراً');
      setInviteOpen(false);
      setInviteEmail('');
      setInvitePassword('');
      setInviteError(null);
      invalidate();
    } catch (err: any) {
      setInviteError(err.message || 'فشل إنشاء حساب الموظف. يرجى التأكد من البيانات والمحاولة مرة أخرى.');
    } finally {
      setIsSendingInvite(false);
    }
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
          onClick={() => {
            setInviteError(null);
            setInviteOpen(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer shadow-sm transition-colors"
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
              <tr><td className="p-3 text-slate-500 text-center" colSpan={5}>جاري التحميل...</td></tr>
            )}
            {staff.map((member) => {
              const memberGrants = grantsByAdmin.get(member.id) ?? [];
              const isSelf = member.id === currentAdminId;

              return (
                <tr key={member.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="p-3 font-medium text-slate-700" dir="ltr">
                    <div className="flex items-center gap-2">
                      <span>{member.email}</span>
                      {isSelf && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-normal">
                          (حسابك)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <select
                      value={member.role}
                      disabled={!isSuperAdmin && member.role === 'super_admin'}
                      onChange={(e) => roleMutation.mutate({ id: member.id, role: e.target.value as AdminRole })}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {(['super_admin', 'admin', 'editor'] as AdminRole[]).map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      disabled={isSelf}
                      onClick={() => activeMutation.mutate({ id: member.id, is_active: !member.is_active })}
                      className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 transition-colors ${
                        member.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      }`}
                      title={isSelf ? 'لا يمكنك تعطيل حسابك الخاص' : undefined}
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedStaff(member)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer font-medium text-slate-700 transition-colors"
                      >
                        تعديل الحدود
                      </button>

                      {isSuperAdmin && !isSelf && (
                        <button
                          type="button"
                          disabled={deleteMutation.isPending && deleteMutation.variables === member.id}
                          onClick={() => {
                            if (window.confirm(`هل أنت متأكد من حذف الموظف (${member.email}) نهائياً؟\nسيتم إلغاء حسابه وصلاحياته بالكامل.`)) {
                              deleteMutation.mutate(member.id);
                            }
                          }}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                          title="حذف الموظف نهائياً من النظام"
                        >
                          {deleteMutation.isPending && deleteMutation.variables === member.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>حذف</span>
                        </button>
                      )}
                    </div>
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
        <Modal
          isOpen={inviteOpen}
          title="إضافة موظف جديد (مباشر)"
          onClose={() => {
            if (!isSendingInvite) {
              setInviteOpen(false);
              setInviteError(null);
            }
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateStaff();
            }}
            className="space-y-4 p-1"
          >
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-800 leading-relaxed">
              💡 <strong>إنشاء فوري:</strong> سيتم تفعيل حساب الموظف مباشرة بكلمة المرور المدخلة دون الحاجة لروابط تفعيل أو إرسال إيميلات.
            </div>

            {inviteError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {inviteError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                dir="ltr"
                required
                disabled={isSendingInvite}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="staff@thanaya.com"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                كلمة المرور
              </label>
              <input
                type="text"
                dir="ltr"
                required
                minLength={6}
                disabled={isSendingInvite}
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="اكتب كلمة مرور للموظف (6 خانات على الأقل)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                احفظ كلمة المرور دي وشاركها مع الموظف عشان يسجل دخوله بيها.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                الرتبة
              </label>
              <select
                disabled={isSendingInvite}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as AdminRole)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {(['editor', 'admin'] as AdminRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSendingInvite}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSendingInvite ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء الحساب...</span>
                </>
              ) : (
                <span>إنشاء وتفعيل الحساب فوراً</span>
              )}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
