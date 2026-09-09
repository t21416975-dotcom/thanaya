import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Calendar } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import type { Week } from '@thanaya/types';

export function WeeksManager() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<1 | 2>(1);

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
      setIsModalOpen(false);
    },
  });

  const filteredWeeks = weeks.filter((w) => w.term === selectedTerm);

  const openAddModal = () => {
    const nextNumber = weeks.filter((w) => w.term === selectedTerm).length + 1;
    setWeekNumber(nextNumber);
    setTitle(`الأسبوع ${nextNumber}`);
    setTerm(selectedTerm);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createMutation.mutate({
      week_number: Number(weekNumber),
      title: title.trim(),
      term: Number(term) as 1 | 2,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">الأسابيع الدراسية</h2>
          <p className="text-sm text-slate-500">إدارة أسابيع الفصل الدراسي الأول والثاني</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة أسبوع</span>
        </button>
      </div>

      {/* Term Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setSelectedTerm(1)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
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
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between shadow-sm hover:border-slate-300 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  {w.week_number}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{w.title}</h4>
                  <span className="text-xs text-slate-400">الترم {w.term}</span>
                </div>
              </div>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
          ))}
          {filteredWeeks.length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-400">
              لا توجد أسابيع مضافة لهذا الترم.
            </div>
          )}
        </div>
      )}

      {/* Add Week Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إضافة أسبوع جديد">
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
                  setTitle(`الأسبوع ${e.target.value}`);
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
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              إضافة
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
