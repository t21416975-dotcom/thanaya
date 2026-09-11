import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Sparkles, Save, RotateCcw, CheckCircle2, AlertCircle, Cpu, HelpCircle, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_PROMPT = `أنت خبير تربوي ومعلم أول في وزارة التربية والتعليم للثانوية العامة والبكالوريا المصرية. مهمتك هي إنشاء واستخراج أسئلة الاختيار من متعدد (MCQs) التفاعلية من ملف الـ PDF المرفق بدقة علمية وتربوية عالية، مع توليد إجابات دقيقة وشرح وتفسير نموذجي شامل لكل سؤال.

القواعد والضوابط الصارمة:
1. الالتزام التام بالمنهج ومنع الخروج عنه: استخرج واعتمد حصراً على المفاهيم والقوانين والدروس الواردة في ملف الـ PDF المرفوع. يُمنع منعاً باتاً إدخال أسئلة أو مواضيع من مناهج أخرى أو معلومات خارجية خارج حدود هذا الملف.
2. مستوى الأسئلة وجودتها: صغ أسئلة تقيس الفهم والتطبيق والتحليل الشامل للطلاب بناءً على محتوى الملف؛ ابتعد عن البصمجية والنقل الحرفي السطحي، وفي نفس الوقت لا تخرج عن نطاق المادة.
3. التوزيع العشوائي لموقع الإجابة الصحيحة: قم بتوزيع موقع الإجابة الصحيحة (correct_option_index) بشكل عشوائي ومتوازن بين الخيارات الأربعة (0, 1, 2, 3)، ويُمنع منعاً باتاً جعل الإجابة الصحيحة دائماً في الخيار الأول (0).
4. الخيارات الأربعة: لكل سؤال، وفر 4 خيارات واضحة ومتمايزة ومكتوبة بدقة.
5. التفسير والشرح النموذجي: اكتب في حقل explanation شرحاً علمياً تفصيلياً مقنعاً وواضحاً يوضح للطالب خطوات الحل الرياضي أو التعليل العلمي والقاعدة المتبعة وسبب صحة الخيار المختار.
6. الإخراج الإجباري: يجب أن تكون النتيجة حصراً بصيغة JSON المحددة.`;

