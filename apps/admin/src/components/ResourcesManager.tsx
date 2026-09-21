import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Globe, EyeOff, FileText, Youtube } from 'lucide-react';
import { api } from '../api/client';
import { usePermissions } from '../lib/permissions';
import { ContentCreator } from './ContentCreator';
import type { Resource } from '@thanaya/types';

export function ResourcesManager() {
  const queryClient = useQueryClient();
  const { can, scopedSubjects } = usePermissions();
  const [isCreating, setIsCreating] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  // Filters
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterContentType, setFilterContentType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: () => api.getResources(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.getSubjects(),
  });

  const { data: contentTypes = [] } = useQuery({
    queryKey: ['content_types'],
    queryFn: () => api.getContentTypes(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Resource> }) => api.updateResource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteResource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });

  const togglePublish = (res: Resource) => {
    const nextPublished = !res.is_published;
    updateMutation.mutate({
      id: res.id,
      data: {
        is_published: nextPublished,
        published_at: nextPublished ? (res.published_at || new Date().toISOString()) : res.published_at,
      },
    });
  };

  const openCreateView = () => {
    setEditingResource(null);
    setIsCreating(true);
  };

  const openEditView = (res: Resource) => {
    setEditingResource(res);
    setIsCreating(true);
  };

  const closeCreatorView = () => {
    setIsCreating(false);
    setEditingResource(null);
  };

  // Filter logic
  const filteredResources = resources.filter((res) => {
    if (filterSubject !== 'all' && res.subject_id !== filterSubject) return false;
    if (filterContentType !== 'all' && res.content_type_id !== filterContentType) return false;
    if (filterStatus === 'published' && !res.is_published) return false;
    if (filterStatus === 'draft' && res.is_published) return false;
    if (filterStatus === 'coming_soon' && !res.is_coming_soon) return false;
    return true;
  });

  if (isCreating) {
    return (
      <ContentCreator
        initialResource={editingResource}
        onClose={closeCreatorView}
        onSuccess={closeCreatorView}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">إدارة الموارد والملفات</h2>
          <p className="text-xs sm:text-sm text-slate-500">إضافة ونشر وإدارة تقييمات وحلول وامتحانات البكالوريا</p>
        </div>
        {can('resources.create') && (
          <button
            onClick={openCreateView}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-4 py-2.5 sm:py-2 rounded-xl text-sm font-semibold transition shadow-sm w-full sm:w-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة محتوى جديد</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <label className="text-slate-500 text-[11px] font-semibold">المادة:</label>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">كل المواد</option>
              {subjects
                .filter((s) => scopedSubjects('resources.view').length === 0 || scopedSubjects('resources.view').includes(s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-500 text-[11px] font-semibold">نوع المحتوى:</label>
            <select
              value={filterContentType}
              onChange={(e) => setFilterContentType(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">كل الأنواع</option>
              {contentTypes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
          <span>إجمالي النتائج: <strong className="text-slate-700 font-semibold">{filteredResources.length}</strong> مورد</span>
          {(filterSubject !== 'all' || filterContentType !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={() => {
                setFilterSubject('all');
                setFilterContentType('all');
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
        <div className="text-center py-12 text-slate-400 text-sm">جاري تحميل الموارد...</div>
      ) : (
        <>
          {/* Mobile Card View (shown below md:) */}
          <div className="md:hidden space-y-3">
            {filteredResources.map((res) => (
              <div
                key={res.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3"
              >
                {/* Header & Title */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug break-words">
                      {res.title}
                    </h3>
                    <div className="text-[11px] font-mono text-slate-400 dir-ltr text-right mt-0.5 truncate">
                      /{res.slug}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {can('resources.update') && (
                      <button
                        onClick={() => openEditView(res)}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer active:scale-95"
                        title="تعديل المحتوى"
                        aria-label="تعديل"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {can('resources.delete') && (
                      <button
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف المورد "${res.title}"؟`)) {
                            deleteMutation.mutate(res.id);
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

                {/* Badges & Tags */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-100">
                    {res.subject?.name || '—'}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium">
                    {res.content_type?.name || '—'}
                  </span>
                  {res.week?.title && (
                    <span className="px-2 py-0.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
                      {res.week.title}
                    </span>
                  )}
                </div>

                {/* Links & Status Row */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  {/* Files Links */}
                  <div className="flex items-center gap-2">
                    {res.pdf_url && (
                      <a
                        href={res.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </a>
                    )}
                    {res.youtube_url && (
                      <a
                        href={res.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Youtube className="w-3.5 h-3.5" />
                        <span>شرح</span>
                      </a>
                    )}
                  </div>

                  {/* Publish Status Toggle */}
                  <div className="flex items-center gap-2">
                    {can('resources.publish') ? (
                      <button
                        onClick={() => togglePublish(res)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition active:scale-95 ${
                          res.is_published
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        }`}
                      >
                        {res.is_published ? (
                          <>
                            <Globe className="w-3.5 h-3.5" />
                            <span>منشور</span>
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
                          res.is_published
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {res.is_published ? 'منشور' : 'مسودة'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Stats */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-50/70 -mx-4 -mb-4 px-4 py-2 rounded-b-2xl border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <span>👁 {res.views_count} مشاهدة</span>
                    <span>⬇ {res.downloads_count} تحميل</span>
                  </div>
                  {res.is_coming_soon && !res.is_published && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      قريباً
                    </span>
                  )}
                </div>
              </div>
            ))}

            {filteredResources.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                لا توجد موارد تطابق معايير الفلترة.
              </div>
            )}
          </div>

          {/* Desktop Table View (hidden on mobile, shown on md:) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm">
            <table className="w-full text-right border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="px-6 py-3">عنوان المورد</th>
                  <th className="px-6 py-3">المادة والتصنيف</th>
                  <th className="px-6 py-3">الأسبوع</th>
                  <th className="px-6 py-3">الملفات</th>
                  <th className="px-6 py-3">الحالة</th>
                  <th className="px-6 py-3">الإحصائيات</th>
                  <th className="px-6 py-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredResources.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{res.title}</div>
                      <div className="text-xs font-mono text-slate-400 dir-ltr text-right">/{res.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-semibold text-slate-800">{res.subject?.name || '—'}</div>
                      <div className="text-xs text-emerald-600 mt-0.5">{res.content_type?.name || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">{res.week?.title || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <a
                          href={res.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs flex items-center gap-1 transition"
                          title="فتح ملف الـ PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </a>
                        {res.youtube_url && (
                          <a
                            href={res.youtube_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs flex items-center gap-1 transition"
                            title="فتح فيديو الشرح"
                          >
                            <Youtube className="w-3.5 h-3.5" />
                            <span>شرح</span>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {can('resources.publish') ? (
                        <button
                          onClick={() => togglePublish(res)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition ${
                            res.is_published
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          {res.is_published ? (
                            <>
                              <Globe className="w-3.5 h-3.5" />
                              <span>منشور</span>
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
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            res.is_published
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {res.is_published ? 'منشور' : 'مسودة'}
                        </span>
                      )}
                      {res.is_coming_soon && !res.is_published && (
                        <span className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full border border-amber-200 font-bold mr-2">
                          قريباً
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      <div>👁 {res.views_count} مشاهدة</div>
                      <div>⬇ {res.downloads_count} تحميل</div>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <div className="flex items-center justify-end gap-2">
                        {can('resources.update') && (
                          <button
                            onClick={() => openEditView(res)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
                            title="تعديل وتعديل المحتوى"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {can('resources.delete') && (
                          <button
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف المورد "${res.title}"؟`)) {
                                deleteMutation.mutate(res.id);
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
                ))}
                {filteredResources.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                      لا توجد موارد تطابق معايير الفلترة.
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
