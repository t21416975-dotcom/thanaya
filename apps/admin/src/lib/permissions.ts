import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { setCurrentPermissions } from './approval';
import type { MyPermissions, PermissionScopeType } from '@thanaya/types';

export const EMPTY_PERMISSIONS: MyPermissions = {
  admin_id: null,
  email: null,
  role: null,
  is_active: false,
  is_super_admin: false,
  is_staff: false,
  global: [],
  scoped: [],
  denied: [],
  scoped_subject_ids: [],
};

export async function fetchMyPermissions(): Promise<MyPermissions> {
  const { data, error } = await supabase.rpc('get_my_permissions');
  if (error) throw error;
  return (data as MyPermissions) ?? EMPTY_PERMISSIONS;
}

/**
 * مصدر الحقيقة للصلاحيات في الواجهة.
 * لا نضع الصلاحيات في الـJWT: تُقرأ من الدالة عند كل تغيير، فيسري السحب/المنح فورًا.
 */
export function usePermissions() {
  const query = useQuery({
    queryKey: ['my_permissions'],
    queryFn: fetchMyPermissions,
    staleTime: 30_000,
    retry: 1,
  });

  const permissions = query.data ?? EMPTY_PERMISSIONS;

  // زامن أحدث صلاحيات مع بوابة الاعتماد التي يقرأها api/client (خارج React)
  useEffect(() => {
    setCurrentPermissions(query.data ?? null);
  }, [query.data]);

  /** يملك المفتاح بأي نطاق (عام أو محدود) */
  const can = (key: string): boolean =>
    permissions.is_super_admin ||
    permissions.global.includes(key) ||
    permissions.scoped.some((s) => s.key === key);

  /** يملك المفتاح على مستوى النظام كله */
  const canGlobal = (key: string): boolean =>
    permissions.is_super_admin || permissions.global.includes(key);

  /** مواد محددة يملك عليها المفتاح (تُستخدم لتصفية القوائم وتقييد الاختيار) */
  const scopedSubjects = (key: string): string[] =>
    permissions.scoped
      .filter((s) => s.key === key && s.scope_type === 'subject' && s.scope_id)
      .map((s) => s.scope_id as string);

  /** موارد محددة بالمعرّف */
  const scopedResources = (key: string): string[] =>
    permissions.scoped
      .filter((s) => s.key === key && s.scope_type === 'resource' && s.scope_id)
      .map((s) => s.scope_id as string);

  const isDenied = (key: string): boolean => permissions.denied.includes(key);

  /** هل النطاق مقيّد؟ (لو كانت السطور أعلاه غير فارغة فالموظف محدود) */
  const isScoped = (key: string): boolean =>
    !canGlobal(key) && permissions.scoped.some((s) => s.key === key);

  return {
    permissions,
    isLoading: query.isLoading,
    isError: query.isError,
    can,
    canGlobal,
    scopedSubjects,
    scopedResources,
    isDenied,
    isScoped,
    refresh: query.refetch,
  };
}

export const SCOPE_LABELS: Record<PermissionScopeType, string> = {
  global: 'كل النظام',
  subject: 'مادة دراسية',
  content_type: 'نوع محتوى',
  week: 'أسبوع',
  resource: 'مورد محدد',
  exam: 'امتحان محدد',
};
