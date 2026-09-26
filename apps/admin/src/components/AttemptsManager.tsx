import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download, Flag, Trash2, ChevronLeft, ChevronRight, Activity, AlertTriangle,
} from 'lucide-react';
import { api } from '../api/client';
import { usePermissions } from '../lib/permissions';
import { Modal } from './Modal';
import type { AdminAttemptRow, AttemptMode, AttemptStatus } from '@thanaya/types';

const PAGE_SIZE = 20;

const MODE_LABELS: Record<string, string> = {
  exam: 'امتحان',
  review: 'امتحان أخطاء',
  mock: 'تدريب',
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'جارٍ',
  submitted: 'مسلَّم',
  abandoned: 'متروك',
  expired: 'منتهي',
};

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
};

const fmtDuration = (seconds?: number | null) => {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const scoreTone = (score?: number | null) => {
  if (score === null || score === undefined) return 'text-slate-500';
  if (score >= 85) return 'text-emerald-700';
  if (score >= 70) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-rose-600';
};

export function AttemptsManager() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManage = can('attempts.manage');

  const [subjectId, setSubjectId] = useState('');
  const [mode, setMode] = useState<AttemptMode | ''>('');
  const [status, setStatus] = useState<AttemptStatus | ''>('');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminAttemptRow | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.getSubjects(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin_attempts', subjectId, mode, status, onlyFlagged, page],
    queryFn: () =>
      api.getAttempts({
        subjectId: subjectId || undefined,
        mode: mode || null,
        status: status || null,
        onlyFlagged,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });

  const flagMutation = useMutation({
    mutationFn: ({ id, flagged, reason }: { id: string; flagged: boolean; reason?: string }) =>
      api.flagAttempt(id, flagged, reason ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_attempts'] });
      setToast({ kind: 'ok', text: 'تم تحديث علامة المحاولة' });
    },
    onError: (e: Error) => setToast({ kind: 'error', text: friendly(e.message) }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sum = data?.summary;

  const exportCsv = () => {
    if (items.length === 0) return;
    const esc = (v: string | number | null) => {
      const t = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const rows: (string | number | null)[][] = [
      ['التاريخ', 'الطالب', 'البريد', 'المادة', 'الامتحان', 'النوع', 'الحالة', 'النتيجة %', 'صحيح', 'خطأ', 'فارغ', 'الوقت (ث)', 'معلّم'],
      ...items.map((a) => [
        fmtDateTime(a.submitted_at || a.started_at), a.student_name || '', a.student_email,
        a.subject_name, a.exam_title || '', MODE_LABELS[a.mode] ?? a.mode,
        STATUS_LABELS[a.status] ?? a.status, a.score_percentage ?? '',
        a.correct_count, a.wrong_count, a.blank_count, a.time_spent_seconds,
        a.flagged_suspicious ? 'نعم' : 'لا',
      ]),
    ];
    const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attempts-page-${page + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">الامتحانات والنتائج</h2>
          <p className="text-sm text-slate-500">كل محاولات الطلاب مع إمكانية التصفية والتحقيق</p>
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

      {sum && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center">
            <div className="text-xl font-bold text-slate-900 tabular-nums">{sum.attempts}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">محاولة مسلَّمة</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center">
            <div className={`text-xl font-bold tabular-nums ${scoreTone(sum.avg_score)}`}>
              {sum.avg_score ?? 0}%
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">متوسط الدرجات</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center">
            <div className="text-xl font-bold text-emerald-700 tabular-nums">{sum.review_attempts}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">امتحان أخطاء</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center">
            <div className="text-xl font-bold text-rose-600 tabular-nums">
              {sum.flagged + sum.abandoned}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">معلّم / متروك</div>
          </div>
        </div>
      )}

      {/* فلاتر */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <select
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            setPage(0);
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
        >
          <option value="">كل المواد</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as typeof mode);
            setPage(0);
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
        >
          <option value="">كل الأنواع</option>
          <option value="exam">امتحان</option>
          <option value="review">امتحان أخطاء</option>
          <option value="mock">تدريب</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(0);
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
        >
          <option value="">كل الحالات</option>
          <option value="submitted">مسلَّمة</option>
          <option value="in_progress">جارٍ</option>
          <option value="abandoned">متروكة</option>
          <option value="expired">منتهية</option>
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white cursor-pointer">
          <input
            type="checkbox"
            checked={onlyFlagged}
            onChange={(e) => {
              setOnlyFlagged(e.target.checked);
              setPage(0);
            }}
            className="h-3.5 w-3.5 accent-rose-600"
          />
          المحاولات المعلّمة فقط
        </label>
      </div>

      {isLoading && <div className="text-sm text-slate-500 py-8 text-center">جارٍ التحميل…</div>}
      {error && (
        <div className="rounded-xl bg-rose-50 text-rose-800 px-4 py-3 text-sm">
          {friendly((error as Error).message)}
        </div>
      )}
      {!isLoading && !error && items.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Activity className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">لا توجد محاولات مطابقة.</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">التاريخ</th>
                  <th className="px-3 py-2.5 font-semibold">الطالب</th>
                  <th className="px-3 py-2.5 font-semibold">المادة / الامتحان</th>
                  <th className="px-3 py-2.5 font-semibold">النوع</th>
                  <th className="px-3 py-2.5 font-semibold">النتيجة</th>
                  <th className="px-3 py-2.5 font-semibold">صحيح/خطأ</th>
                  <th className="px-3 py-2.5 font-semibold">الوقت</th>
                  <th className="px-3 py-2.5 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                      {fmtDateTime(a.submitted_at || a.started_at)}
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => setSelected(a)} className="text-right hover:text-emerald-700">
                        <span className="block font-semibold text-slate-900">
                          {a.student_name || '—'}
                        </span>
                        <span className="block text-[11px] text-slate-500">{a.student_email}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <span className="block">{a.subject_name}</span>
                      {a.exam_title && (
                        <span className="block text-[11px] text-slate-500">{a.exam_title}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          a.mode === 'review' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {MODE_LABELS[a.mode] ?? a.mode}
                      </span>
                      {a.status !== 'submitted' && (
                        <span className="mr-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          {STATUS_LABELS[a.status] ?? a.status}
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-3 font-bold tabular-nums ${scoreTone(a.score_percentage)}`}>
                      {a.score_percentage ?? 0}%
                    </td>
                    <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                      <span className="text-emerald-700 font-semibold">{a.correct_count}✓</span>{' '}
                      <span className="text-rose-600 font-semibold">{a.wrong_count}✗</span>{' '}
                      <span className="text-slate-400">{a.blank_count}—</span>
                    </td>
                    <td className="px-3 py-3 text-slate-500 tabular-nums">
                      {fmtDuration(a.time_spent_seconds)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelected(a)}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          تفاصيل
                        </button>
                        {a.flagged_suspicious && (
                          <span title={a.flag_reason || 'معلّمة'} className="text-rose-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {canManage && (
                          <button
                            onClick={() =>
                              flagMutation.mutate({
                                id: a.id,
                                flagged: !a.flagged_suspicious,
                                reason: 'تم التعليم من لوحة التحكم',
                              })
                            }
                            title={a.flagged_suspicious ? 'إلغاء التعليم' : 'تعليم كاشتباه غش'}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

      <AttemptDetailModal
        attempt={selected}
        onClose={() => setSelected(null)}
        canManage={canManage}
        onDeleted={() => {
          setSelected(null);
          setToast({ kind: 'ok', text: 'حُذفت المحاولة وأُعيد حساب إحصاءات الطالب' });
          queryClient.invalidateQueries({ queryKey: ['admin_attempts'] });
        }}
        onFlagged={() => queryClient.invalidateQueries({ queryKey: ['admin_attempts'] })}
      />
    </div>
  );
}

// ── تفاصيل المحاولة ────────────────────────────────────────────────────────

function AttemptDetailModal({
  attempt,
  onClose,
  canManage,
  onDeleted,
  onFlagged,
}: {
  attempt: AdminAttemptRow | null;
  onClose: () => void;
  canManage: boolean;
  onDeleted: () => void;
  onFlagged: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin_attempt_detail', attempt?.id],
    queryFn: () => api.getAttemptDetail(attempt!.id),
    enabled: Boolean(attempt?.id),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAttempt(id),
    onSuccess: onDeleted,
  });

  const flagMutation = useMutation({
    mutationFn: ({ id, flagged }: { id: string; flagged: boolean }) => api.flagAttempt(id, flagged),
    onSuccess: onFlagged,
  });

  return (
    <Modal
      isOpen={Boolean(attempt)}
      onClose={() => {
        setConfirmDelete(false);
        onClose();
      }}
      title={attempt ? `محاولة — ${attempt.student_name || attempt.student_email}` : ''}
      maxWidth="max-w-3xl"
    >
      {isLoading && <p className="text-sm text-slate-500 py-6 text-center">جارٍ التحميل…</p>}

      {data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
            <MiniStat
              label="النتيجة"
              value={`${data.attempt.score_percentage ?? 0}%`}
              tone={scoreTone(data.attempt.score_percentage)}
            />
            <MiniStat label="صحيح" value={data.attempt.correct_count} tone="text-emerald-700" />
            <MiniStat label="خطأ" value={data.attempt.wrong_count} tone="text-rose-600" />
            <MiniStat label="الوقت" value={fmtDuration(data.attempt.time_spent_seconds)} />
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <p>
              <span className="text-slate-400">المادة:</span> {data.attempt.subject_name}
              {data.attempt.exam_title ? ` — ${data.attempt.exam_title}` : ' (امتحان أخطاء)'}
            </p>
            <p>
              <span className="text-slate-400">البداية:</span> {fmtDateTime(data.attempt.started_at)}
              {' · '}
              <span className="text-slate-400">التسليم:</span> {fmtDateTime(data.attempt.submitted_at)}
            </p>
            {data.attempt.flagged_suspicious && (
              <p className="text-rose-700 font-semibold">
                ⚠ معلّمة: {data.attempt.flag_reason || 'بدون سبب محدد'}
              </p>
            )}
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
              <button
                onClick={() =>
                  flagMutation.mutate({
                    id: data.attempt.id,
                    flagged: !data.attempt.flagged_suspicious,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Flag className="w-3.5 h-3.5" />
                {data.attempt.flagged_suspicious ? 'إلغاء التعليم' : 'تعليم كاشتباه غش'}
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 px-3 py-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف المحاولة
                </button>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span className="text-xs text-rose-700">ستُعاد حسابات الطالب — تأكيد؟</span>
                  <button
                    onClick={() => deleteMutation.mutate(data.attempt.id)}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'جارٍ…' : 'نعم، احذف'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    إلغاء
                  </button>
                </span>
              )}
            </div>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900">
              الإجابات ({data.answers.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto pl-1">
              {data.answers.map((q: any, i: number) => (
                <div
                  key={q.number ?? i}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    q.is_correct
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : q.is_blank
                        ? 'border-slate-200'
                        : 'border-rose-200 bg-rose-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      {q.number}. {String(q.text || '').slice(0, 90)}
                    </span>
                    <span
                      className={`shrink-0 font-bold ${
                        q.is_correct ? 'text-emerald-700' : q.is_blank ? 'text-slate-400' : 'text-rose-700'
                      }`}
                    >
                      {q.is_correct ? '✓' : q.is_blank ? '—' : '✗'}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-500">
                    اختر: {q.selected_index === null || q.selected_index === undefined
                      ? 'لم يُجب'
                      : ['أ', 'ب', 'ج', 'د'][q.selected_index] ?? q.selected_index}
                    {' · '}
                    الصحيح: {['أ', 'ب', 'ج', 'د'][q.correct_index] ?? q.correct_index}
                    {q.time_taken_seconds ? ` · ${q.time_taken_seconds}ث` : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}

const MiniStat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div className="rounded-xl border border-slate-200 px-3 py-2">
    <div className={`text-lg font-bold tabular-nums ${tone ?? 'text-slate-900'}`}>{value}</div>
    <div className="text-[10px] text-slate-500">{label}</div>
  </div>
);

function friendly(message: string): string {
  if (message.includes('غير مصرح')) return 'لا تملك صلاحية لهذا الإجراء';
  if (message.includes('غير موجود')) return 'العنصر غير موجود';
  return message || 'حدث خطأ غير متوقع';
}
