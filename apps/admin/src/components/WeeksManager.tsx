import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import type { Week } from '@thanaya/types';

export function WeeksManager() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<1 | 2>(1);
  const [editingWeek, setEditingWeek] = useState<Week | null>(null);
  const [weekToDelete, setWeekToDelete] = useState<Week | null>(null);

  // Form State
  const [weekNumber, setWeekNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [term, setTerm] = useState<1 | 2>(1);

  const { data: weeks = [], isLoading } = useQuery({
    queryKey: ['weeks'],
    queryFn: () => api.getWeeks(),
  });

  const createMutation = useMutation({
    mutationFn: (newWeek: Omit<Week, 'id' | 'created_at'>) => api.createWeek(newWeek),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Week> }) => api.updateWeek(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteWeek(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
      closeDeleteModal();
    },
  });

  const filteredWeeks = weeks.filter((w) => w.term === selectedTerm);

  const openAddModal = () => {
    setEditingWeek(null);
    const nextNumber = weeks.filter((w) => w.term === selectedTerm).length + 1;
    setWeekNumber(nextNumber);
    setTitle(`الأسبوع ${nextNumber}`);
    setTerm(selectedTerm);
    setIsModalOpen(true);
  };

  const openEditModal = (w: Week) => {
    setEditingWeek(w);
    setWeekNumber(w.week_number);
    setTitle(w.title);
    setTerm(w.term);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingWeek(null);
  };

  const openDeleteModal = (w: Week) => {
    setWeekToDelete(w);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setWeekToDelete(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingWeek) {
      updateMutation.mutate({
        id: editingWeek.id,
        data: {
          week_number: Number(weekNumber),
          title: title.trim(),
          term: Number(term) as 1 | 2,
        },
      });
    } else {
      createMutation.mutate({
        week_number: Number(weekNumber),
        title: title.trim(),
        term: Number(term) as 1 | 2,
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (weekToDelete) {
      deleteMutation.mutate(weekToDelete.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">الأسابيع الدراسية</h2>
          <p className="text-sm text-slate-500">إدارة وتعديل وحذف أسابيع الفصل الدراسي الأول والثاني</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة أسبوع</span>
        </button>
      </div>

      {/* Term Selector */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setSelectedTerm(1)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
            selectedTerm === 1
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          الفصل الدراسي الأول (Term 1)
        </button>
        <button
          onClick={() => setSelectedTerm(2)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            selectedTerm === 2
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          الفصل الدراسي الثاني (Term 2)
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">جاري تحميل الأسابيع...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredWeeks.map((w) => (
            <div
              key={w.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between shadow-sm hover:border-slate-300 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {w.week_number}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{w.title}</h4>
                  <span className="text-xs text-slate-400">الترم {w.term}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                <button
                  onClick={() => openEditModal(w)}
                  title="تعديل الأسبوع"
                  className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openDeleteModal(w)}
                  title="حذف الأسبوع"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filteredWeeks.length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-400">
              لا توجد أسابيع مضافة لهذا الترم.
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Week Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingWeek ? 'تعديل الأسبوع الدراسي' : 'إضافة أسبوع جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">الفصل الدراسي *</label>
              <select
                value={term}
                onChange={(e) => setTerm(Number(e.target.value) as 1 | 2)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={1}>الترم الأول</option>
                <option value={2}>الترم الثاني</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الأسبوع *</label>
              <input
                type="number"
                min="1"
                required
                value={weekNumber}
                onChange={(e) => {
                  setWeekNumber(Number(e.target.value));
                  if (!editingWeek) {
                    setTitle(`الأسبوع ${e.target.value}`);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">عنوان الأسبوع *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: الأسبوع الرابع"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
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
              {editingWeek ? 'حفظ التعديلات' : 'إضافة'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        title="تأكيد حذف الأسبوع"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-rose-50 text-rose-800 p-4 rounded-xl border border-rose-100">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div className="text-sm">
              <p className="font-bold">هل أنت متأكد من حذف {weekToDelete?.title}؟</p>
              <p className="text-xs text-rose-600 mt-1">
                قد يؤدي حذف هذا الأسبوع إلى فك ارتباط الموارد والتقييمات المربوطة به.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeDeleteModal}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

