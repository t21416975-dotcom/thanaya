import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Globe, EyeOff, HelpCircle, Clock, Sparkles, Play } from 'lucide-react';
import { api } from '../api/client';
import { usePermissions } from '../lib/permissions';
import { ExamCreator } from './ExamCreator';
import type { Exam, ExamWithQuestions } from '@thanaya/types';

export function ExamsManager() {
  const queryClient = useQueryClient();
  const { can, scopedSubjects } = usePermissions();
  const [isCreating, setIsCreating] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamWithQuestions | null>(null);

  // Filters
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => api.getExams(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.getSubjects(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Exam> }) => api.updateExam(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteExam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });

  const togglePublish = (exam: Exam) => {
    updateMutation.mutate({
      id: exam.id,
      data: {
        is_published: !exam.is_published,
      },
    });
  };

  const openCreateView = () => {
    setEditingExam(null);
    setIsCreating(true);
  };

  const openEditView = async (exam: Exam) => {
    const fullExam = await api.getExamById(exam.id);
    setEditingExam(fullExam);
    setIsCreating(true);
  };

  const closeCreatorView = () => {
    setIsCreating(false);
    setEditingExam(null);
  };

  // Filter logic
  const filteredExams = exams.filter((e) => {
    if (filterSubject !== 'all' && e.subject_id !== filterSubject) return false;
    if (filterStatus === 'published' && !e.is_published) return false;
    if (filterStatus === 'draft' && e.is_published) return false;
    if (filterStatus === 'coming_soon' && !e.is_coming_soon) return false;
    return true;
  });

  if (isCreating) {
    return (
      <ExamCreator
        initialExam={editingExam}
        onClose={closeCreatorView}
        onSuccess={closeCreatorView}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center flex-wrap gap-2">
            <span>الامتحانات التجريبية التفاعلية (MCQs)</span>
            <span className="p-1 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Gemini AI</span>
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            إنشاء وإدارة وتصحيح الامتحانات التفاعلية مع التوليد التلقائي للأسئلة من ملفات الـ PDF
          </p>
        </div>

        {can('exams.create') && (
          <button
            onClick={openCreateView}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-4 py-2.5 sm:py-2 rounded-xl text-sm font-semibold transition shadow-sm w-full sm:w-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء امتحان جديد</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <label className="text-slate-500 text-[11px] font-semibold">المادة:</label>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">كل المواد</option>
              {subjects
                .filter((s) => scopedSubjects('exams.view').length === 0 || scopedSubjects('exams.view').includes(s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-500 text-[11px] font-semibold">حالة النشر:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">الكل</option>
              <option value="published">منشور فقط</option>
              <option value="draft">مسودة / غير منشور</option>
              <option value="coming_soon">قريباً</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>إجمالي الامتحانات: <strong className="text-slate-700 font-semibold">{filteredExams.length}</strong> امتحان</span>
          {(filterSubject !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={() => {
                setFilterSubject('all');
                setFilterStatus('all');
              }}
              className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
            >
              إعادة التعيين
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">جاري تحميل الامتحانات...</div>
      ) : (
        <>
          {/* Mobile Card View (shown below md:) */}
          <div className="md:hidden space-y-3">
            {filteredExams.map((exam) => {
              const questionCount = exam.questions?.length || 0;
              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug break-words">
                        {exam.title}
                      </h3>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        معرف: <span className="font-mono">{exam.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`/exams/${exam.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-xl transition flex items-center gap-1 text-xs active:scale-95"
                        title="معاينة واجهة الطالب"
                        aria-label="معاينة"
                      >
                        <Play className="w-4 h-4" />
                      </a>
                      {can('exams.update') && (
                        <button
                          onClick={() => openEditView(exam)}
                          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer active:scale-95"
                          title="تعديل ومراجعة الأسئلة"
                          aria-label="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {can('exams.delete') && (
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف الامتحان "${exam.title}" وكافة أسئلته؟`)) {
                              deleteMutation.mutate(exam.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer active:scale-95"
                          title="حذف"
                          aria-label="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Info Row: Subject & Questions & Time */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-lg font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
                      {exam.subject?.name || '—'}
                    </span>
                    <div className="flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                      <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{questionCount} سؤال</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.time_limit_minutes} دقيقة</span>
                    </div>
                  </div>

                  {/* Status and date footer */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="text-[11px] text-slate-400">
                      {new Date(exam.created_at).toLocaleDateString('ar-EG')}
                    </div>

                    <div className="flex items-center gap-2">
                      {can('exams.publish') ? (
                        <button
                          onClick={() => togglePublish(exam)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition active:scale-95 ${
                            exam.is_published
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                          }`}
                        >
                          {exam.is_published ? (
                            <>
                              <Globe className="w-3.5 h-3.5" />
                              <span>منشور للطلاب</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>مسودة</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                            exam.is_published
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {exam.is_published ? 'منشور' : 'مسودة'}
                        </span>
                      )}
                      {exam.is_coming_soon && !exam.is_published && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          قريباً
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredExams.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                لا توجد امتحانات مطابقة لمعايير البحث.
              </div>
            )}
          </div>

          {/* Desktop Table View (hidden on mobile, shown on md:) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm">
            <table className="w-full text-right border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="px-6 py-3">عنوان الامتحان</th>
                  <th className="px-6 py-3">المادة</th>
                  <th className="px-6 py-3">الأسئلة والمدة</th>
                  <th className="px-6 py-3">الحالة</th>
                  <th className="px-6 py-3">تاريخ الإنشاء</th>
                  <th className="px-6 py-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredExams.map((exam) => {
                  const questionCount = exam.questions?.length || 0;
                  return (
                    <tr key={exam.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{exam.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">معرف: {exam.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800">
                          {exam.subject?.name || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{questionCount} سؤال MCQ</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{exam.time_limit_minutes} دقيقة</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {can('exams.publish') ? (
                          <button
                            onClick={() => togglePublish(exam)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition ${
                              exam.is_published
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                          >
                            {exam.is_published ? (
                              <>
                                <Globe className="w-3.5 h-3.5" />
                                <span>منشور للطلاب</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>مسودة (Draft)</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              exam.is_published
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {exam.is_published ? (
                              <>
                                <Globe className="w-3.5 h-3.5" />
                                <span>منشور للطلاب</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>مسودة (Draft)</span>
                              </>
                            )}
                          </span>
                        )}
                        {exam.is_coming_soon && !exam.is_published && (
                          <span className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full border border-amber-200 font-bold mr-2">
                            قريباً
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {new Date(exam.created_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/exams/${exam.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition flex items-center gap-1 text-xs"
                            title="معاينة واجهة الطالب وتجربة الامتحان"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">معاينة</span>
                          </a>
                          {can('exams.update') && (
                            <button
                              onClick={() => openEditView(exam)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
                              title="تعديل ومراجعة الأسئلة"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {can('exams.delete') && (
                            <button
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف الامتحان "${exam.title}" وكافة أسئلته؟`)) {
                                  deleteMutation.mutate(exam.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredExams.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      لا توجد امتحانات مطابقة لمعايير البحث.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
