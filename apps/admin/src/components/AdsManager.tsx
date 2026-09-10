import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Plus, Edit2, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import type { AdSlot, DirectAd, AdSlotPosition, AdSlotType } from '@thanaya/types';

export function AdsManager() {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'slots' | 'direct_ads'>('slots');

  // Direct Ad Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<DirectAd | null>(null);

  // Form State
  const [advertiserName, setAdvertiserName] = useState('');
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [slotPosition, setSlotPosition] = useState<AdSlotPosition>('homepage_top');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState(1);
  const [isActive, setIsActive] = useState(true);

  // Queries
  const { data: slots = [] } = useQuery({
    queryKey: ['ad_slots'],
    queryFn: () => api.getAdSlots(),
  });

  const { data: directAds = [] } = useQuery({
    queryKey: ['direct_ads'],
    queryFn: () => api.getDirectAds(),
  });

  // Mutations
  const updateSlotMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AdSlot> }) => api.updateAdSlot(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ad_slots'] }),
  });

  const createAdMutation = useMutation({
    mutationFn: (newAd: Parameters<typeof api.createDirectAd>[0]) => api.createDirectAd(newAd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct_ads'] });
      closeModal();
    },
  });

  const updateAdMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DirectAd> }) => api.updateDirectAd(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct_ads'] });
      closeModal();
    },
  });

  const deleteAdMutation = useMutation({
    mutationFn: (id: string) => api.deleteDirectAd(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direct_ads'] }),
  });

  const openAddModal = () => {
    setEditingAd(null);
    setAdvertiserName('');
    setTitle('');
    setImageUrl('');
    setTargetUrl('');
    setSlotPosition('homepage_top');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setPriority(1);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (ad: DirectAd) => {
    setEditingAd(ad);
    setAdvertiserName(ad.advertiser_name);
    setTitle(ad.title);
    setImageUrl(ad.image_url);
    setTargetUrl(ad.target_url);
    setSlotPosition(ad.slot_position);
    setStartDate(ad.start_date.split('T')[0]);
    setEndDate(ad.end_date.split('T')[0]);
    setPriority(ad.priority);
    setIsActive(ad.is_active);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAd(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advertiserName.trim() || !title.trim() || !targetUrl.trim() || !startDate || !endDate) return;

    const payload = {
      advertiser_name: advertiserName.trim(),
      title: title.trim(),
      image_url: imageUrl.trim(),
      target_url: targetUrl.trim(),
      slot_position: slotPosition,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      priority: Number(priority),
      is_active: isActive,
    };

    if (editingAd) {
      updateAdMutation.mutate({ id: editingAd.id, data: payload });
    } else {
      createAdMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">إدارة الإعلانات (Advertising System)</h2>
          <p className="text-sm text-slate-500">
            التحكم في أماكن الإعلانات الثابتة (Ad Slots) وإدارة الإعلانات المباشرة (Direct Ads)
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-lg text-xs font-semibold self-start">
          <button
            onClick={() => setActiveSubTab('slots')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeSubTab === 'slots' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المساحات الإعلانية (Slots)
          </button>
          <button
            onClick={() => setActiveSubTab('direct_ads')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeSubTab === 'direct_ads' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الإعلانات المباشرة (Direct Ads)
          </button>
        </div>
      </div>

      {activeSubTab === 'slots' ? (
        /* Ad Slots List */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-slate-900">{slot.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{slot.position}</span>
                </div>

                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">نوع العرض:</span>
                    <select
                      value={slot.slot_type}
                      onChange={(e) =>
                        updateSlotMutation.mutate({
                          id: slot.id,
                          data: { slot_type: e.target.value as AdSlotType },
                        })
                      }
                      className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="google">شبكة إعلانية معتمدة (Ad Network / Adsterra)</option>
                      <option value="direct">إعلان مباشر (Direct Ad)</option>
                      <option value="fallback">رسالة دعم المنصة (Fallback)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">حالة المساحة:</span>
                <button
                  onClick={() =>
                    updateSlotMutation.mutate({
                      id: slot.id,
                      data: { is_active: !slot.is_active },
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition ${
                    slot.is_active
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {slot.is_active ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>مفعلة</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>معطلة</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Direct Ads Management */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">قائمة الإعلانات المباشرة للمعلنين</h3>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة إعلان مباشر جديد</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-3 px-4">المعلن والعنوان</th>
                  <th className="py-3 px-4">المكان (Slot)</th>
                  <th className="py-3 px-4">فترة العرض</th>
                  <th className="py-3 px-4">المشاهدات والنقرات</th>
                  <th className="py-3 px-4">CTR</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {directAds.map((ad) => {
                  const ctr =
                    ad.impressions_count > 0
                      ? ((ad.clicks_count / ad.impressions_count) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <tr key={ad.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{ad.title}</div>
                        <div className="text-[11px] text-slate-500">{ad.advertiser_name}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{ad.slot_position}</td>
                      <td className="py-3 px-4 text-slate-500">
                        <div>من: {new Date(ad.start_date).toLocaleDateString('ar-EG')}</div>
                        <div>إلى: {new Date(ad.end_date).toLocaleDateString('ar-EG')}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        <div>👁 {ad.impressions_count.toLocaleString('ar-EG')}</div>
                        <div>🖱 {ad.clicks_count.toLocaleString('ar-EG')}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">{ctr}%</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            ad.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {ad.is_active ? 'نشط' : 'متوقف'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(ad)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                            title="تعديل"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف إعلان "${ad.title}"؟`)) {
                                deleteAdMutation.mutate(ad.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {directAds.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لا توجد إعلانات مباشرة مسجلة حتى الآن.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Direct Ad Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingAd ? 'تعديل الإعلان المباشر' : 'إضافة إعلان مباشر جديد'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المعلن / الأكاديمية *</label>
              <input
                type="text"
                required
                value={advertiserName}
                onChange={(e) => setAdvertiserName(e.target.value)}
                placeholder="مثال: منصة التفوق"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">المكان المخصص (Slot) *</label>
              <select
                value={slotPosition}
                onChange={(e) => setSlotPosition(e.target.value as AdSlotPosition)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {slots.map((s) => (
                  <option key={s.id} value={s.position}>
                    {s.name} ({s.position})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">عنوان الإعلان *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: خصم 50% على مراجعات ليلة الامتحان"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">رابط صورة البانر (Image URL)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/banner.jpg"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-left focus:outline-none focus:ring-2 focus:ring-emerald-500"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">رابط الهبوط للمعلن (Target URL) *</label>
            <input
              type="url"
              required
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://advertiser-site.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-left focus:outline-none focus:ring-2 focus:ring-emerald-500"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ البدء *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ الانتهاء *</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isAdActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
            <label htmlFor="isAdActive" className="text-xs font-medium text-slate-700 cursor-pointer">
              تشغيل الإعلان فورًا
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={createAdMutation.isPending || updateAdMutation.isPending}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              {editingAd ? 'حفظ التعديلات' : 'إضافة الإعلان'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
