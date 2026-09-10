import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Youtube, Eye, CheckCircle2, AlertTriangle, ArrowRight, ExternalLink } from 'lucide-react';
import { api } from '../api/client';
import { extractYouTubeVideoId, getYouTubeEmbedUrl } from '../lib/youtube';
import { isGoogleDriveUrl, getPdfPreviewUrl, getPdfDownloadUrl } from '../lib/drive';
import type { Resource } from '@thanaya/types';

interface ContentCreatorProps {
  initialResource?: Resource | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ContentCreator({ initialResource, onClose, onSuccess }: ContentCreatorProps) {
  const queryClient = useQueryClient();

  // Form states
  const [title, setTitle] = useState(initialResource?.title || '');
  const [slug, setSlug] = useState(initialResource?.slug || '');
  const [subjectId, setSubjectId] = useState(initialResource?.subject_id || '');
  const [contentTypeId, setContentTypeId] = useState(initialResource?.content_type_id || '');
  const [weekId, setWeekId] = useState(initialResource?.week_id || '');
  const [pdfUrl, setPdfUrl] = useState(initialResource?.pdf_url || '');
  const [youtubeUrl, setYoutubeUrl] = useState(initialResource?.youtube_url || '');
  const [description, setDescription] = useState(initialResource?.description || '');
  const [isPublished, setIsPublished] = useState(initialResource ? initialResource.is_published : true);

  // Validation & UI states
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'editor' | 'preview'>('editor');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Queries
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => api.getSubjects() });
  const { data: contentTypes = [] } = useQuery({ queryKey: ['content_types'], queryFn: () => api.getContentTypes() });
  const { data: weeks = [] } = useQuery({ queryKey: ['weeks'], queryFn: () => api.getWeeks() });

  // Default initial select values
  useEffect(() => {
    if (!initialResource) {
      if (subjects.length > 0 && !subjectId) setSubjectId(subjects[0].id);
      if (contentTypes.length > 0 && !contentTypeId) setContentTypeId(contentTypes[0].id);
    }
  }, [subjects, contentTypes, initialResource, subjectId, contentTypeId]);

  const generateSlug = (text: string) => {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0621-\u064A-]+/g, '');
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!initialResource) {
      setSlug(generateSlug(val));
    }
  };

  const handleSlugBlur = async () => {
    if (!slug.trim()) return;
    try {
      const exists = await api.checkSlugExists(slug.trim(), initialResource?.id);
      if (exists) {
        setSlugError('هذا المعرف (Slug) مستخدم بالفعل في مورد آخر. اختر معرفًا مختلفًا.');
      } else {
        setSlugError(null);
      }
    } catch {
      // Ignore in offline check
    }
  };

  const validate = async (): Promise<boolean> => {
    setError(null);
    setSlugError(null);

    if (!title.trim()) {
      setError('يرجى إدخال عنوان المورد.');
      return false;
    }
    if (!slug.trim()) {
      setError('يرجى إدخال معرّف الرابط (Slug).');
      return false;
    }
    if (!subjectId) {
      setError('يرجى اختيار المادة الدراسية.');
      return false;
    }
    if (!contentTypeId) {
      setError('يرجى اختيار نوع المحتوى.');
      return false;
    }
    if (!pdfUrl.trim()) {
      setError('يرجى إدخال رابط ملف الـ PDF المباشر.');
      return false;
    }

    try {
      new URL(pdfUrl);
    } catch {
      setError('رابط ملف الـ PDF غير صالح. تأكد من كتابة الرابط مع http:// أو https://');
      return false;
    }

    if (youtubeUrl.trim()) {
      const videoId = extractYouTubeVideoId(youtubeUrl);
      if (!videoId) {
        setError('رابط فيديو YouTube غير صالح. تأكد من نسخ رابط الفيديو الكامل أو المختصر.');
        return false;
      }
    }

    // Check slug collision
    const slugExists = await api.checkSlugExists(slug.trim(), initialResource?.id);
    if (slugExists) {
      setSlugError('هذا المعرف (Slug) مستخدم بالفعل. اختر معرّفًا فريدًا.');
      setError('توجد مشكلة في معرّف الرابط (Slug).');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await validate();
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        subject_id: subjectId,
        content_type_id: contentTypeId,
        week_id: weekId ? weekId : null,
        pdf_url: pdfUrl.trim(),
        youtube_url: youtubeUrl.trim() || null,
        description: description.trim() || null,
        is_published: isPublished,
        published_at: isPublished ? (initialResource?.published_at || new Date().toISOString()) : null,
      };

      if (initialResource) {
        await api.updateResource(initialResource.id, payload);
      } else {
        await api.createResource(payload);
      }

      queryClient.invalidateQueries({ queryKey: ['resources'] });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ المورد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selected entities for live preview
  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const selectedContentType = contentTypes.find((c) => c.id === contentTypeId);
  const selectedWeek = weeks.find((w) => w.id === weekId);
  const embedUrl = youtubeUrl ? getYouTubeEmbedUrl(youtubeUrl) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-50">
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
              {initialResource ? `تعديل: ${initialResource.title}` : 'إضافة مورد تعليمي جديد'}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              تعبئة بيانات المورد وربط ملف الـ PDF وشرح الفيديو
            </p>
          </div>
        </div>

        {/* Tab Switcher (Editor vs Live Preview) */}
        <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPreviewTab('editor')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              previewTab === 'editor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            محرر البيانات
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
              previewTab === 'preview' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>معاينة صفحة الطالب</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Editor Content */}
      {previewTab === 'editor' ? (
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {/* Top Classification Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">المادة الدراسية *</label>
              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">نوع المحتوى *</label>
              <select
                required
                value={contentTypeId}
                onChange={(e) => setContentTypeId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {contentTypes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">الأسبوع الدراسي (اختياري)</label>
              <select
                value={weekId}
                onChange={(e) => setWeekId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">غير مرتبط بأسبوع محدد</option>
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title} (ترم {w.term})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title & Slug */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">عنوان المورد الأساسي *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="مثال: تقييم الأسبوع الخامس في الفيزياء - قانون كيرشوف"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                معرّف الرابط (Slug) * <span className="text-slate-400 font-normal">(يستخدم في عنوان URL للموقع)</span>
              </label>
              <div className="flex items-center">
                <span className="bg-slate-100 text-slate-500 text-xs px-3 py-2.5 border border-r-0 border-slate-300 rounded-r-lg font-mono">
                  /resources/
                </span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  onBlur={handleSlugBlur}
                  placeholder="physics-week-5-kirchhoff"
                  className={`w-full px-3.5 py-2.5 border rounded-l-lg text-sm font-mono text-left focus:outline-none focus:ring-2 ${
                    slugError ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-emerald-500'
                  }`}
                  dir="ltr"
                />
              </div>
              {slugError && <p className="text-xs text-red-600 mt-1">{slugError}</p>}
            </div>
          </div>

          {/* PDF & YouTube URLs */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>رابط ملف الـ PDF (رابط مباشر أو رابط Google Drive) *</span>
              </label>
              <input
                type="url"
                required
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/... أو https://.../file.pdf"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono text-left focus:outline-none focus:ring-2 focus:ring-emerald-500"
                dir="ltr"
              />
              {isGoogleDriveUrl(pdfUrl) && (
                <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>تم التعرف على رابط Google Drive بنجاح، سيتم تضمين المعاينة والتحميل المباشر للطلاب تلقائياً.</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Youtube className="w-4 h-4 text-red-600" />
                <span>رابط فيديو شرح الحل (YouTube URL - اختياري)</span>
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono text-left focus:outline-none focus:ring-2 focus:ring-emerald-500"
                dir="ltr"
              />
              {embedUrl && (
                <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>تم التعرف على فيديو YouTube بنجاح. يمكنك معاينته في تبويب "معاينة صفحة الطالب".</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              وصف المورد أو ملاحظات هامة للطلاب (اختياري)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف مختصر لمحتوى التقييم، القوانين المستخدمة، أو تعليمات الحل..."
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Publishing state toggle */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">حالة النشر (Publish Status)</h4>
              <p className="text-xs text-slate-500">
                {isPublished
                  ? 'المورد سيكون منشورًا ومتاحًا للطلاب فور الحفظ.'
                  : 'سيتم حفظ المورد كمسودة داخل لوحة التحكم فقط.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublished(!isPublished)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                isPublished
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              }`}
            >
              {isPublished ? '✓ منشور للعامة' : 'مسودة (Draft)'}
            </button>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <span>{initialResource ? 'حفظ التعديلات' : 'نشر / حفظ المورد'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Live Student Page Mockup Preview */
        <div className="p-6 bg-slate-100 min-h-[500px]">
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
            {/* Breadcrumb preview */}
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>الرئيسية</span>
              <span>/</span>
              <span>{selectedSubject?.name || 'المادة'}</span>
              <span>/</span>
              <span className="text-emerald-700 font-medium">{selectedContentType?.name || 'نوع المحتوى'}</span>
            </div>

            {/* Title & Metadata */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                {selectedWeek && (
                  <span className="bg-emerald-50 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-medium">
                    {selectedWeek.title}
                  </span>
                )}
                <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {selectedContentType?.name || 'مورد تعليمي'}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900">{title || 'عنوان المورد هنا...'}</h1>
              {description && <p className="text-sm text-slate-600 mt-2">{description}</p>}
            </div>

            {/* PDF Section Mockup */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-4">
              <div className="inline-flex p-3 bg-red-50 text-red-600 rounded-xl">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-900 flex items-center justify-center gap-1.5">
                  <span>ملف التقييم (PDF)</span>
                  {isGoogleDriveUrl(pdfUrl) && (
                    <span className="text-[11px] font-medium text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                      Google Drive
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-500 font-mono mt-1 break-all">
                  {pdfUrl || 'لم يتم إدخال رابط الـ PDF بعد'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                {pdfUrl ? (
                  <a
                    href={getPdfDownloadUrl(pdfUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
                  >
                    <span>تحميل ملف الـ PDF المباشر</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <button disabled className="bg-slate-200 text-slate-400 px-5 py-2.5 rounded-lg text-xs font-semibold">
                    تحميل ملف الـ PDF المباشر
                  </button>
                )}
              </div>

              {pdfUrl && isGoogleDriveUrl(pdfUrl) && (
                <div className="w-full h-[380px] rounded-xl overflow-hidden border border-slate-200 bg-white mt-4">
                  <iframe
                    src={getPdfPreviewUrl(pdfUrl)}
                    className="w-full h-full border-0"
                    title="معاينة ملف Google Drive"
                    loading="lazy"
                  />
                </div>
              )}
            </div>

            {/* YouTube Embed Mockup */}
            {embedUrl ? (
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-600" />
                  <span>فيديو شرح وحل التقييم</span>
                </h4>
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-200 bg-black">
                  <iframe
                    src={embedUrl}
                    title="معاينة فيديو الشرح"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              youtubeUrl && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl">
                  تنبيه: تعذر تضمين الفيديو من الرابط المدخل. يرجى التحقق من صيغة رابط YouTube.
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
