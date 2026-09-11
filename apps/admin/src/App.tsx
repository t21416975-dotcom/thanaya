import { useState, useEffect } from 'react';
import { BookOpen, Layers, Calendar, FileText, Megaphone, Flag, BarChart3, LogOut, CheckCircle, HelpCircle, Sparkles, Menu, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { SubjectsManager } from './components/SubjectsManager';
import { ContentTypesManager } from './components/ContentTypesManager';
import { WeeksManager } from './components/WeeksManager';
import { ResourcesManager } from './components/ResourcesManager';
import { ExamsManager } from './components/ExamsManager';
import { AISettingsManager } from './components/AISettingsManager';
import { ReportsManager } from './components/ReportsManager';
import { AdsManager } from './components/AdsManager';
import { AnalyticsView } from './components/AnalyticsView';
import { AuthLogin } from './components/AuthLogin';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'resources' | 'exams' | 'ai_settings' | 'subjects' | 'content_types' | 'weeks' | 'ads' | 'reports' | 'analytics'>('resources');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const navigation = [
    { id: 'resources' as const, name: 'الموارد والمحتوى', icon: FileText },
    { id: 'exams' as const, name: 'الامتحانات التجريبية (MCQ)', icon: HelpCircle },
    { id: 'ai_settings' as const, name: 'إعدادات الذكاء الاصطناعي (AI)', icon: Sparkles },
    { id: 'subjects' as const, name: 'المواد الدراسية', icon: BookOpen },
    { id: 'content_types' as const, name: 'أنواع المحتوى', icon: Layers },
    { id: 'weeks' as const, name: 'الأسابيع', icon: Calendar },
    { id: 'reports' as const, name: 'البلاغات', icon: Flag },
    { id: 'ads' as const, name: 'الإعلانات', icon: Megaphone },
    { id: 'analytics' as const, name: 'الإحصائيات والتقارير', icon: BarChart3 },
  ];

  const handleTabChange = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const currentNav = navigation.find((n) => n.id === activeTab);

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
          {navigation.map((item) => {
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
            <span className="hidden sm:inline">لوحة التحكم نشطة</span>
            <span className="sm:hidden">نشط</span>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1">
          {activeTab === 'resources' && <ResourcesManager />}
          {activeTab === 'exams' && <ExamsManager />}
          {activeTab === 'ai_settings' && <AISettingsManager />}
          {activeTab === 'subjects' && <SubjectsManager />}
          {activeTab === 'content_types' && <ContentTypesManager />}
          {activeTab === 'weeks' && <WeeksManager />}
          {activeTab === 'reports' && <ReportsManager />}
          {activeTab === 'ads' && <AdsManager />}
          {activeTab === 'analytics' && <AnalyticsView />}
        </div>
      </main>
    </div>
  );
}
