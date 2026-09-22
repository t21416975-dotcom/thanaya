import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Layers, Calendar, FileText, Megaphone, Flag, BarChart3, LogOut, CheckCircle, HelpCircle, Sparkles, Menu, X, Bell, ShieldCheck, Inbox } from 'lucide-react';
import { supabase } from './lib/supabase';
import { usePermissions } from './lib/permissions';
import { APPROVAL_QUEUED_EVENT, setCurrentPermissions } from './lib/approval';
import { useSession, isSupabaseConfigured } from './lib/session';
import { api } from './api/client';
import { SubjectsManager } from './components/SubjectsManager';
import { ContentTypesManager } from './components/ContentTypesManager';
import { WeeksManager } from './components/WeeksManager';
import { ResourcesManager } from './components/ResourcesManager';
import { ExamsManager } from './components/ExamsManager';
import { AISettingsManager } from './components/AISettingsManager';
import { ReportsManager } from './components/ReportsManager';
import { AdsManager } from './components/AdsManager';
import { AnalyticsView } from './components/AnalyticsView';
import { NotificationsManager } from './components/NotificationsManager';
import { StaffManager } from './components/StaffManager';
import { ApprovalsManager } from './components/ApprovalsManager';
import { SetPasswordModal } from './components/SetPasswordModal';
import { AuthLogin } from './components/AuthLogin';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'مدير عام',
  admin: 'أدمن',
  editor: 'محرر محتوى',
};

type TabId = 'resources' | 'exams' | 'notifications' | 'ai_settings' | 'subjects' | 'content_types' | 'weeks' | 'ads' | 'reports' | 'analytics' | 'staff' | 'approvals';

