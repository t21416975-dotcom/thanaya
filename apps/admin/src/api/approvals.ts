import { supabase } from '../lib/supabase';
import type { ChangeRequest } from '@thanaya/types';
import { isConfigured } from './_shared';

export const approvalsApi = {
  // ====== سير اعتماد التعديلات (طلبات التغيير) ======

  /** الموافقة أو الرفض — super_admin فقط؛ يمكن تمرير نسخة معدّلة تُطبَّق بدل الأصلية */
  async reviewChangeRequest(
    id: string,
    decision: 'approved' | 'rejected',
    note?: string,
    modifiedPayload?: Record<string, any>
  ): Promise<void> {
    const { error } = await supabase.rpc('review_change_request' as any, {
      p_id: id,
      p_decision: decision,
      p_note: note ?? null,
      p_modified_payload: modifiedPayload ?? null,
    } as any);
    if (error) throw error;
  },

  /** إلغاء طلب معلّق (المقدّم نفسه أو المدير العام) */
  async cancelChangeRequest(id: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_change_request' as any, { p_id: id } as any);
    if (error) throw error;
  },

  /** الطلبات المعلّقة — للمدير العام */
  async listPendingChanges(): Promise<ChangeRequest[]> {
    if (isConfigured) {
      const { data, error } = await supabase.rpc('list_pending_changes');
      if (error) throw error;
      return (data as ChangeRequest[]) || [];
    }
    return [];
  },

  /** أرشيف كل الطلبات — للمدير العام */
  async listAllChanges(): Promise<ChangeRequest[]> {
    if (isConfigured) {
      const { data, error } = await supabase.rpc('list_all_changes');
      if (error) throw error;
      return (data as ChangeRequest[]) || [];
    }
    return [];
  },

  /** طلبات الموظف نفسه بكل حالاتها */
  async listMyChanges(): Promise<ChangeRequest[]> {
    if (isConfigured) {
      const { data, error } = await supabase.rpc('list_my_changes');
      if (error) throw error;
      return (data as ChangeRequest[]) || [];
    }
    return [];
  },
};
