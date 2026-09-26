import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Users, Download, UserX, UserCheck, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { api } from '../api/client';
import { usePermissions } from '../lib/permissions';
import { Modal } from './Modal';
import type { AdminStudentRow } from '@thanaya/types';

const PAGE_SIZE = 20;

const GRADE_LABELS: Record<string, string> = {
  third: 'ثالثة',
  second: 'ثانية',
  first: 'أولى',
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso)
    );
  } catch {
    return '—';
  }
};

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
};

const scoreTone = (score?: number | null) => {
  if (score === null || score === undefined) return 'text-slate-500';
  if (score >= 85) return 'text-emerald-700';
  if (score >= 70) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-rose-600';
};

/** يبني CSV من الصفوف الحالية مع BOM حتى يفتح Excel العربية بشكل صحيح. */
function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (v: string | number | null) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
}

export function StudentsManager() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManage = can('students.manage');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState<boolean | null>(null);
  const [sort, setSort] = useState<'recent' | 'name' | 'attempts' | 'accuracy'>('recent');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminStudentRow | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // debounce بسيط للبحث (لا نضرب الخادم بكل حرف)
  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
    window.clearTimeout((onSearchChange as unknown as { t?: number }).t);
    (onSearchChange as unknown as { t?: number }).t = window.setTimeout(() => setDebounced(value), 350);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin_students', debounced, active, sort, page],
    queryFn: () =>
      api.getStudents({
        search: debounced || undefined,
        active,
        sort,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.setActive(id, isActive),
    onSuccess: (_v, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin_students'] });
      queryClient.invalidateQueries({ queryKey: ['admin_student_detail'] });
      setToast({
        kind: 'ok',
        text: vars.isActive ? 'تم تنشيط الحساب' : 'تم تعطيل الحساب — لن يتمكن من الدخول',
      });
    },
    onError: (e: Error) => setToast({ kind: 'error', text: friendly(e.message) }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = () => {
    if (items.length === 0) return;
    const csv = toCsv(
      ['الاسم', 'البريد', 'الصف', 'المزود', 'موثق', 'الحالة', 'امتحانات', 'أسئلة', 'صحيح', 'خطأ', 'الدقة %', 'أسئلة خطأ', 'التسجيل', 'آخر ظهور'],
      items.map((s) => [
        s.full_name || '', s.email, GRADE_LABELS[s.grade || ''] || '', s.provider,
        s.email_verified ? 'نعم' : 'لا', s.is_active ? 'نشط' : 'معطّل',
        s.attempts, s.questions, s.correct, s.wrong, s.accuracy ?? '', s.wrong_questions,
        fmtDate(s.created_at), fmtDateTime(s.last_seen_at),
      ])
    );
    downloadCsv(csv, `students-page-${page + 1}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">الطلاب</h2>
          <p className="text-sm text-slate-500">
            حسابات الطلاب، نتائجهم، والأسئلة التي يخطئون فيها
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={items.length === 0}
          className="inline-flex items-center justify-center gap-2 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          تصدير CSV
        </button>
      </div>

      {toast && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            toast.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* ملخص عام */}
      {data?.overall && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="إجمالي الطلاب" value={data.overall.students} />
          <Stat label="نشط" value={data.overall.active} tone="text-emerald-700" />
          <Stat label="معطّل" value={data.overall.inactive} tone="text-rose-600" />
          <Stat
            label="دقة المنصة"
            value={data.overall.accuracy === null ? '—' : `${data.overall.accuracy}%`}
            tone={scoreTone(data.overall.accuracy)}
          />
        </div>
      )}

      {/* فلاتر */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ابحث بالاسم أو البريد…"
            className="w-full border border-slate-300 rounded-lg pr-9 pl-3 py-2 text-sm bg-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={active === null ? 'all' : active ? 'active' : 'inactive'}
          onChange={(e) => {
            const v = e.target.value;
            setActive(v === 'all' ? null : v === 'active');
            setPage(0);
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
        >
          <option value="all">كل الحالات</option>
          <option value="active">نشط فقط</option>
          <option value="inactive">معطّل فقط</option>
        </select>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as typeof sort);
            setPage(0);
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
        >
          <option value="recent">الأحدث نشاطًا</option>
          <option value="name">الاسم</option>
          <option value="attempts">عدد الامتحانات</option>
          <option value="accuracy">الدقة</option>
        </select>
      </div>

      {isLoading && <div className="text-sm text-slate-500 py-8 text-center">جارٍ التحميل…</div>}
      {error && (
        <div className="rounded-xl bg-rose-50 text-rose-800 px-4 py-3 text-sm">
          {friendly((error as Error).message)}
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">لا يوجد طلاب مطابقون.</p>
        </div>
      )}

      {/* جدول (سطح المكتب) */}
      {items.length > 0 && (
        <>
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <Th>الطالب</Th>
                  <Th>الصف</Th>
                  <Th>الحالة</Th>
                  <Th>امتحانات</Th>
                  <Th>الدقة</Th>
                  <Th>أسئلة خطأ</Th>
                  <Th>آخر ظهور</Th>
                  <Th>إجراءات</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setSelected(s)}
                        className="flex items-center gap-2 text-right hover:text-emerald-700"
                      >
                        {s.avatar_url ? (
                          <img
                            src={s.avatar_url}
                            alt=""
                            width="32"
                            height="32"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <span className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                            {(s.full_name || s.email).charAt(0)}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-900 truncate">
                            {s.full_name || 'بدون اسم'}
                          </span>
                          <span className="block text-[11px] text-slate-500 truncate">{s.email}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{GRADE_LABELS[s.grade || ''] || '—'}</td>
                    <td className="px-3 py-3">
                      <Badge active={s.is_active} />
                    </td>
                    <td className="px-3 py-3 text-slate-700 tabular-nums">{s.attempts}</td>
                    <td className={`px-3 py-3 font-bold tabular-nums ${scoreTone(s.accuracy)}`}>
                      {s.accuracy ?? 0}%
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      <span className={s.wrong_questions > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}>
                        {s.wrong_questions}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                      {fmtDateTime(s.last_seen_at)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelected(s)}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          تفاصيل
                        </button>
                        {canManage && (
                          <button
                            onClick={() =>
                              setActiveMutation.mutate({ id: s.id, isActive: !s.is_active })
                            }
                            title={s.is_active ? 'تعطيل الحساب' : 'تنشيط الحساب'}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                          >
                            {s.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* بطاقات (الجوال) */}
          <div className="lg:hidden space-y-3">
            {items.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold shrink-0">
                    {(s.full_name || s.email).charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{s.full_name || 'بدون اسم'}</p>
                    <p className="text-xs text-slate-500 truncate">{s.email}</p>
                  </div>
                  <Badge active={s.is_active} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="font-bold text-slate-900 tabular-nums">{s.attempts}</div>
                    <div className="text-slate-500">امتحان</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className={`font-bold tabular-nums ${scoreTone(s.accuracy)}`}>{s.accuracy ?? 0}%</div>
                    <div className="text-slate-500">دقة</div>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-2">
                    <div className="font-bold text-rose-700 tabular-nums">{s.wrong_questions}</div>
                    <div className="text-rose-600">خطأ</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelected(s)}
                    className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-semibold text-slate-700"
                  >
                    التفاصيل
                  </button>
                  {canManage && (
                    <button
                      onClick={() => setActiveMutation.mutate({ id: s.id, isActive: !s.is_active })}
                      className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-semibold text-slate-700"
                    >
                      {s.is_active ? 'تعطيل' : 'تنشيط'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ترقيم */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                السابق
              </button>
              <span className="tabular-nums">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} من {total}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                التالي
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}

      <StudentDetailModal
        student={selected}
        onClose={() => setSelected(null)}
        onDeleted={() => {
          setSelected(null);
          setToast({ kind: 'ok', text: 'تم حذف بيانات الطالب وحسابه' });
          queryClient.invalidateQueries({ queryKey: ['admin_students'] });
        }}
      />
    </div>
  );
}

// ── تفاصيل الطالب ──────────────────────────────────────────────────────────

function StudentDetailModal({
  student,
  onClose,
  onDeleted,
}: {
  student: AdminStudentRow | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { can } = usePermissions();
  const canManage = can('students.manage');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin_student_detail', student?.id],
    queryFn: () => api.getStudentDetail(student!.id),
    enabled: Boolean(student?.id),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteStudentData(id),
    onSuccess: onDeleted,
  });

  const reset = () => {
    setConfirmDelete(false);
  };

  const s = data?.summary;
  const perf = data?.performance;

  return (
    <Modal
      isOpen={Boolean(student)}
      onClose={() => {
        reset();
        onClose();
      }}
      title={student ? (student.full_name || student.email) : ''}
      maxWidth="max-w-3xl"
    >
      {isLoading && <p className="text-sm text-slate-500 py-6 text-center">جارٍ التحميل…</p>}

      {data && (
        <div className="space-y-6">
          {/* معلومات الحساب */}
          <div className="rounded-xl bg-slate-50 p-4 space-y-1 text-xs text-slate-600">
            <p>
              <span className="text-slate-400">البريد:</span>{' '}
              <span className="font-medium text-slate-800">{data.student.email}</span>
            </p>
            <p>
              <span className="text-slate-400">المزوّد:</span>{' '}
              {data.student.provider === 'google' ? 'Google' : 'بريد إلكتروني'}
              {' · '}
              <span className="text-slate-400">موثّق:</span>{' '}
              {data.student.email_verified ? 'نعم' : 'لا'}
            </p>
            <p>
              <span className="text-slate-400">التسجيل:</span> {fmtDate(data.student.created_at)}
              {' · '}
              <span className="text-slate-400">آخر ظهور:</span> {fmtDateTime(data.student.last_seen_at)}
            </p>
          </div>

          {/* ملخص */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="امتحانات" value={s?.attempts ?? 0} />
            <Stat label="أسئلة" value={s?.questions ?? 0} />
            <Stat label="الدقة" value={`${s?.accuracy ?? 0}%`} tone={scoreTone(s?.accuracy)} />
            <Stat label="أخطاء متبقية" value={perf?.still_wrong ?? 0} tone="text-rose-600" />
          </div>

          {/* حسب المادة */}
          {data.subjects.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">حسب المادة</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <Th>المادة</Th>
                      <Th>امتحانات</Th>
                      <Th>المتوسط</Th>
                      <Th>الأفضل</Th>
                      <Th>الدقة</Th>
                      <Th>خطأ</Th>
                      <Th>متقن</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.subjects.map((sub) => (
                      <tr key={sub.subject_id}>
                        <td className="px-3 py-2 font-medium text-slate-900">{sub.subject_name}</td>
                        <td className="px-3 py-2 tabular-nums">{sub.attempts_count}</td>
                        <td className="px-3 py-2 tabular-nums">{sub.avg_score ?? 0}%</td>
                        <td className="px-3 py-2 tabular-nums">{sub.best_score ?? 0}%</td>
                        <td className={`px-3 py-2 font-bold tabular-nums ${scoreTone(sub.accuracy)}`}>
                          {sub.accuracy ?? 0}%
                        </td>
                        <td className="px-3 py-2 tabular-nums text-rose-600">{sub.wrong_questions_count}</td>
                        <td className="px-3 py-2 tabular-nums text-emerald-700">{sub.mastered_questions_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* سجل الامتحانات */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900">آخر الامتحانات ({data.attempts.length})</h3>
            {data.attempts.length === 0 ? (
              <p className="text-xs text-slate-500">لا توجد محاولات.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.attempts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {(a as any).exam_title || (a as any).subject_name}
                      </p>
                      <p className="text-slate-500">
                        {fmtDateTime((a as any).submitted_at)} ·{' '}
                        {(a as any).mode === 'review' ? 'امتحان أخطاء' : 'امتحان'}
                        {(a as any).flagged_suspicious ? ' · ⚠ معلّم' : ''}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <span className={`font-bold tabular-nums ${scoreTone((a as any).score_percentage)}`}>
                        {(a as any).score_percentage ?? 0}%
                      </span>
                      <p className="text-slate-500 tabular-nums">
                        {(a as any).correct_count}✓ / {(a as any).wrong_count}✗
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* إجراءات */}
          {canManage && (
            <section className="border-t border-slate-200 pt-4 space-y-3">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-rose-700 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف كل بيانات الطالب (غير قابل للتراجع)
                </button>
              ) : (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3">
                  <p className="text-xs text-rose-900 leading-relaxed">
                    سيُحذف: كل المحاولات وإجاباتها، سجل الأسئلة الخاطئة، تجميعات المواد،
                    <strong> وحسابه في نظام الدخول</strong> (لن يستطيع الدخول مجددًا).
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => student && deleteMutation.mutate(student.id)}
                      disabled={deleteMutation.isPending}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? 'جارٍ الحذف…' : 'تأكيد الحذف النهائي'}
                    </button>
                    <button
                      onClick={reset}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      إلغاء
                    </button>
                  </div>
                  {deleteMutation.error && (
                    <p className="text-xs text-rose-800">{friendly((deleteMutation.error as Error).message)}</p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── عناصر مشتركة ───────────────────────────────────────────────────────────

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">{children}</th>
);

const Stat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center">
    <div className={`text-xl font-bold tabular-nums ${tone ?? 'text-slate-900'}`}>{value}</div>
    <div className="mt-0.5 text-[11px] text-slate-500">{label}</div>
  </div>
);

const Badge = ({ active }: { active: boolean }) => (
  <span
    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
      active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
    }`}
  >
    {active ? 'نشط' : 'معطّل'}
  </span>
);

function friendly(message: string): string {
  if (message.includes('غير مصرح')) return 'لا تملك صلاحية لهذا الإجراء';
  if (message.includes('غير موجود')) return 'العنصر غير موجود';
  if (message.includes('معطّل')) return 'الحساب معطّل';
  return message || 'حدث خطأ غير متوقع';
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
