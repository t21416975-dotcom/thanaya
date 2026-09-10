import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Globe, EyeOff, HelpCircle, Clock, Sparkles, Play } from 'lucide-react';
import { api } from '../api/client';
import { ExamCreator } from './ExamCreator';
import type { Exam, ExamWithQuestions } from '@thanaya/types';

export function ExamsManager() {
  const queryClient = useQueryClient();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>الامتحانات التجريبية التفاعلية (MCQs)</span>
            <span className="p-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>مدعوم بـ Gemini AI</span>
            </span>
          </h2>
          <p className="text-sm text-slate-500">
            إنشاء وإدارة وتصحيح الامتحانات التفاعلية مع التوليد التلقائي للأسئلة من ملفات الـ PDF
          </p>
        </div>

        <button
          onClick={openCreateView}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm self-start"
        >
          <Plus className="w-4 h-4" />
          <span>+ إنشاء امتحان جديد</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-4 text-sm shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs font-semibold">المادة:</span>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none"
          >
            <option value="all">كل المواد</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs font-semibold">حالة النشر:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none"
          >
            <option value="all">الكل</option>
            <option value="published">منشور فقط</option>
            <option value="draft">مسودة / غير منشور</option>
          </select>
        </div>

        <div className="mr-auto text-xs text-slate-400">
          إجمالي الامتحانات: <strong className="text-slate-700">{filteredExams.length}</strong> امتحان
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">جاري تحميل الامتحانات...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right border-collapse">
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
                        <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
                        <span>{questionCount} سؤال MCQ</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{exam.time_limit_minutes} دقيقة</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
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
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(exam.created_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-6 py-4 text-left">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/exams/${exam.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition flex items-center gap-1 text-xs"
                          title="معاينة واجهة الطالب وتجربة الامتحان"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">معاينة</span>
                        </a>
                        <button
                          onClick={() => openEditView(exam)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                          title="تعديل ومراجعة الأسئلة"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف الامتحان "${exam.title}" وكافة أسئلته؟`)) {
                              deleteMutation.mutate(exam.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
      )}
    </div>
  );
}
