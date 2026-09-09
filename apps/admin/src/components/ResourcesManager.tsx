import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Globe, EyeOff, FileText, Youtube } from 'lucide-react';
import { api } from '../api/client';
import { ContentCreator } from './ContentCreator';
import type { Resource } from '@thanaya/types';

export function ResourcesManager() {
  const queryClient = useQueryClient();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">إدارة الموارد والملفات</h2>
          <p className="text-sm text-slate-500">إضافة ونشر وإدارة تقييمات وحلول وامتحانات البكالوريا</p>
        </div>
        <button
          onClick={openCreateView}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm self-start"
        >
          <Plus className="w-4 h-4" />
          <span>+ إضافة محتوى جديد</span>
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
          <span className="text-slate-500 text-xs font-semibold">نوع المحتوى:</span>
          <select
            value={filterContentType}
            onChange={(e) => setFilterContentType(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none"
          >
            <option value="all">كل الأنواع</option>
            {contentTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
          إجمالي النتائج: <strong className="text-slate-700">{filteredResources.length}</strong> مورد
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">جاري تحميل الموارد...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right border-collapse">
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
                        rel="noreferrer"
                        className="p-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs flex items-center gap-1 transition"
                        title="فتح ملف الـ PDF"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </a>
                      {res.youtube_url && (
                        <a
                          href={res.youtube_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs flex items-center gap-1 transition"
                          title="فتح فيديو الشرح"
                        >
                          <Youtube className="w-3.5 h-3.5" />
                          <span>شرح</span>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
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
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    <div>👁 {res.views_count} مشاهدة</div>
                    <div>⬇ {res.downloads_count} تحميل</div>
                  </td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditView(res)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                        title="تعديل وتعديل المحتوى"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف المورد "${res.title}"؟`)) {
                            deleteMutation.mutate(res.id);
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
      )}
    </div>
  );
}