export function AISettingsManager() {
  const queryClient = useQueryClient();

  const [modelName, setModelName] = useState(DEFAULT_MODEL);
  const [examPrompt, setExamPrompt] = useState(DEFAULT_PROMPT);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['system_settings'],
    queryFn: () => api.getSystemSettings(),
  });

  useEffect(() => {
    if (settings && settings.length > 0) {
      const model = settings.find((s) => s.key === 'gemini_model_name');
      const prompt = settings.find((s) => s.key === 'gemini_exam_prompt');

      if (model?.value) setModelName(model.value);
      if (prompt?.value) setExamPrompt(prompt.value);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.updateSystemSetting(
        'gemini_model_name',
        modelName.trim() || DEFAULT_MODEL,
        'اسم موديل Google Gemini المعتمد لاستخراج الأسئلة من ملفات الـ PDF'
      );
      await api.updateSystemSetting(
        'gemini_exam_prompt',
        examPrompt.trim() || DEFAULT_PROMPT,
        'الـ System Prompt الافتراضي الموجه لـ Gemini لاستخراج وتفسير أسئلة الـ MCQs'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_settings'] });
      setSavedSuccess(true);
      setError(null);
      setTimeout(() => setSavedSuccess(false), 4000);
    },
    onError: (err: any) => {
      setError(err.message || 'حدث خطأ أثناء حفظ الإعدادات.');
    },
  });

  const handleResetPrompt = () => {
    if (confirm('هل أنت متأكد من استعادة الـ Prompt الافتراضي؟ ستفقد أي تخصيصات غير محفوظة.')) {
      setExamPrompt(DEFAULT_PROMPT);
    }
  };

  const handleResetModel = () => {
    setModelName(DEFAULT_MODEL);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim()) {
      setError('يرجى تحديد اسم الموديل (مثال: gemini-2.5-flash).');
      return;
    }
    if (!examPrompt.trim()) {
      setError('يرجى إدخال الـ System Prompt.');
      return;
    }
    saveMutation.mutate();
  };

  if (isLoading) {
    return <div className="text-center py-12 text-slate-400">جاري تحميل إعدادات الذكاء الاصطناعي...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
              <Sparkles className="w-5 h-5" />
            </span>
            <span>إعدادات الذكاء الاصطناعي (Gemini AI Engine)</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            التحكم الكامل والديناميكي في موديل Gemini والـ System Prompt الخاص باستخراج الأسئلة من الـ PDF
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">تم حفظ إعدادات الذكاء الاصطناعي بنجاح وتفعيلها فوراً في السيرفر!</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Model Selection Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-emerald-600" />
              <span>موديل الذكاء الاصطناعي المعتمد (Gemini Model Name)</span>
            </h3>
            <button
              type="button"
              onClick={handleResetModel}
              className="text-xs text-slate-500 hover:text-emerald-700 transition cursor-pointer"
            >
              الافتراضي: {DEFAULT_MODEL}
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              اسم الموديل المستهدف في السيرفر *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="gemini-2.5-flash"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                dir="ltr"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium">خيارات سريعة مقترحة:</span>
              <button
                type="button"
                onClick={() => setModelName('gemini-2.5-flash')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-md font-mono border border-slate-200 transition cursor-pointer"
              >
                gemini-2.5-flash (موصى به - فائق السرعة)
              </button>
              <button
                type="button"
                onClick={() => setModelName('gemini-1.5-pro')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-md font-mono border border-slate-200 transition cursor-pointer"
              >
                gemini-1.5-pro (استدلال متقدم)
              </button>
              <button
                type="button"
                onClick={() => setModelName('gemini-2.0-flash')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-md font-mono border border-slate-200 transition cursor-pointer"
              >
                gemini-2.0-flash
              </button>
            </div>
          </div>
        </div>

        {/* API Key Security Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>مفتاح Google Gemini API Key (حماية مشددة)</span>
            </h3>
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              متغير بيئة السيرفر (Environment Variable)
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-2">
            <p className="leading-relaxed">
              وفقًا لمعايير الأمان وقواعد عدم تخزين أسرار الاعتماد في قاعدة البيانات، يتم تمرير مفتاح الـ API حصريًا عبر متغير البيئة المشفر في السيرفر:
            </p>
            <div className="flex items-center gap-2 font-mono bg-white border border-slate-200 px-3 py-2 rounded-lg text-emerald-700 font-bold text-xs" dir="ltr">
              <span>GEMINI_API_KEY</span>
              <span className="text-slate-400 text-[11px] font-normal font-sans">(مُهيأ في إعدادات استضافة Vercel)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              هذا يمنع كلياً تخزين المفتاح بنص صريح داخل قاعدة البيانات، مما يضمن أمان الحصص (Quota) وعدم تعرضه لأي تسريب.
            </p>
          </div>
        </div>

        {/* System Prompt Textarea Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Bot className="w-4 h-4 text-emerald-600" />
              <span>توجيه النظام المخصص (System Prompt & Extraction Instructions)</span>
            </h3>
            <button
              type="button"
              onClick={handleResetPrompt}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700 transition cursor-pointer"
              title="استعادة الـ Prompt الافتراضي"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              الـ Prompt الموجه للموديل للتحكم في استخراج الأسئلة وتوليد الشرح النموذجي *
            </label>
            <textarea
              required
              rows={10}
              value={examPrompt}
              onChange={(e) => setExamPrompt(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition font-sans"
              placeholder="أدخل توجيهات الـ System Prompt..."
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-800 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-slate-900">
              <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>معايير توليد الأسئلة والشرح:</span>
            </div>
            <p className="leading-relaxed text-slate-600">
              السيرفر يفرض إخراج Structured JSON Schema إجبارياً على الموديل مع توزيع عشوائي للإجابات الصحيحة ومنع الخروج عن محتوى ملف الـ PDF وتوليد شرح وتفسير تفصيلي في حقل <code className="font-mono font-bold text-emerald-700">explanation</code>.
            </p>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ وتطبيق الإعدادات'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
