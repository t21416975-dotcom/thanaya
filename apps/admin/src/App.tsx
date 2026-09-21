import { useState, useEffect } from 'react';
import { BookOpen, Layers, Calendar, FileText, Megaphone, Flag, BarChart3, LogOut, CheckCircle, HelpCircle, Sparkles, Menu, X, Bell, ShieldCheck } from 'lucide-react';
import { supabase } from './lib/supabase';
import { usePermissions } from './lib/permissions';
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
import { AuthLogin } from './components/AuthLogin';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'مدير عام',
  admin: 'أدمن',
  editor: 'محرر محتوى',
};

type TabId = 'resources' | 'exams' | 'notifications' | 'ai_settings' | 'subjects' | 'content_types' | 'weeks' | 'ads' | 'reports' | 'analytics' | 'staff';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('resources');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { permissions, can, isLoading: permsLoading } = usePermissions();

  useEffect(() => {
    const checkAuth = async () => {
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://your-project.supabase.co') {
        const { data } = await supabase.auth.getSession();
        setIsAuthenticated(!!data.session);
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://your-project.supabase.co') {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('thanaya_admin_session');
    setIsAuthenticated(false);
  };

  const navigation = [
    { id: 'resources' as const,     name: 'الموارد والمحتوى',        icon: FileText,    perm: 'resources.view' },
    { id: 'exams' as const,         name: 'الامتحانات التجريبية (MCQ)', icon: HelpCircle,  perm: 'exams.view' },
    { id: 'notifications' as const, name: 'الإشعارات والتنبيهات',      icon: Bell,        perm: 'notifications.manage' },
    { id: 'ai_settings' as const,   name: 'إعدادات الذكاء الاصطناعي (AI)', icon: Sparkles, perm: 'settings.manage' },
    { id: 'subjects' as const,      name: 'المواد الدراسية',          icon: BookOpen,    perm: 'subjects.manage' },
    { id: 'content_types' as const, name: 'أنواع المحتوى',            icon: Layers,      perm: 'content_types.manage' },
    { id: 'weeks' as const,         name: 'الأسابيع',                icon: Calendar,    perm: 'weeks.manage' },
    { id: 'reports' as const,       name: 'البلاغات',                icon: Flag,        perm: 'reports.view' },
    { id: 'ads' as const,           name: 'الإعلانات',               icon: Megaphone,   perm: 'ads.manage' },
    { id: 'analytics' as const,     name: 'الإحصائيات والتقارير',      icon: BarChart3,   perm: 'analytics.view' },
    { id: 'staff' as const,         name: 'الفريق والصلاحيات',        icon: ShieldCheck, perm: 'staff.manage' },
  ];

  const visibleNav = navigation.filter((n) => can(n.perm));

  useEffect(() => {
    if (visibleNav.length > 0 && !visibleNav.some((n) => n.id === activeTab)) {
      setActiveTab(visibleNav[0].id);
    }
  }, [permissions.admin_id, visibleNav.length, activeTab]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
        جاري فحص الجلسة...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthLogin onSuccess={() => setIsAuthenticated(true)} />;
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
        className={`fixed lg:static top-0 right-0 bottom-0 z-50 w-72 lg:w-64 bg-slate-900 text-white flex flex-col shrink-0 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
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
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
              aria-label="فتح القائمة الجانبية"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              {currentNav && <currentNav.icon className="w-5 h-5 text-emerald-600 lg:hidden" />}
              <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate max-w-[180px] sm:max-w-xs md:max-w-none">
                {currentNav?.name}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">
              {ROLE_LABELS[permissions.role ?? ''] ?? 'مستخدم'}{permissions.email ? ` · ${permissions.email}` : ''}
            </span>
            <span className="sm:hidden">
              {ROLE_LABELS[permissions.role ?? ''] ?? 'نشط'}
            </span>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1">
          {activeTab === 'resources' && <ResourcesManager />}
          {activeTab === 'exams' && <ExamsManager />}
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
    </div>
  );
}
