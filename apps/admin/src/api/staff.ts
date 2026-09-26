import { supabase } from '../lib/supabase';
import type { MyPermissions, Permission, AdminRolePreset, AdminPermission, AdminUser, AdminRole, PermissionEffect, PermissionScopeType } from '@thanaya/types';
import { isConfigured, memory, initialSubjects } from './_shared';

export const staffApi = {
  // --- STAFF & PERMISSIONS ---
  async getMyPermissions(): Promise<MyPermissions> {
    if (isConfigured) {
      const { data, error } = await supabase.rpc('get_my_permissions');
      if (error) throw error;
      return (data as unknown as MyPermissions) || {
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
    }
    return {
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
  },

  async getPermissionCatalog(): Promise<Permission[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('permissions').select('*').order('order_index');
      if (error) throw error;
      return (data as unknown as Permission[]) || [];
    }
    return [];
  },

  async getRolePresets(): Promise<AdminRolePreset[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('admin_role_presets').select('*');
      if (error) throw error;
      return (data as unknown as AdminRolePreset[]) || [];
    }
    return [];
  },

  async getStaff(): Promise<AdminUser[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('admins').select('*').order('created_at');
      if (error) throw error;
      return (data as unknown as AdminUser[]) || [];
    }
    return [];
  },

  /** كل المنح الظاهرة للمستخدم الحالي (المدير يرى الكل، والموظف يرى منحه) */
  async getStaffPermissions(): Promise<AdminPermission[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('admin_permissions').select('*').order('created_at');
      if (error) throw error;
      return (data as unknown as AdminPermission[]) || [];
    }
    return [];
  },

  async grantPermission(input: {
    admin_id: string;
    permission_key: string;
    effect?: PermissionEffect;
    scope_type?: PermissionScopeType;
    scope_id?: string | null;
    expires_at?: string | null;
  }): Promise<AdminPermission> {
    const { data, error } = await (supabase.from('admin_permissions') as any)
      .insert({
        effect: 'allow',
        scope_type: 'global',
        scope_id: null,
        ...input,
      })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as AdminPermission;
  },

  async revokePermission(id: string): Promise<void> {
    const { error } = await supabase.from('admin_permissions').delete().eq('id', id);
    if (error) throw error;
  },

  async updateStaffRole(id: string, role: AdminRole): Promise<void> {
    const { error } = await (supabase.from('admins') as any).update({ role }).eq('id', id);
    if (error) throw error;
  },

  async setStaffActive(id: string, is_active: boolean): Promise<void> {
    const { error } = await (supabase.from('admins') as any).update({ is_active }).eq('id', id);
    if (error) throw error;
  },

  async createStaff(input: { email: string; password: string; role: AdminRole }): Promise<{ message: string }> {
    const { data, error } = await supabase.functions.invoke('admin-invite', {
      body: {
        action: 'create',
        email: input.email.trim(),
        password: input.password,
        role: input.role,
      },
    });
    if (error) {
      let msg = error.message;
      try {
        if ('context' in error && typeof (error as any).context?.json === 'function') {
          const body = await (error as any).context.json();
          if (body?.error) msg = body.error;
        }
      } catch {}
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async deleteStaff(staffId: string): Promise<{ message: string }> {
    const { data, error } = await supabase.functions.invoke('admin-invite', {
      body: {
        action: 'delete',
        staffId,
      },
    });
    if (error) {
      let msg = error.message;
      try {
        if ('context' in error && typeof (error as any).context?.json === 'function') {
          const body = await (error as any).context.json();
          if (body?.error) msg = body.error;
        }
      } catch {}
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },

  /** البلاغات عبر RPC لأن الفلترة بالنطاق تحدث في القاعدة (يتفادى حجب العلاقات بـRLS) */
  async listStaffReports() {
    if (isConfigured) {
      const { data, error } = await supabase.rpc('list_staff_reports');
      if (error) throw error;
      return data || [];
    }
    return memory.reports.map((rep) => {
      const res = memory.resources.find((r) => r.id === rep.resource_id);
      const sub = initialSubjects.find((s) => s.id === res?.subject_id);
      return {
        id: rep.id,
        resource_id: rep.resource_id,
        issue_type: rep.issue_type,
        details: rep.details,
        status: rep.status,
        created_at: rep.created_at,
        resolved_at: rep.resolved_at,
        resource_title: res?.title || 'مورد محذوف أو غير معروف',
        subject_id: sub?.id || null,
        subject_name: sub?.name || null,
      };
    });
  },
};
