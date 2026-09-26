import { supabase } from '../lib/supabase';
import { shouldQueueForApproval } from '../lib/approval';
import type { Week } from '@thanaya/types';
import { isConfigured, memory, submitChange } from './_shared';

export const weeksApi = {
  // --- WEEKS ---
  async getWeeks(): Promise<Week[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('weeks').select('*').order('term').order('week_number');
      if (error) throw error;
      return (data as unknown as Week[]) || [];
    }
    return [...memory.weeks].sort((a, b) => a.term - b.term || a.week_number - b.week_number);
  },

  async createWeek(week: Omit<Week, 'id' | 'created_at'>): Promise<Week> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        const id = crypto.randomUUID();
        await submitChange({ entity: 'weeks', entityId: id, action: 'create', payload: { id, ...week } });
        return { ...week, id, created_at: new Date().toISOString() } as Week;
      }
      const { data, error } = await (supabase.from('weeks') as any).insert(week).select().single();
      if (error) throw error;
      return data as unknown as Week;
    }
    const newWeek: Week = {
      ...week,
      id: `w-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    memory.weeks.push(newWeek);
    return newWeek;
  },

  async updateWeek(id: string, week: Partial<Omit<Week, 'id' | 'created_at'>>): Promise<Week> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        await submitChange({ entity: 'weeks', entityId: id, action: 'update', payload: { ...week } });
        return { id, ...week } as Week;
      }
      const { data, error } = await (supabase.from('weeks') as any)
        .update(week)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Week;
    }
    const idx = memory.weeks.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error('Week not found');
    memory.weeks[idx] = { ...memory.weeks[idx], ...week };
    return memory.weeks[idx];
  },

  async deleteWeek(id: string): Promise<void> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        await submitChange({ entity: 'weeks', entityId: id, action: 'delete', payload: { id } });
        return;
      }
      const { error } = await supabase.from('weeks').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memory.weeks = memory.weeks.filter((w) => w.id !== id);
  },
};
