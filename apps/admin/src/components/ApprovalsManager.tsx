import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Inbox, CheckCircle2, XCircle, Ban, Plus, Trash2,
  FileText, HelpCircle, BookOpen, Layers, Calendar, Archive,
} from 'lucide-react';
import { api } from '../api/client';
import { usePermissions } from '../lib/permissions';
import { Modal } from './Modal';
import type { ChangeRequest, ChangeRequestEntity, Subject, ContentType, Week } from '@thanaya/types';

// ---------------------------------------------------------------------------
// ثوابت العرض
// ---------------------------------------------------------------------------
const ENTITY_LABELS: Record<ChangeRequestEntity, string> = {
  resources: 'مورد',
  exams: 'امتحان',
  subjects: 'مادة دراسية',
  content_types: 'نوع محتوى',
  weeks: 'أسبوع',
};

const ENTITY_ICONS: Record<ChangeRequestEntity, typeof FileText> = {
  resources: FileText,
  exams: HelpCircle,
  subjects: BookOpen,
  content_types: Layers,
  weeks: Calendar,
};

const ACTION_LABELS: Record<string, string> = {
  create: 'إنشاء جديد',
  update: 'تعديل',
  delete: 'حذف',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-amber-50 text-amber-700 border-amber-200',
  delete: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'معلّق',
  approved: 'مقبول',
  rejected: 'مرفوض',
  cancelled: 'ملغى',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** عنوان مختصر للطلب من محتواه */
function requestTitle(req: ChangeRequest): string {
  const src = (req.payload || req.base_snapshot || {}) as Record<string, any>;
  return src.title || src.name || src.slug || ENTITY_LABELS[req.entity];
}

// ---------------------------------------------------------------------------
// المكوّن الرئيسي: يفرّق بين المدير العام والموظف
// ---------------------------------------------------------------------------
export function ApprovalsManager() {
  const { permissions, isLoading } = usePermissions();

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 text-sm">جاري التحميل...</div>;
  }
  return permissions.is_super_admin ? <SuperAdminApprovals /> : <MyChanges />;
}

