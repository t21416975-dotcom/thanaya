import { supabase } from '../lib/supabase';
import type { SystemSetting } from '@thanaya/types';
import { isConfigured, memory } from './_shared';

export const settingsApi = {
  // --- SYSTEM SETTINGS (AI) ---
  async getSystemSettings(): Promise<SystemSetting[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('system_settings').select('*');
      if (error) throw error;
      return (data as unknown as SystemSetting[]) || [];
    }
    return [...memory.systemSettings];
  },

  async updateSystemSetting(key: string, value: string, description?: string): Promise<SystemSetting> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('system_settings') as any)
        .upsert({ key, value, description, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SystemSetting;
    }
    const idx = memory.systemSettings.findIndex((s) => s.key === key);
    const updated: SystemSetting = {
      key,
      value,
      description: description !== undefined ? description : (idx !== -1 ? memory.systemSettings[idx].description : null),
      updated_at: new Date().toISOString(),
    };
    if (idx !== -1) {
      memory.systemSettings[idx] = updated;
    } else {
      memory.systemSettings.push(updated);
    }
    return updated;
  },
};
