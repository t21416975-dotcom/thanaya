import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Layers } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import type { ContentType } from '@thanaya/types';

export function ContentTypesManager() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ContentType | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [orderIndex, setOrderIndex] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const { data: contentTypes = [], isLoading } = useQuery({
    queryKey: ['content_types'],
    queryFn: () => api.getContentTypes(),
  });

  const createMutation = useMutation({
    mutationFn: (newType: Omit<ContentType, 'id' | 'created_at' | 'updated_at'>) => api.createContentType(newType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_types'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContentType> }) => api.updateContentType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_types'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteContentType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_types'] });
    },
  });

  const openAddModal = () => {
    setEditingType(null);
    setName('');
    setSlug('');
    setDescription('');
    setOrderIndex(contentTypes.length + 1);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (ct: ContentType) => {
    setEditingType(ct);
    setName(ct.name);
    setSlug(ct.slug);
    setDescription(ct.description || '');
    setOrderIndex(ct.order_index);
    setIsActive(ct.is_active);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
  };

  const generateSlug = (text: string) => {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0621-\u064A-]+/g, '');
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingType) {
      setSlug(generateSlug(val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    if (editingType) {
      updateMutation.mutate({
        id: editingType.id,
        data: {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          order_index: Number(orderIndex),
          is_active: isActive,
        },
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        order_index: Number(orderIndex),
        is_active: isActive,
      });
    }
  };

  const toggleActive = (ct: ContentType) => {
    updateMutation.mutate({
      id: ct.id,
      data: { is_active: !ct.is_active },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">أنواع المحتوى (Content Types)</h2>
          <p className="text-sm text-slate-500">
            إضافة أنواع تصنيفات وموارد جديدة ديناميكيًا دون الحاجة لتعديل كود المنصة
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة نوع محتوى جديد</span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">جاري تحميل أنواع المحتوى...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-6 py-3">الترتيب</th>
                <th className="px-6 py-3">نوع المحتوى</th>
                <th className="px-6 py-3">الـSlug</th>
                <th className="px-6 py-3">الوصف</th>
                <th className="px-6 py-3">الحالة</th>
                <th className="px-6 py-3 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {contentTypes.map((ct) => (
                <tr key={ct.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-mono text-slate-500">{ct.order_index}</td>
                  <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>{ct.name}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500 dir-ltr text-right">
                    /{ct.slug}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{ct.description || '—'}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleActive(ct)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition ${
                        ct.is_active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {ct.is_active ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>نشط</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>معطل</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(ct)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                        title="تعديل"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف نوع المحتوى "${ct.name}"؟`)) {
                            deleteMutation.mutate(ct.id);
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
              {contentTypes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    لا توجد أنواع محتوى مضافة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingType ? 'تعديل نوع محتوى' : 'إضافة نوع محتوى جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">اسم نوع المحتوى *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="مثال: مذكرات ليلة الامتحان"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">معرّف الرابط (Slug) *</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="مثال: exam-night-notes"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-left focus:outline-none focus:ring-2 focus:ring-emerald-500"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ترتيب العرض</label>
            <input
              type="number"
              min="1"
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">وصف توضيحي</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف لما يشمله هذا النوع من الموارد..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isTypeActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
            <label htmlFor="isTypeActive" className="text-sm font-medium text-slate-700 cursor-pointer">
              تفعيل نوع المحتوى وإتاحته في القوائم
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {editingType ? 'حفظ التعديلات' : 'إضافة نوع المحتوى'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
