import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Target, Users2 } from 'lucide-react';
import { api } from '../api/client';

const PAGE_SIZE = 20;
const LETTERS = ['أ', 'ب', 'ج', 'د'];

/**
 * تحليل الأسئلة على مستوى المنصة.
 *
 * ★ يتطلّب analytics.view (متاح في قالب admin). البيانات تجميعية عن صعوبة
 *   السؤال — بلا اسم طالب ولا بريد. بيانات الطلبة الفردية تبقى في تبويب
 *   «الطلاب» وتطلب students.view.
 *
 * القيمة: كشف الأسئلة الغامضة (توزيع الإجابات متشتت) والأسئلة التي تُخطئ
 * فيها المنصة كلها — مرشحة لإعادة صياغة.
 */
export function QuestionAnalytics() {
  const [subjectId, setSubjectId] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.getSubjects(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['question_analytics', subjectId, page],
    queryFn: () => api.getAnalytics(subjectId || undefined, PAGE_SIZE, page * PAGE_SIZE),
  });

  const items = data?.items ?? [];
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const overall = data?.overall;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">تحليل الأسئلة</h2>
          <p className="text-sm text-slate-500">
            أصعب الأسئلة على مستوى المنصة — بيانات تجميعية لا relate بالطلاب
          </p>
        </div>
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
      </div>

      {overall && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <OverviewStat icon={Users2} label="طلبة مسجّلون" value={overall.students} />
          <OverviewStat icon={BarChart3} label="إجابات مُحلَّلة" value={overall.questions_answered} />
          <OverviewStat
            icon={TrendingUp}
            label="دقة المنصة"
            value={overall.accuracy === null ? '—' : `${overall.accuracy}%`}
            tone={
              overall.accuracy === null
                ? 'text-slate-900'
                : overall.accuracy >= 70
                  ? 'text-emerald-700'
                  : overall.accuracy >= 50
                    ? 'text-amber-600'
                    : 'text-rose-600'
            }
          />
          <OverviewStat
            icon={Target}
            label="نسبة الإتقان"
            value={overall.mastered_rate === null ? '—' : `${overall.mastered_rate}%`}
            tone="text-emerald-700"
          />
        </div>
      )}

      {isLoading && <div className="text-sm text-slate-500 py-8 text-center">جارٍ التحميل…</div>}
      {error && (
        <div className="rounded-xl bg-rose-50 text-rose-800 px-4 py-3 text-sm">
          {(error as Error).message.includes('غير مصرح')
            ? 'لا تملك صلاحية analytics.view'
            : (error as Error).message}
        </div>
      )}
      {!isLoading && !error && items.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">لا توجد بيانات بعد —needs إجابات طلبة مسجّلين.</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="space-y-3">
            {items.map((q) => {
              const dist = q.options_distribution || {};
              const max = Math.max(1, ...Object.values(dist).map((v) => Number(v)));
              const isOpen = expanded === q.question_id;
              return (
                <div key={q.question_id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => setExpanded(isOpen ? null : q.question_id)}
                      className="flex-1 min-w-0 text-right"
                    >
                      <p className="text-sm font-semibold text-slate-900 leading-relaxed line-clamp-2">
                        {q.text}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{q.subject_name}</p>
                    </button>
                    <div className="text-left shrink-0">
                      <div
                        className={`text-xl font-bold tabular-nums ${
                          (q.error_rate ?? 0) >= 60
                            ? 'text-rose-600'
                            : (q.error_rate ?? 0) >= 35
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                        }`}
                      >
                        {q.error_rate ?? 0}%
                      </div>
                      <p className="text-[10px] text-slate-500">نسبة الخطأ</p>
                    </div>
                  </div>

                  {/* شريط نسبة الخطأ */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        (q.error_rate ?? 0) >= 60
                          ? 'bg-rose-500'
                          : (q.error_rate ?? 0) >= 35
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, q.error_rate ?? 0)}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                    <span>الظهورات: <strong className="text-slate-700">{q.attempts}</strong></span>
                    <span>أخطأ: <strong className="text-rose-600">{q.wrong}</strong></span>
                    <span>بلا إجابة: <strong>{q.blank}</strong></span>
                    <span>طلاب أخطأوا: <strong className="text-slate-700">{q.students_wrong}</strong></span>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-700">توزيع إجابات الطلاب</p>
                      {[0, 1, 2, 3].map((i) => {
                        const count = Number(dist[String(i)] ?? 0);
                        const pct = q.attempts > 0 ? Math.round((count / q.attempts) * 100) : 0;
                        const isCorrect = i === (q as any).__correct_index;
                        return (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <span className="w-6 shrink-0 font-bold text-slate-600">{LETTERS[i]}</span>
                            <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                              <div
                                className="h-full rounded bg-slate-400"
                                style={{ width: `${(count / max) * 100}%` }}
                              />
                            </div>
                            <span className="w-14 shrink-0 text-left tabular-nums text-slate-500">
                              {count} ({pct}%)
                            </span>
                            {isCorrect && (
                              <span className="shrink-0 text-emerald-600 font-bold">✓</span>
                            )}
                          </div>
                        );
                      })}
                      <p className="pt-1 text-[10px] text-slate-400">
                        علامة ✓ بجانب الخيار الصحيح. تشتّت التوزيع — أو تهيمن إجابة
                        خاطئة واحدة — قد يشير إلى سؤال غامض يحتاج إعادة صياغة.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                السابق
              </button>
              <span className="tabular-nums">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const OverviewStat = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BarChart3;
  label: string;
  value: React.ReactNode;
  tone?: string;
}) => (
  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center">
    <Icon className="w-4 h-4 mx-auto mb-1 text-slate-400" />
    <div className={`text-xl font-bold tabular-nums ${tone ?? 'text-slate-900'}`}>{value}</div>
    <div className="mt-0.5 text-[11px] text-slate-500">{label}</div>
  </div>
);
