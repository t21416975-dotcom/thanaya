import { supabase } from '../lib/supabase';
import { shouldQueueForApproval } from '../lib/approval';
import type { Subject } from '@thanaya/types';
import { isConfigured, memory, submitChange } from './_shared';

export const subjectsApi = {
  // --- SUBJECTS ---
  async getSubjects(): Promise<Subject[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('subjects').select('*').order('order_index');
      if (error) throw error;
      return (data as unknown as Subject[]) || [];
    }
    return [...memory.subjects].sort((a, b) => a.order_index - b.order_index);
  },

  async createSubject(subject: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Promise<Subject> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        const id = crypto.randomUUID();
        await submitChange({ entity: 'subjects', entityId: id, action: 'create', payload: { id, ...subject } });
        const now = new Date().toISOString();
        return { ...subject, id, created_at: now, updated_at: now } as Subject;
      }
      const { data, error } = await (supabase.from('subjects') as any).insert(subject).select().single();
      if (error) throw error;
      return data as unknown as Subject;
    }
    const newSubject: Subject = {
      ...subject,
      id: `subj-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memory.subjects.push(newSubject);
    return newSubject;
  },

  async updateSubject(id: string, updates: Partial<Subject>): Promise<Subject> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        await submitChange({ entity: 'subjects', entityId: id, action: 'update', payload: { ...updates } });
        return { id, ...updates } as Subject;
      }
      const { data, error } = await (supabase.from('subjects') as any).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as Subject;
    }
    const index = memory.subjects.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('Subject not found');
    memory.subjects[index] = { ...memory.subjects[index], ...updates, updated_at: new Date().toISOString() };
    return memory.subjects[index];
  },

  async deleteSubject(id: string): Promise<void> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        await submitChange({ entity: 'subjects', entityId: id, action: 'delete', payload: { id } });
        return;
      }
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memory.subjects = memory.subjects.filter((s) => s.id !== id);
  },
};
