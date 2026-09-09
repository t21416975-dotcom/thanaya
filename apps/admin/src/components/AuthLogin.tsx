import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, AlertCircle, ShieldCheck } from 'lucide-react';

interface AuthLoginProps {
  onSuccess: () => void;
}

export function AuthLogin({ onSuccess }: AuthLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // If live Supabase URL is present, authenticate with Supabase Auth
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://your-project.supabase.co') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
      } else {
        // Local preview fallback authentication
        if (email === 'admin@thanaya.com' && password === 'admin123') {
          localStorage.setItem('thanaya_admin_session', 'mock_token');
        } else {
          // Allow any admin email for demo if entered or hint default credentials
          localStorage.setItem('thanaya_admin_session', 'mock_token');
        }
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    localStorage.setItem('thanaya_admin_session', 'mock_token');
    onSuccess();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-2xl border border-slate-800 space-y-6">
        <div className="text-center">
          <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-xl mb-3">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">تسجيل دخول الأدمن</h1>
          <p className="text-sm text-slate-500 mt-1">لوحة إدارة منصة ثنايا للبكالوريا</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">البريد الإلكتروني</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@thanaya.com"
                className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                dir="ltr"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة المرور</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                dir="ltr"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50"
          >
            {loading ? 'جاري التحقق...' : 'دخول لوحة التحكم'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center">
          <button
            onClick={handleQuickDemoLogin}
            className="text-xs text-slate-500 hover:text-emerald-700 font-medium underline"
          >
            الدخول المباشر السريع (Quick Admin Access)
          </button>
        </div>
      </div>
    </div>
  );
}
