import { useState, useEffect } from 'react';
import { BookOpen, Layers, Calendar, FileText, Megaphone, Flag, BarChart3, LogOut, CheckCircle } from 'lucide-react';
import { supabase } from './lib/supabase';
import { SubjectsManager } from './components/SubjectsManager';
import { ContentTypesManager } from './components/ContentTypesManager';
import { WeeksManager } from './components/WeeksManager';
import { ResourcesManager } from './components/ResourcesManager';
import { ReportsManager } from './components/ReportsManager';
import { AdsManager } from './components/AdsManager';
import { AnalyticsView } from './components/AnalyticsView';
import { AuthLogin } from './components/AuthLogin';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'resources' | 'subjects' | 'content_types' | 'weeks' | 'ads' | 'reports' | 'analytics'>('resources');

  useEffect(() => {
    const checkAuth = async () => {
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://your-project.supabase.co') {
        const { data } = await supabase.auth.getSession();
        setIsAuthenticated(!!data.session);
      } else {
        const localSession = localStorage.getItem('thanaya_admin_session');
        setIsAuthenticated(!!localSession);
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
    { id: 'subjects' as const, name: 'المواد الدراسية', icon: BookOpen },
    { id: 'content_types' as const, name: 'أنواع المحتوى', icon: Layers },
    { id: 'weeks' as const, name: 'الأسابيع', icon: Calendar },
    { id: 'reports' as const, name: 'البلاغات', icon: Flag },
    { id: 'ads' as const, name: 'الإعلانات', icon: Megaphone },
    { id: 'analytics' as const, name: 'الإحصائيات والتقارير', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <span>لوحة تحكم ثنايا</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">منصة تقييمات البكالوريا</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
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
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-slate-800">
            {navigation.find((n) => n.id === activeTab)?.name}
          </h2>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>لوحة التحكم نشطة</span>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full">
          {activeTab === 'resources' && <ResourcesManager />}
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
