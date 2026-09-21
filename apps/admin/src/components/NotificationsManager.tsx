import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Send,
  Plus,
  Trash2,
  AlertTriangle,
  Smartphone,
  ExternalLink,
  Radio,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import type { Notification, NotificationType, NotificationPriority } from '@thanaya/types';

export function NotificationsManager() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [type, setType] = useState<NotificationType>('bell');
  const [priority, setPriority] = useState<NotificationPriority>('normal');
  const [sendPush, setSendPush] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter
  const [filterType, setFilterType] = useState<string>('all');

  // Queries
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(),
  });

  const { data: pushCount = 0 } = useQuery({
    queryKey: ['push_subscriptions_count'],
    queryFn: () => api.getPushSubscriptionsCount(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (newNotif: Omit<Notification, 'id' | 'created_at' | 'updated_at'>) => {
      const created = await api.createNotification(newNotif);
      if (sendPush) {
        await api.sendPushBroadcast({
          title: newNotif.title,
          message: newNotif.message,
          url: newNotif.link_url || '/',
        });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      resetForm();
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setFormError(err.message || 'حدث خطأ أثناء حفظ الإشعار.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Notification> }) =>
      api.updateNotification(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setLinkUrl('');
    setType('bell');
    setPriority('normal');
    setSendPush(true);
    setFormError(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setFormError('يرجى ملء العنوان ونص الإشعار.');
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      message: message.trim(),
      link_url: linkUrl.trim() || null,
      type,
      priority,
      is_active: true,
      expires_at: null,
    });
  };

  const handleToggleActive = (notif: Notification) => {
    updateMutation.mutate({
      id: notif.id,
      data: { is_active: !notif.is_active },
    });
  };

  const handleSendPushNow = async (notif: Notification) => {
    const res = await api.sendPushBroadcast({
      title: notif.title,
      message: notif.message,
      url: notif.link_url || '/',
    });
    alert(res.message || `تم إرسال إشعار المتصفح بنجاح!`);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterType !== 'all' && n.type !== filterType) return false;
    return true;
  });

  const activeCount = notifications.filter((n) => n.is_active).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center flex-wrap gap-2">
            <span>نظام الإشعارات والتنبيهات</span>
            <span className="p-1 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Web Push</span>
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            إرسال تنبيهات مباشرة لمتصفحات الطلاب وإظهار أشرطة التنبيه وجرس الموقع
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-4 py-2.5 sm:py-2 rounded-xl text-sm font-semibold transition shadow-sm w-full sm:w-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إرسال إشعار جديد</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Push Subscribers Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-semibold">
              المشتركون في إشعارات المتصفح
            </span>
            <div className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <span>{pushCount}</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                جهاز نشط
              </span>
            </div>
            <p className="text-[11px] text-slate-400">طلاب استقبلوا إذن الـ Web Push</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
        </div>

        {/* Active Alerts Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-semibold">الإشعارات المعروضة بالموقع</span>
            <div className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <span>{activeCount}</span>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                ظاهر للطلاب
              </span>
            </div>
            <p className="text-[11px] text-slate-400">في الجرس والشريط العلوي</p>
          </div>
          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center shrink-0">
            <Bell className="w-6 h-6" />
          </div>
        </div>

        {/* Total Broadcasts Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-semibold">إجمالي التنبيهات المرسلة</span>
            <div className="text-2xl font-extrabold text-slate-900">
              {notifications.length}
            </div>
            <p className="text-[11px] text-slate-400">سجل الإشعارات الكامل</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Send className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filterType === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          الكل ({notifications.length})
        </button>
        <button
          onClick={() => setFilterType('bell')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filterType === 'bell'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          🔔 جرس الهيدر
        </button>
        <button
          onClick={() => setFilterType('banner')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filterType === 'banner'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          📢 شريط الموقع العلوي
        </button>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-sm">جاري تحميل الإشعارات...</div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
          <Bell className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-sm font-medium">لا توجد إشعارات مسجلة حالياً</p>
          <p className="text-xs text-slate-400">
            اضغط على "إرسال إشعار جديد" لإعلام الطلاب بالتقييمات والملفات الجديدة
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View (shown below md:) */}
          <div className="md:hidden space-y-3">
            {filteredNotifications.map((notif) => {
              const isUrgent = notif.priority === 'urgent';
              return (
                <div
                  key={notif.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 text-sm break-words">
                        {notif.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-3">
                        {notif.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleSendPushNow(notif)}
                        title="إعادة إرسال إشعار Push"
                        aria-label="إعادة إرسال Push"
                        className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer active:scale-95"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('هل أنت متأكد من حذف هذا الإشعار نهائياً؟')) {
                            deleteMutation.mutate(notif.id);
                          }
                        }}
                        title="حذف الإشعار"
                        aria-label="حذف"
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Destination Link if present */}
                  {notif.link_url && (
                    <a
                      href={notif.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50/60 px-2.5 py-1 rounded-lg hover:underline truncate max-w-full font-mono dir-ltr"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{notif.link_url}</span>
                    </a>
                  )}

                  {/* Badges and Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                      {notif.type === 'bell'
                        ? '🔔 جرس'
                        : notif.type === 'banner'
                        ? '📢 شريط'
                        : '💬 منبثقة'}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg font-bold border ${
                        isUrgent
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isUrgent ? 'عاجل' : 'عادي'}
                    </span>
                  </div>

                  {/* Footer with Status Toggle and Date */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      {new Date(notif.created_at).toLocaleDateString('ar-EG', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    <button
                      onClick={() => handleToggleActive(notif)}
                      className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition cursor-pointer active:scale-95 ${
                        notif.is_active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {notif.is_active ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>نشط ومُعروض</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>مخفي</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (hidden on mobile, shown on md:) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 font-semibold">عنوان الإشعار والمحتوى</th>
                    <th className="px-4 py-3 font-semibold">نوع العرض</th>
                    <th className="px-4 py-3 font-semibold">الأولوية</th>
                    <th className="px-4 py-3 font-semibold">تاريخ الإرسال</th>
                    <th className="px-4 py-3 font-semibold">الحالة</th>
                    <th className="px-4 py-3 font-semibold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredNotifications.map((notif) => {
                    const isUrgent = notif.priority === 'urgent';
                    return (
                      <tr key={notif.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-4 max-w-sm">
                          <div className="font-bold text-slate-900">{notif.title}</div>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {notif.message}
                          </p>
                          {notif.link_url && (
                            <a
                              href={notif.link_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline mt-1"
                            >
                              <span>{notif.link_url}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                            {notif.type === 'bell'
                              ? '🔔 جرس الهيدر'
                              : notif.type === 'banner'
                              ? '📢 شريط علوي'
                              : '💬 نافذة منبثقة'}
                          </span>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                              isUrgent
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {isUrgent ? 'عاجل' : 'عادي'}
                          </span>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500">
                          {new Date(notif.created_at).toLocaleDateString('ar-EG', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleActive(notif)}
                            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                              notif.is_active
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {notif.is_active ? (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>نشط</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>مخفي</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSendPushNow(notif)}
                              title="إعادة إرسال إشعار Push للمتصفحات"
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            >
                              <Send className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                if (confirm('هل أنت متأكد من حذف هذا الإشعار نهائياً؟')) {
                                  deleteMutation.mutate(notif.id);
                                }
                              }}
                              title="حذف الإشعار"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Create Notification Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="إرسال إشعار وتنبيه جديد"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              عنوان الإشعار *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تم رفع حل تقييم الأسبوع الخامس في الفيزياء"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              نص الإشعار والتفاصيل *
            </label>
            <textarea
              required
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="شرح مختصر للإشعار وما يحتويه..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Target Link URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              رابط الوجهة عند النقر (اختياري)
            </label>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="مثال: /subjects/physics أو https://..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left font-mono text-xs"
              dir="ltr"
            />
          </div>

          {/* Type & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نوع العرض بالموقع</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as NotificationType)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="bell">جرس الهيدر (قائمة التنبيهات)</option>
                <option value="banner">شريط إعلاني أعلى الموقع</option>
                <option value="popup">نافذة منبثقة للزوار</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الأولوية</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as NotificationPriority)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="normal">عادي (أخضر)</option>
                <option value="urgent">عاجل / هام (برتقالي)</option>
              </select>
            </div>
          </div>

          {/* Push Broadcast Checkbox */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendPush}
                onChange={(e) => setSendPush(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 flex-wrap">
                <span>إرسال إشعار فوري لمتصفحات المشتركين (Web Push)</span>
                <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                  {pushCount} مشترك
                </span>
              </span>
            </label>
            <p className="text-[11px] text-slate-500 pr-6.5">
              سيتم إرسال إشعار Push حقيقي لكل الأجهزة والمتصفحات المشتركة حتى وإن كان الموقع مغلقاً.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition text-center"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm cursor-pointer text-center"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{createMutation.isPending ? 'جاري الإرسال...' : 'إرسال ونشر الإشعار'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
