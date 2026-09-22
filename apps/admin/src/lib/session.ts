import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export const isSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project.supabase.co';

/**
 * مصدر الحقيقة الوحيد لحالة الجلسة في الواجهة.
 *
 * مهم: دوال الطاقم (مثل get_my_permissions و list_my_changes) محجوبة عن دور
 * anon في قاعدة البيانات عمدًا (REVOKE ... FROM anon). لذلك نداؤها قبل وجود
 * جلسة يُنتج 401 / "permission denied for function" بلا داعٍ في كل تحميل للصفحة.
 * كل استعلام يخصّ الطاقم يجب أن يكون مقيّدًا بـisAuthenticated.
 */
export function useSession() {
  const [isReady, setIsReady] = useState(!isSupabaseConfigured);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIsAuthenticated(!!data.session);
      setIsReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setIsReady(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { isReady, isAuthenticated };
}