export function App() {
  const queryClient = useQueryClient();
  // حقيقة الجلسة من مكان واحد (تدعم تسجيل الدخول والخروج والانتهاء تلقائيًا)
  const { isReady: sessionReady, isAuthenticated } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>('resources');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [queuedToast, setQueuedToast] = useState(0);
  const { permissions, can, isLoading: permsLoading } = usePermissions();

  // عدّاد الطلبات المعلّقة (للمدير العام فقط) — يظهر كشارة على تبويب الموافقات
  const { data: pendingChanges = [] } = useQuery({
    queryKey: ['pending_changes'],
    queryFn: () => api.listPendingChanges(),
    enabled: isAuthenticated && permissions.is_super_admin,
    refetchInterval: 30_000,
  });

  // تنبيه عند تحويل أي تعديل موظف إلى طلب موافقة
  useEffect(() => {
    const handler = () => {
      setQueuedToast(Date.now());
      queryClient.invalidateQueries({ queryKey: ['pending_changes'] });
      queryClient.invalidateQueries({ queryKey: ['my_changes'] });
    };
    window.addEventListener(APPROVAL_QUEUED_EVENT, handler);
    return () => window.removeEventListener(APPROVAL_QUEUED_EVENT, handler);
  }, [queryClient]);

  // إخفاء التنبيه تلقائيًا بعد 5 ثوانٍ
  useEffect(() => {
    if (!queuedToast) return;
    const t = setTimeout(() => setQueuedToast(0), 5000);
    return () => clearTimeout(t);
  }, [queuedToast]);

  // روابط الدعوة/الاستعادة تفتح نافذة تعيين كلمة المرور
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('type=invite') || hash.includes('type=recovery'))) {
      setShowSetPassword(true);
    }
  }, []);

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('thanaya_admin_session');
    // لا نترك بيانات أو صلاحيات المستخدم السابق في الكاش
    setCurrentPermissions(null);
    queryClient.clear();
  };

  const navigation: { id: TabId; name: string; icon: typeof FileText; perm: string | null; superOnly?: boolean }[] = [
    { id: 'resources',     name: 'الموارد والمحتوى',           icon: FileText,    perm: 'resources.view' },
    { id: 'exams',         name: 'الامتحانات التجريبية (MCQ)', icon: HelpCircle,  perm: 'exams.view' },
    { id: 'approvals',     name: 'طلبات الموافقة',             icon: Inbox,       perm: null },
    { id: 'notifications', name: 'الإشعارات والتنبيهات',       icon: Bell,        perm: 'notifications.manage', superOnly: true },
    { id: 'ai_settings',   name: 'إعدادات الذكاء الاصطناعي (AI)', icon: Sparkles, perm: 'settings.manage', superOnly: true },
    { id: 'subjects',      name: 'المواد الدراسية',            icon: BookOpen,    perm: 'subjects.manage' },
    { id: 'content_types', name: 'أنواع المحتوى',              icon: Layers,      perm: 'content_types.manage' },
    { id: 'weeks',         name: 'الأسابيع',                   icon: Calendar,    perm: 'weeks.manage' },
    { id: 'reports',       name: 'البلاغات',                   icon: Flag,        perm: 'reports.view' },
    { id: 'ads',           name: 'الإعلانات',                  icon: Megaphone,   perm: 'ads.manage', superOnly: true },
    { id: 'analytics',     name: 'الإحصائيات والتقارير',       icon: BarChart3,   perm: 'analytics.view' },
    { id: 'staff',         name: 'الفريق والصلاحيات',          icon: ShieldCheck, perm: 'staff.manage' },
  ];

  // تبويب الموافقات متاح لكل الطاقم (الموظف يرى طلباته، والمدير العام يرى الطابور).
  // الإعلانات والإشعارات والإعدادات محصورة بالمدير العام (superOnly).
  const visibleNav = navigation.filter(
    (n) => (n.perm === null || can(n.perm)) && (!n.superOnly || permissions.is_super_admin)
  );

  useEffect(() => {
    if (visibleNav.length > 0 && !visibleNav.some((n) => n.id === activeTab)) {
      setActiveTab(visibleNav[0].id);
    }
  }, [permissions.admin_id, visibleNav.length, activeTab]);

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
        جاري فحص الجلسة...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthLogin
        onSuccess={() => {
          // الجلسة تُلتقط تلقائيًا عبر useSession، ونعيد جلب الصلاحيات للمستخدم الجديد
          queryClient.removeQueries({ queryKey: ['my_permissions'] });
          queryClient.invalidateQueries({ queryKey: ['my_permissions'] });
        }}
      />
    );
  }

  if (!permsLoading && !permissions.is_staff) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900 text-slate-300 p-6 text-center">
        <ShieldCheck className="w-10 h-10 text-rose-400" />
        <p className="text-sm">حسابك غير مصرح له بالوصول، أو تم تعطيله. تواصل مع المدير العام.</p>
        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm cursor-pointer"
        >
          تسجيل الخروج
        </button>
      </div>
    );
  }

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const currentNav = visibleNav.find((n) => n.id === activeTab) || navigation.find((n) => n.id === activeTab);

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-800 relative">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar (Desktop static & Mobile drawer) */}
      <aside
        className={`fixed lg:static top-0 right-0 bottom-0 z-50 w-72 lg:w-64 bg-slate-900 text-white flex flex-col shrink-0 transform transition-transform duration-200 ease-in-out overscroll-contain lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <span>لوحة تحكم ثنايا</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">منصة تقييمات البكالوريا</p>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition active:scale-95"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile User Profile info inside drawer */}
        <div className="lg:hidden px-4 py-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-200 truncate">
                {permissions.email || 'المشرف'}
              </div>
              <div className="text-[10px] text-emerald-400">
                {ROLE_LABELS[permissions.role ?? ''] ?? 'مشرف'}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition cursor-pointer text-right min-h-[44px] active:scale-[0.98] ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="truncate">{item.name}</span>
                {item.id === 'approvals' && permissions.is_super_admin && pendingChanges.length > 0 && (
                  <span className="mr-auto bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shrink-0">
                    {pendingChanges.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer min-h-[44px] active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95"
              aria-label="فتح القائمة الجانبية"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              {currentNav && <currentNav.icon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 lg:hidden shrink-0" />}
              <h2 className="text-xs sm:text-base font-bold text-slate-800 truncate">
                {currentNav?.name}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">
              {ROLE_LABELS[permissions.role ?? ''] ?? 'مستخدم'}{permissions.email ? ` · ${permissions.email}` : ''}
            </span>
            <span className="sm:hidden font-semibold">
              {ROLE_LABELS[permissions.role ?? ''] ?? 'نشط'}
            </span>
          </div>
        </header>

        <div className="p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1">
          {activeTab === 'resources' && <ResourcesManager />}
          {activeTab === 'exams' && <ExamsManager />}
          {activeTab === 'approvals' && <ApprovalsManager />}
          {activeTab === 'notifications' && <NotificationsManager />}
          {activeTab === 'ai_settings' && <AISettingsManager />}
          {activeTab === 'subjects' && <SubjectsManager />}
          {activeTab === 'content_types' && <ContentTypesManager />}
          {activeTab === 'weeks' && <WeeksManager />}
          {activeTab === 'reports' && <ReportsManager />}
          {activeTab === 'ads' && <AdsManager />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'staff' && <StaffManager />}
        </div>
      </main>

      {queuedToast > 0 && (
        <div
          key={queuedToast}
          className="fixed bottom-4 left-4 right-4 sm:right-auto z-[60] bg-emerald-600 text-white text-sm font-semibold px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-slideUp"
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>أُرسل تعديلك لمراجعة المدير العام — سيظهر للمستخدمين بعد الاعتماد</span>
        </div>
      )}

      {showSetPassword && (
        <SetPasswordModal
          isOpen={showSetPassword}
          onClose={() => setShowSetPassword(false)}
        />
      )}
    </div>
  );
}