// ---------------------------------------------------------------------------
// واجهة المدير العام: الطلبات المعلّقة + الأرشيف
// ---------------------------------------------------------------------------
function SuperAdminApprovals() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'archive'>('pending');
  const [selected, setSelected] = useState<ChangeRequest | null>(null);

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['pending_changes'],
    queryFn: () => api.listPendingChanges(),
  });

  const { data: archive = [], isLoading: archiveLoading } = useQuery({
    queryKey: ['all_changes'],
    queryFn: () => api.listAllChanges(),
    enabled: tab === 'archive',
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['pending_changes'] });
    queryClient.invalidateQueries({ queryKey: ['all_changes'] });
    queryClient.invalidateQueries({ queryKey: ['my_changes'] });
    // أعد تحميل بيانات الكيانات لأن الطلب قد يكون طُبِّق
    ['resources', 'exams', 'subjects', 'content_types', 'weeks'].forEach((k) =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };

  const list = tab === 'pending' ? pending : archive;
  const loading = tab === 'pending' ? pendingLoading : archiveLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-bold text-slate-800">طلبات الموافقة</h3>
          {pending.length > 0 && (
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {pending.length} معلّق
            </span>
          )}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              tab === 'pending' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            بانتظار المراجعة
          </button>
          <button
            onClick={() => setTab('archive')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 ${
              tab === 'archive' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            الأرشيف
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 text-sm">جاري التحميل...</div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
          {tab === 'pending' ? 'لا توجد طلبات بانتظار المراجعة 🎉' : 'الأرشيف فارغ'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {list.map((req) => {
            const Icon = ENTITY_ICONS[req.entity];
            return (
              <button
                key={req.id}
                onClick={() => setSelected(req)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition text-right cursor-pointer"
              >
                <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-slate-500" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-800 truncate">
                    {requestTitle(req)}
                  </span>
                  <span className="block text-xs text-slate-400 mt-0.5">
                    {req.submitter_email ?? 'موظف'} · {fmtDate(req.created_at)}
                  </span>
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${ACTION_COLORS[req.action]}`}>
                  {ACTION_LABELS[req.action]}
                </span>
                <span className="text-[11px] text-slate-400 shrink-0 hidden sm:inline">
                  {ENTITY_LABELS[req.entity]}
                </span>
                {tab === 'archive' && (
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${STATUS_COLORS[req.status]}`}>
                    {STATUS_LABELS[req.status]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <ReviewModal
          request={selected}
          readOnly={selected.status !== 'pending'}
          onClose={() => setSelected(null)}
          onReviewed={() => {
            setSelected(null);
            invalidateAll();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// نافذة المراجعة: يستعرض المدير العام الطلب ويعدّل عليه ثم يعتمد أو يرفض
// ---------------------------------------------------------------------------
type FieldType = 'text' | 'textarea' | 'number' | 'checkbox' | 'subject' | 'content_type' | 'week' | 'term';
type FieldDef = { key: string; label: string; type: FieldType };

const FIELD_CONFIG: Record<ChangeRequestEntity, FieldDef[]> = {
  subjects: [
    { key: 'name', label: 'اسم المادة', type: 'text' },
    { key: 'slug', label: 'معرّف الرابط (Slug)', type: 'text' },
    { key: 'icon', label: 'الأيقونة', type: 'text' },
    { key: 'description', label: 'الوصف', type: 'textarea' },
    { key: 'order_index', label: 'ترتيب العرض', type: 'number' },
    { key: 'is_active', label: 'مفعّلة (تظهر للطلاب)', type: 'checkbox' },
  ],
  content_types: [
    { key: 'name', label: 'اسم النوع', type: 'text' },
    { key: 'slug', label: 'معرّف الرابط (Slug)', type: 'text' },
    { key: 'description', label: 'الوصف', type: 'textarea' },
    { key: 'order_index', label: 'ترتيب العرض', type: 'number' },
    { key: 'is_active', label: 'مفعّل', type: 'checkbox' },
  ],
  weeks: [
    { key: 'week_number', label: 'رقم الأسبوع', type: 'number' },
    { key: 'title', label: 'العنوان', type: 'text' },
    { key: 'term', label: 'الفصل الدراسي', type: 'term' },
  ],
  resources: [
    { key: 'title', label: 'العنوان', type: 'text' },
    { key: 'slug', label: 'معرّف الرابط (Slug)', type: 'text' },
    { key: 'description', label: 'الوصف', type: 'textarea' },
    { key: 'subject_id', label: 'المادة', type: 'subject' },
    { key: 'content_type_id', label: 'نوع المحتوى', type: 'content_type' },
    { key: 'week_id', label: 'الأسبوع', type: 'week' },
    { key: 'pdf_url', label: 'رابط الملف (PDF)', type: 'text' },
    { key: 'youtube_url', label: 'رابط يوتيوب', type: 'text' },
    { key: 'is_published', label: 'منشور (يظهر للطلاب)', type: 'checkbox' },
    { key: 'is_coming_soon', label: 'قريبًا', type: 'checkbox' },
    { key: 'coming_soon_message', label: 'رسالة «قريبًا»', type: 'text' },
  ],
  exams: [
    { key: 'title', label: 'عنوان الامتحان', type: 'text' },
    { key: 'subject_id', label: 'المادة', type: 'subject' },
    { key: 'time_limit_minutes', label: 'المدة (دقائق)', type: 'number' },
    { key: 'is_published', label: 'منشور (يظهر للطلاب)', type: 'checkbox' },
    { key: 'is_coming_soon', label: 'قريبًا', type: 'checkbox' },
    { key: 'coming_soon_message', label: 'رسالة «قريبًا»', type: 'text' },
  ],
};

type QuestionDraft = {
  question_number: number;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
};

function ReviewModal({
  request,
  readOnly,
  onClose,
  onReviewed,
}: {
  request: ChangeRequest;
  readOnly: boolean;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [edited, setEdited] = useState<Record<string, any>>(() => ({ ...request.payload }));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => api.getSubjects() });
  const { data: contentTypes = [] } = useQuery({ queryKey: ['content_types'], queryFn: () => api.getContentTypes() });
  const { data: weeks = [] } = useQuery({ queryKey: ['weeks'], queryFn: () => api.getWeeks() });

  const reviewMutation = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      api.reviewChangeRequest(
        request.id,
        decision,
        note.trim() || undefined,
        decision === 'approved' && request.action !== 'delete' ? edited : undefined
      ),
    onSuccess: onReviewed,
    onError: (e: Error) => setError(e.message),
  });

  const setField = (key: string, value: any) =>
    setEdited((prev) => ({ ...prev, [key]: value }));

  const base = (request.base_snapshot ?? {}) as Record<string, any>;
  const isDelete = request.action === 'delete';
  const isExam = request.entity === 'exams';

  const baseQuestions: any[] = Array.isArray(base.questions) ? base.questions : [];
  const editedQuestions: QuestionDraft[] = Array.isArray(edited.questions) ? edited.questions : [];

  const renderField = (field: FieldDef) => {
    const value = edited[field.key];
    const baseValue = base[field.key];
    const changed =
      request.action !== 'create' &&
      JSON.stringify(baseValue ?? null) !== JSON.stringify(value ?? null);
    const common = 'w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
    const border = changed ? 'border-amber-400 bg-amber-50/40' : 'border-slate-300';

    return (
      <div key={field.key}>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {field.label}
          {changed && (
            <span className="mr-2 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              معدّل
            </span>
          )}
        </label>
        {request.action !== 'create' && changed && (
          <p className="text-[11px] text-slate-400 mb-1 truncate" title={String(baseValue ?? '')}>
            السابق: {displayValue(field, baseValue, subjects, contentTypes, weeks)}
          </p>
        )}
        {field.type === 'textarea' ? (
          <textarea rows={2} disabled={readOnly} value={value ?? ''} onChange={(e) => setField(field.key, e.target.value)} className={`${common} ${border}`} />
        ) : field.type === 'number' ? (
          <input type="number" disabled={readOnly} value={value ?? 0} onChange={(e) => setField(field.key, Number(e.target.value))} className={`${common} ${border}`} />
        ) : field.type === 'checkbox' ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" disabled={readOnly} checked={!!value} onChange={(e) => setField(field.key, e.target.checked)} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500" />
            <span className="text-xs text-slate-500">{value ? 'نعم' : 'لا'}</span>
          </label>
        ) : field.type === 'subject' ? (
          <select disabled={readOnly} value={value ?? ''} onChange={(e) => setField(field.key, e.target.value)} className={`${common} ${border}`}>
            <option value="">— اختر —</option>
            {subjects.map((s: Subject) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        ) : field.type === 'content_type' ? (
          <select disabled={readOnly} value={value ?? ''} onChange={(e) => setField(field.key, e.target.value)} className={`${common} ${border}`}>
            <option value="">— اختر —</option>
            {contentTypes.map((c: ContentType) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        ) : field.type === 'week' ? (
          <select disabled={readOnly} value={value ?? ''} onChange={(e) => setField(field.key, e.target.value || null)} className={`${common} ${border}`}>
            <option value="">بدون أسبوع</option>
            {weeks.map((w: Week) => (<option key={w.id} value={w.id}>الفصل {w.term} — {w.title}</option>))}
          </select>
        ) : field.type === 'term' ? (
          <select disabled={readOnly} value={value ?? 1} onChange={(e) => setField(field.key, Number(e.target.value))} className={`${common} ${border}`}>
            <option value={1}>الفصل الأول</option>
            <option value={2}>الفصل الثاني</option>
          </select>
        ) : (
          <input type="text" disabled={readOnly} value={value ?? ''} onChange={(e) => setField(field.key, e.target.value)} className={`${common} ${border}`} />
        )}
      </div>
    );
  };

  const updateQuestion = (idx: number, patch: Partial<QuestionDraft>) => {
    const next = editedQuestions.map((q, i) => (i === idx ? { ...q, ...patch } : q));
    setField('questions', next);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${ACTION_LABELS[request.action]} ${ENTITY_LABELS[request.entity]} — ${requestTitle(request)}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {/* بيانات الطلب */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`font-bold px-2.5 py-1 rounded-full border ${ACTION_COLORS[request.action]}`}>
            {ACTION_LABELS[request.action]}
          </span>
          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            {ENTITY_LABELS[request.entity]}
          </span>
          <span className="text-slate-400">
            قدّمه: <span className="font-semibold text-slate-600">{request.submitter_email ?? '—'}</span>
          </span>
          <span className="text-slate-400">{fmtDate(request.created_at)}</span>
          {readOnly && (
            <span className={`font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[request.status]}`}>
              {STATUS_LABELS[request.status]}
            </span>
          )}
        </div>

        {isDelete ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-bold text-rose-700">طلب حذف — الموافقة ستحذف العنصر نهائيًا:</p>
            {FIELD_CONFIG[request.entity].map((f) =>
              base[f.key] !== undefined && base[f.key] !== null && base[f.key] !== '' ? (
                <p key={f.key} className="text-xs text-slate-600">
                  <span className="font-semibold">{f.label}:</span>{' '}
                  {displayValue(f, base[f.key], subjects, contentTypes, weeks)}
                </p>
              ) : null
            )}
            {isExam && baseQuestions.length > 0 && (
              <p className="text-xs text-slate-600">
                <span className="font-semibold">الأسئلة:</span> {baseQuestions.length} سؤال (ستُحذف معه)
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              {readOnly
                ? 'هذه نسخة الطلب بعد المراجعة (للاطلاع فقط).'
                : 'راجع البيانات وعدّل ما تشاء — النسخة التي تعتمدها هي التي ستُطبَّق وتظهر للمستخدمين.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {FIELD_CONFIG[request.entity].map(renderField)}
            </div>

            {/* محرر أسئلة الامتحان */}
            {isExam && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-700">
                    الأسئلة ({editedQuestions.length})
                    {request.action === 'update' && baseQuestions.length !== editedQuestions.length && (
                      <span className="mr-2 text-[10px] text-amber-600 font-bold">
                        (كانت {baseQuestions.length})
                      </span>
                    )}
                  </h4>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() =>
                        setField('questions', [
                          ...editedQuestions,
                          {
                            question_number: editedQuestions.length + 1,
                            question_text: '',
                            options: ['', '', '', ''],
                            correct_option_index: 0,
                            explanation: '',
                          },
                        ])
                      }
                      className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة سؤال
                    </button>
                  )}
                </div>
                {editedQuestions.map((q, qi) => (
                  <div key={qi} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">سؤال {qi + 1}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            setField('questions', editedQuestions.filter((_, i) => i !== qi)
                              .map((x, i) => ({ ...x, question_number: i + 1 })))
                          }
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      disabled={readOnly}
                      value={q.question_text}
                      onChange={(e) => updateQuestion(qi, { question_text: e.target.value })}
                      placeholder="نص السؤال..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(Array.isArray(q.options) ? q.options : []).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qi}`}
                            disabled={readOnly}
                            checked={q.correct_option_index === oi}
                            onChange={() => updateQuestion(qi, { correct_option_index: oi })}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 shrink-0"
                          />
                          <input
                            type="text"
                            disabled={readOnly}
                            value={opt}
                            onChange={(e) => {
                              const opts = [...q.options];
                              opts[oi] = e.target.value;
                              updateQuestion(qi, { options: opts });
                            }}
                            placeholder={`الخيار ${oi + 1}`}
                            className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      ))}
                    </div>
                    <textarea
                      rows={1}
                      disabled={readOnly}
                      value={q.explanation}
                      onChange={(e) => updateQuestion(qi, { explanation: e.target.value })}
                      placeholder="التفسير النموذجي (يظهر للطالب بعد الإجابة)..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ملاحظة المراجعة */}
        {!readOnly && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ملاحظة للموظف (اختياري — تظهر له مع القرار)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: تم تعديل العنوان قبل الاعتماد / سبب الرفض..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        )}
        {readOnly && request.review_note && (
          <p className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-600">
            <span className="font-bold">ملاحظة المراجع:</span> {request.review_note}
          </p>
        )}

        {error && (
          <p className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3">{error}</p>
        )}

        {/* أزرار القرار */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition text-center cursor-pointer"
          >
            إغلاق
          </button>
          {!readOnly && (
            <>
              <button
                type="button"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate('rejected')}
                className="w-full sm:w-auto px-5 py-2.5 bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-xl text-sm font-semibold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                رفض
              </button>
              <button
                type="button"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate('approved')}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {reviewMutation.isPending ? 'جاري التطبيق...' : 'اعتماد وتطبيق'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** يحوّل قيمة حقل لنص مقروء (يحلّ معرّفات العلاقات إلى أسماء) */
function displayValue(
  field: FieldDef,
  value: any,
  subjects: Subject[],
  contentTypes: ContentType[],
  weeks: Week[]
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field.type === 'checkbox') return value ? 'نعم' : 'لا';
  if (field.type === 'term') return value === 2 ? 'الفصل الثاني' : 'الفصل الأول';
  if (field.type === 'subject') return subjects.find((s) => s.id === value)?.name ?? String(value);
  if (field.type === 'content_type') return contentTypes.find((c) => c.id === value)?.name ?? String(value);
  if (field.type === 'week') {
    const w = weeks.find((x) => x.id === value);
    return w ? `الفصل ${w.term} — ${w.title}` : String(value);
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// واجهة الموظف: طلباتي وحالاتها
// ---------------------------------------------------------------------------
function MyChanges() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my_changes'],
    queryFn: () => api.listMyChanges(),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelChangeRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my_changes'] }),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Inbox className="w-5 h-5 text-emerald-600" />
        <h3 className="text-lg font-bold text-slate-800">طلباتي</h3>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-800 leading-relaxed">
        كل تعديلاتك على المحتوى (إنشاء/تعديل/حذف) تُرسل تلقائيًا إلى المدير العام للمراجعة،
        ولا تظهر للمستخدمين إلا بعد اعتمادها. يمكنك متابعة حالة طلباتك هنا وإلغاء المعلّق منها.
      </div>

      {error && (
        <p className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3">{error}</p>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-slate-500 text-sm">جاري التحميل...</div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
          لم تقدّم أي طلبات بعد
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {requests.map((req) => {
            const Icon = ENTITY_ICONS[req.entity];
            return (
              <div key={req.id} className="px-4 py-3.5 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-slate-500" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{requestTitle(req)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(req.created_at)}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${ACTION_COLORS[req.action]}`}>
                    {ACTION_LABELS[req.action]}
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${STATUS_COLORS[req.status]}`}>
                    {STATUS_LABELS[req.status]}
                  </span>
                  {req.status === 'pending' && (
                    <button
                      type="button"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(req.id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                      title="إلغاء الطلب"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {req.status === 'rejected' && req.review_note && (
                  <p className="text-[11px] bg-rose-50 border border-rose-100 text-rose-700 rounded-lg px-3 py-2">
                    <span className="font-bold">سبب الرفض:</span> {req.review_note}
                  </p>
                )}
                {req.status === 'approved' && req.review_note && (
                  <p className="text-[11px] bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg px-3 py-2">
                    <span className="font-bold">ملاحظة المدير:</span> {req.review_note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
