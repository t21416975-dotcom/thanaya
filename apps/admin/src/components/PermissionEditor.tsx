import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from './Modal';
import { api } from '../api/client';
import { supabase } from '../lib/supabase';
import type { AdminPermission, AdminUser, Permission, PermissionScopeType } from '@thanaya/types';

type Mode = 'preset' | 'allow' | 'deny';
type Row = { mode: Mode; scope_type: PermissionScopeType; scope_id: string; expires_at: string };

interface Props {
  member: AdminUser;
  grants: AdminPermission[];
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORY_LABELS: Record<Permission['category'], string> = {
  general: 'عام',
  content: 'المحتوى',
  exams: 'الامتحانات',
  structure: 'هيكل المحتوى',
  operations: 'التشغيل',
  system: 'النظام',
};

export function PermissionEditor({ member, grants, onClose, onSaved }: Props) {
  const { data: catalog = [] } = useQuery({ queryKey: ['permission_catalog'], queryFn: () => api.getPermissionCatalog() });
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => api.getSubjects() });
  const { data: contentTypes = [] } = useQuery({ queryKey: ['content_types'], queryFn: () => api.getContentTypes() });
  const { data: weeks = [] } = useQuery({ queryKey: ['weeks'], queryFn: () => api.getWeeks() });
  const { data: resources = [] } = useQuery({ queryKey: ['resources'], queryFn: () => api.getResources() });
  const { data: exams = [] } = useQuery({ queryKey: ['exams'], queryFn: () => api.getExams() });

  // الحالة المحلية: صف واحد لكل مفتاح (preset = وراثة القالب، allow = منح، deny = منع)
  const [draft, setDraft] = useState<Record<string, Row>>(() => {
    const init: Record<string, Row> = {};
    for (const g of grants) {
      init[g.permission_key] = {
        mode: g.effect === 'deny' ? 'deny' : 'allow',
        scope_type: g.scope_type,
        scope_id: g.scope_id ?? '',
        expires_at: g.expires_at ? g.expires_at.slice(0, 10) : '',
      };
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of catalog) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return [...map.entries()];
  }, [catalog]);

  const rowsFor = (key: string): Row =>
    draft[key] ?? { mode: 'preset', scope_type: 'global', scope_id: '', expires_at: '' };

  const setRow = (key: string, patch: Partial<Row>) =>
    setDraft((prev) => ({ ...prev, [key]: { ...rowsFor(key), ...patch } }));

  const optionsFor = (scope: PermissionScopeType) => {
    switch (scope) {
      case 'subject':      return subjects.map((s) => ({ id: s.id, label: s.name }));
      case 'content_type': return contentTypes.map((c) => ({ id: c.id, label: c.name }));
      case 'week':         return weeks.map((w) => ({ id: w.id, label: w.title }));
      case 'resource':     return resources.map((r) => ({ id: r.id, label: r.title }));
      case 'exam':         return exams.map((e) => ({ id: e.id, label: e.title }));
      default:             return [];
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const entries = Object.entries(draft)
        .filter(([, row]) => row.mode !== 'preset')
        // نتجاهل سطر «منح» بلا نطاق محدد (ناقص الإعداد)
        .filter(([, row]) => row.mode === 'deny' || row.scope_type === 'global' || row.scope_id)
        .map(([key, row]) => ({
          key,
          effect: row.mode === 'deny' ? ('deny' as const) : ('allow' as const),
          scope_type: row.mode === 'deny' ? ('global' as const) : row.scope_type,
          scope_id: row.mode === 'deny' || row.scope_type === 'global' ? null : row.scope_id,
          expires_at: row.expires_at ? new Date(`${row.expires_at}T23:59:59`).toISOString() : null,
        }));

      const { error: rpcError } = await (supabase.rpc as any)('set_staff_permissions', {
        p_admin_id: member.id,
        p_entries: entries,
      });
      if (rpcError) throw rpcError;
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'فشل حفظ الصلاحيات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} title={`حدود: ${member.email}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4 max-h-[75dvh] overflow-y-auto p-1">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">{error}</div>
        )}

        <p className="text-xs text-slate-500 leading-relaxed">
          «القالب» = يتبع صلاحيات الرتبة تلقائيًا. «منح» = صلاحية صريحة (يمكن تحديد نطاقها وتاريخ انتهائها).
          «منع» = إلغاء الصلاحية حتى لو منحها القالب. وجود أي سطر صريح لمفتاح ما يُلغي قالب الرتبة لهذا المفتاح.
        </p>

        {grouped.map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500">
              {CATEGORY_LABELS[category as Permission['category']] ?? category}
            </h4>
            {items.map((perm) => {
              const row = rowsFor(perm.key);
              const options = perm.supports_scope ? optionsFor(row.scope_type) : [];
              return (
                <div key={perm.key} className="border border-slate-200 rounded-xl p-3 sm:p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-700">{perm.label_ar}</span>
                    <div className="flex items-center gap-1 w-full sm:w-auto justify-end">
                      {(['preset', 'allow', 'deny'] as Mode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setRow(perm.key, { mode })}
                          className={`text-xs px-2.5 py-1.5 min-h-[34px] rounded-lg border transition ${
                            row.mode === mode
                              ? mode === 'deny'
                                ? 'bg-rose-600 text-white border-rose-600'
                                : mode === 'allow'
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-slate-700 text-white border-slate-700'
                              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {mode === 'preset' ? 'إلغاء التخصيص' : mode === 'allow' ? 'منح' : 'منع'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {row.mode === 'allow' && perm.supports_scope && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={row.scope_type}
                        onChange={(e) => setRow(perm.key, {
                          scope_type: e.target.value as PermissionScopeType,
                          scope_id: '',
                        })}
                        className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                      >
                        <option value="global">كل النظام</option>
                        <option value="subject">مادة دراسية محددة</option>
                        <option value="content_type">نوع محتوى محدد</option>
                        <option value="week">أسبوع محدد</option>
                        <option value="resource">مورد محدد</option>
                        <option value="exam">امتحان محدد</option>
                      </select>

                      {row.scope_type !== 'global' && (
                        <select
                          value={row.scope_id}
                          onChange={(e) => setRow(perm.key, { scope_id: e.target.value })}
                          className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                        >
                          <option value="">— اختر —</option>
                          {options.map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                      )}

                      <input
                        type="date"
                        value={row.expires_at}
                        onChange={(e) => setRow(perm.key, { expires_at: e.target.value })}
                        title="تاريخ انتهاء الصلاحية (اتركه فارغًا للدوام)"
                        className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                      />
                    </div>
                  )}

                  {row.mode === 'deny' && (
                    <p className="text-[11px] text-rose-600">
                      المنع يلغي كل سطور المنح لهذا المفتاح (والقالب معها)، ويمكن تحديد تاريخ انتهاء له.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="flex items-center gap-2 sticky bottom-0 bg-white pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ الحدود'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 text-sm hover:bg-slate-50 transition cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
