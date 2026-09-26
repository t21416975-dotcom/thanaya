import { supabase } from '../lib/supabase';
import { shouldQueueForApproval } from '../lib/approval';
import type { ContentType } from '@thanaya/types';
import { isConfigured, memory, submitChange } from './_shared';

export const contentTypesApi = {
  // --- CONTENT TYPES ---
  async getContentTypes(): Promise<ContentType[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('content_types').select('*').order('order_index');
      if (error) throw error;
      return (data as unknown as ContentType[]) || [];
    }
    return [...memory.contentTypes].sort((a, b) => a.order_index - b.order_index);
  },

  async createContentType(contentType: Omit<ContentType, 'id' | 'created_at' | 'updated_at'>): Promise<ContentType> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        const id = crypto.randomUUID();
        await submitChange({ entity: 'content_types', entityId: id, action: 'create', payload: { id, ...contentType } });
        const now = new Date().toISOString();
        return { ...contentType, id, created_at: now, updated_at: now } as ContentType;
      }
      const { data, error } = await (supabase.from('content_types') as any).insert(contentType).select().single();
      if (error) throw error;
      return data as unknown as ContentType;
    }
    const newType: ContentType = {
      ...contentType,
      id: `type-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memory.contentTypes.push(newType);
    return newType;
  },

  async updateContentType(id: string, updates: Partial<ContentType>): Promise<ContentType> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        await submitChange({ entity: 'content_types', entityId: id, action: 'update', payload: { ...updates } });
        return { id, ...updates } as ContentType;
      }
      const { data, error } = await (supabase.from('content_types') as any).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as ContentType;
    }
    const index = memory.contentTypes.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('ContentType not found');
    memory.contentTypes[index] = { ...memory.contentTypes[index], ...updates, updated_at: new Date().toISOString() };
    return memory.contentTypes[index];
  },

  async deleteContentType(id: string): Promise<void> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        await submitChange({ entity: 'content_types', entityId: id, action: 'delete', payload: { id } });
        return;
      }
      const { error } = await supabase.from('content_types').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memory.contentTypes = memory.contentTypes.filter((c) => c.id !== id);
  },
};
