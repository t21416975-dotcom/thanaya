import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Upload,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  HelpCircle,
  Layers,
  ArrowUp,
  ArrowDown,
  Loader2,
} from 'lucide-react';
import { api } from '../api/client';
import { extractExamQuestionsFromPdf } from '../lib/gemini';
import type { ExamWithQuestions } from '@thanaya/types';

interface ExamCreatorProps {
  initialExam?: ExamWithQuestions | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface QuestionDraft {
  question_number: number;
  question_text: string;
  image_url?: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
}

export function ExamCreator({ initialExam, onClose, onSuccess }: ExamCreatorProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Exam Meta States
  const [title, setTitle] = useState(initialExam?.title || '');
  const [subjectId, setSubjectId] = useState(initialExam?.subject_id || '');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(initialExam?.time_limit_minutes || 30);
  const [isPublished, setIsPublished] = useState(initialExam ? initialExam.is_published : true);

  // Questions State
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initialExam?.questions && initialExam.questions.length > 0
      ? initialExam.questions.map((q) => ({
          question_number: q.question_number,
          question_text: q.question_text,
          image_url: q.image_url || '',
          options: Array.isArray(q.options) && q.options.length > 0 ? [...q.options] : ['', '', '', ''],
          correct_option_index: q.correct_option_index,
          explanation: q.explanation || '',
        }))
      : [
          {
            question_number: 1,
            question_text: '',
            image_url: '',
            options: ['', '', '', ''],
            correct_option_index: 0,
            explanation: '',
          },
        ]
  );

  // AI Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<string | null>(null);
  const [requestedQuestionsCount, setRequestedQuestionsCount] = useState<number | ''>('');

  // Errors & UI
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'ai-upload'>(initialExam ? 'editor' : 'ai-upload');

  // Queries
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => api.getSubjects() });
  const { data: systemSettings = [] } = useQuery({ queryKey: ['system_settings'], queryFn: () => api.getSystemSettings() });

  // Select first subject by default
  if (!subjectId && subjects.length > 0) {
    setSubjectId(subjects[0].id);
  }

  // --- Handlers for Question Editing ---
  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question_number: prev.length + 1,
        question_text: '',
        image_url: '',
        options: ['', '', '', ''],
        correct_option_index: 0,
        explanation: '',
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length === 1) {
      setError('يجب أن يحتوي الامتحان على سؤال واحد على الأقل.');
      return;
    }
    setQuestions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((q, idx) => ({ ...q, question_number: idx + 1 }));
    });
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    setQuestions((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next.map((q, idx) => ({ ...q, question_number: idx + 1 }));
    });
  };

  const handleQuestionTextChange = (index: number, val: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], question_text: val };
      return next;
    });
  };

  const handleOptionChange = (qIndex: number, optIndex: number, val: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      const newOptions = [...next[qIndex].options];
      newOptions[optIndex] = val;
      next[qIndex] = { ...next[qIndex], options: newOptions };
      return next;
    });
  };

  const handleCorrectOptionChange = (qIndex: number, optIndex: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], correct_option_index: optIndex };
      return next;
    });
  };

  const handleExplanationChange = (qIndex: number, val: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], explanation: val };
      return next;
    });
  };

  const handleImageUrlChange = (qIndex: number, val: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], image_url: val };
      return next;
    });
  };

  // --- AI PDF Extraction Handler ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        setError('يرجى اختيار ملف PDF صالح.');
        return;
      }
      setSelectedFile(file);
      setError(null);
      if (!title) {
        setTitle(file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
      }
    }
  };

  const handleExtractFromPdf = async () => {
    if (!selectedFile) {
      setError('يرجى اختيار ملف PDF أولاً.');
      return;
    }

    const count =
      typeof requestedQuestionsCount === 'number' && requestedQuestionsCount > 0
        ? requestedQuestionsCount
        : undefined;

    setIsExtracting(true);
    setExtractionStatus(
      count
        ? `جاري استخراج ${count} سؤال بالذكاء الاصطناعي عبر Gemini API...`
        : 'جاري قراءة ملف الـ PDF واستخراج الأسئلة بدقة عبر Gemini API...'
    );
    setError(null);

    try {
      const modelSetting = systemSettings.find((s) => s.key === 'gemini_model_name')?.value;
      const promptSetting = systemSettings.find((s) => s.key === 'gemini_exam_prompt')?.value;
      const apiKeySetting = systemSettings.find((s) => s.key === 'gemini_api_key')?.value;

      const result = await extractExamQuestionsFromPdf({
        file: selectedFile,
        modelName: modelSetting || 'gemini-2.5-flash',
        systemPrompt: promptSetting,
        apiKey: apiKeySetting,
        questionsCount: count,
      });

      if (!result.success || result.questions.length === 0) {
        throw new Error(result.error || 'تعذر استخراج الأسئلة من الملف. تأكد من احتواء الملف على نصوص واضحة.');
      }

      // Populate extracted questions into the editor
      setQuestions(
        result.questions.map((q, idx) => ({
          question_number: idx + 1,
          question_text: q.question_text,
          options: q.options.length >= 4 ? q.options.slice(0, 4) : [...q.options, ...Array(4 - q.options.length).fill('')],
          correct_option_index: q.correct_option_index,
          explanation: q.explanation || '',
        }))
      );

      // Estimate time limit (e.g. ~1.5 - 2 minutes per question)
      const estimatedMinutes = Math.max(15, Math.ceil(result.questions.length * 2));
      setTimeLimitMinutes(estimatedMinutes);

      setActiveTab('editor');
      setExtractionStatus(null);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء استخراج الأسئلة بالذكاء الاصطناعي.');
    } finally {
      setIsExtracting(false);
    }
  };

  // --- Validate & Submit ---
  const validate = (): boolean => {
    setError(null);
    if (!title.trim()) {
      setError('يرجى إدخال عنوان الامتحان.');
      return false;
    }
    if (!subjectId) {
      setError('يرجى اختيار المادة الدراسية.');
      return false;
    }
    if (timeLimitMinutes <= 0) {
      setError('يرجى تحديد مدة صالحة للامتحان بالدقائق.');
      return false;
    }
    if (questions.length === 0) {
      setError('يجب إضافة سؤال واحد على الأقل.');
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setError(`السؤال رقم (${i + 1}) لا يحتوي على نص. يرجى كتابة نص السؤال.`);
        return false;
      }
      const validOptions = q.options.filter((opt) => opt.trim().length > 0);
      if (validOptions.length < 2) {
        setError(`السؤال رقم (${i + 1}) يجب أن يحتوي على خيارين على الأقل.`);
        return false;
      }
    }

    return true;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const examPayload = {
        title: title.trim(),
        subject_id: subjectId,
        time_limit_minutes: timeLimitMinutes,
        is_published: isPublished,
      };

      const questionsPayload = questions.map((q, idx) => ({
        question_number: idx + 1,
        question_text: q.question_text.trim(),
        image_url: q.image_url?.trim() || null,
        options: q.options.map((opt) => opt.trim()),
        correct_option_index: q.correct_option_index,
        explanation: q.explanation.trim(),
      }));

      if (initialExam) {
        await api.updateExam(initialExam.id, examPayload, questionsPayload);
      } else {
        await api.createExam(examPayload, questionsPayload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || 'حدث خطأ أثناء حفظ الامتحان.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    saveMutation.mutate();
  };

  const optionLabels = ['أ', 'ب', 'ج', 'د'];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-50 gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition shrink-0 cursor-pointer"
            title="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              {initialExam ? `تعديل ومراجعة: ${initialExam.title}` : 'إنشاء امتحان تفاعلي جديد (MCQ Exam)'}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              توليد تلقائي بالذكاء الاصطناعي من ملفات PDF أو إدخال ومراجعة يدوية شاملة
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-200 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
          {!initialExam && (
            <button
              type="button"
              onClick={() => setActiveTab('ai-upload')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                activeTab === 'ai-upload' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>استخراج من PDF بالذكاء الاصطناعي</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
              activeTab === 'editor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>محرر ومراجع الأسئلة ({questions.length})</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* AI Upload & Extract Mode */}
      {activeTab === 'ai-upload' && !initialExam && (
        <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">إنشاء الامتحان بالذكاء الاصطناعي (Gemini PDF)</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              ارفع ملف الـ PDF الخاص بالتقييم أو نموذج الامتحان، وسيقوم الذكاء الاصطناعي باستخراج الأسئلة حرفياً وتحديد الإجابات وتوليد شرح تفسيري دقيق لكل سؤال.
            </p>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
              selectedFile
                ? 'border-emerald-500 bg-emerald-50/50'
                : 'border-slate-300 hover:border-emerald-400 bg-slate-50 hover:bg-emerald-50/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
              {selectedFile ? <FileText className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                {selectedFile ? selectedFile.name : 'اضغط لاختيار ملف PDF أو اسحبه هنا'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} ميجابايت`
                  : 'يدعم ملفات امتحانات وتقييمات البكالوريا (PDF)'}
              </p>
            </div>
          </div>

          {/* Quick subject & title selection */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">المادة الدراسية *</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">عنوان مقترح للامتحان</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: امتحان تجريبي شامل في الفيزياء"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Questions count configuration */}
            <div className="border-t border-slate-200/80 pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span>🎯 عدد الأسئلة المطلوب استخراجها:</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    (اختياري - حدد عدداً معيناً أو اتركه فارغاً لاستخراج الكل)
                  </span>
                </label>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  {requestedQuestionsCount ? `${requestedQuestionsCount} أسئلة محددة` : 'استخراج كل أسئلة الملف'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={requestedQuestionsCount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRequestedQuestionsCount(val === '' ? '' : Math.max(1, parseInt(val) || 1));
                  }}
                  placeholder="مثال: 10 (أو اتركه فارغاً لاستخراج كافة الأسئلة)"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
                {requestedQuestionsCount !== '' && (
                  <button
                    type="button"
                    onClick={() => setRequestedQuestionsCount('')}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer"
                  >
                    إعادة ضبط (الكل)
                  </button>
                )}
              </div>

              {/* Quick preset buttons */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[11px] text-slate-500 ml-1">خيارات سريعة:</span>
                {[
                  { label: 'الكل (تلقائي)', val: '' },
                  { label: '5 أسئلة', val: 5 },
                  { label: '10 أسئلة', val: 10 },
                  { label: '15 سؤال', val: 15 },
                  { label: '20 سؤال', val: 20 },
                  { label: '25 سؤال', val: 25 },
                  { label: '30 سؤال', val: 30 },
                ].map((preset) => {
                  const isSelected = requestedQuestionsCount === preset.val;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setRequestedQuestionsCount(preset.val as any)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {extractionStatus && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
              <span>{extractionStatus}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              تخطي واستخدام المحرر اليدوي
            </button>

            <button
              type="button"
              disabled={!selectedFile || isExtracting}
              onClick={handleExtractFromPdf}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm disabled:opacity-50"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الاستخراج بالذكاء الاصطناعي...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>استخراج الأسئلة وفتح المراجع</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Editor Mode: Full Review & Edit Interface */}
      {activeTab === 'editor' && (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Top Exam Meta Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <div className="sm:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 mb-1">عنوان الامتحان *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: امتحان تجريبي شامل في الفيزياء - التيار الكهربي وقانون كيرشوف"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">المادة الدراسية *</label>
              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>المدة الزمنية (بالدقائق) *</span>
              </label>
              <input
                type="number"
                min={5}
                max={240}
                required
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value) || 30)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Publishing state bar */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">حالة النشر:</span>
              <span className="text-xs text-slate-500">
                {isPublished ? 'الامتحان سيكون متاحاً للطلاب فور الحفظ.' : 'مسودة غير مرئية للطلاب.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsPublished(!isPublished)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                isPublished ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isPublished ? '✓ منشور للطلاب' : 'مسودة (Draft)'}
            </button>
          </div>

          {/* Questions Header & Quick Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>مراجعة وتعديل الأسئلة</span>
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {questions.length} أسئلة
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                حدد الإجابة الصحيحة بنقرة على زر الخيار الأخضر، وعدّل نصوص الأسئلة والخيارات والتفسير بحرية
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddQuestion}
              className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-lg text-xs font-bold transition"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سؤال جديد</span>
            </button>
          </div>

          {/* Question List Cards */}
          <div className="space-y-6">
            {questions.map((q, qIndex) => (
              <div
                key={qIndex}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-6 shadow-sm space-y-4 transition"
              >
                {/* Question Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                      {qIndex + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700">السؤال رقم {qIndex + 1}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={qIndex === 0}
                      onClick={() => handleMoveQuestion(qIndex, 'up')}
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                      title="تحريك لأعلى"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={qIndex === questions.length - 1}
                      onClick={() => handleMoveQuestion(qIndex, 'down')}
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                      title="تحريك لأسفل"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIndex)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                      title="حذف هذا السؤال"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">نص السؤال *</label>
                  <textarea
                    rows={2}
                    required
                    value={q.question_text}
                    onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                    placeholder="اكتب نص السؤال هنا..."
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {/* Optional Image URL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <span>🖼️ صورة السؤال (رابط مباشر — اختياري)</span>
                    {q.image_url && (
                      <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                        معاينة متاحة
                      </span>
                    )}
                  </label>
                  <input
                    type="url"
                    value={q.image_url || ''}
                    onChange={(e) => handleImageUrlChange(qIndex, e.target.value)}
                    placeholder="https://example.com/image.png (اختياري)"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium dir-ltr text-left"
                    dir="ltr"
                  />
                  {q.image_url && q.image_url.trim() !== '' && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-h-48">
                      <img
                        src={q.image_url}
                        alt="معاينة صورة السؤال"
                        className="w-full max-h-48 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                        onLoad={(e) => {
                          (e.target as HTMLImageElement).style.display = '';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.add('hidden');
                        }}
                      />
                      <p className="hidden text-[11px] text-rose-500 px-3 py-2">⚠️ تعذّر تحميل الصورة — تأكد من صحة الرابط</p>
                    </div>
                  )}
                </div>

                {/* 4 Options with Radio Button */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    الخيارات الأربعة (اضغط على الدائرة لتحديد الإجابة الصحيحة) *
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options.map((optionText, optIndex) => {
                      const isCorrect = q.correct_option_index === optIndex;
                      return (
                        <div
                          key={optIndex}
                          onClick={() => handleCorrectOptionChange(qIndex, optIndex)}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`correct_opt_${qIndex}`}
                            checked={isCorrect}
                            onChange={() => handleCorrectOptionChange(qIndex, optIndex)}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="w-6 h-6 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-center shrink-0">
                            {optionLabels[optIndex] || optIndex + 1}
                          </span>
                          <input
                            type="text"
                            required
                            value={optionText}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                            placeholder={`الخيار (${optionLabels[optIndex] || optIndex + 1})`}
                            className="flex-1 bg-white px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          {isCorrect && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
                              صحيح
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation & Reasoning */}
                <div className="pt-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>التفسير والشرح النموذجي لسبب اختيار هذه الإجابة (يظهر للطالب بعد التسليم)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={q.explanation}
                    onChange={(e) => handleExplanationChange(qIndex, e.target.value)}
                    placeholder="الشرح والتفسير لخطوات الحل أو القاعدة العلمية/اللغوية..."
                    className="w-full px-3.5 py-2 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add Question Button at bottom */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleAddQuestion}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border-2 border-dashed border-slate-300 hover:border-emerald-500 px-6 py-3 rounded-xl text-xs font-bold transition"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>+ إضافة سؤال جديد للامتحان</span>
            </button>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl text-sm font-bold transition shadow-sm disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <span>جاري الحفظ في قاعدة البيانات...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{initialExam ? 'حفظ تعديلات الامتحان' : 'حفظ ونشر الامتحان'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
