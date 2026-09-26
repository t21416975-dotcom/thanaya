import { supabase } from '../lib/supabase';
import { shouldQueueForApproval } from '../lib/approval';
import type { Resource } from '@thanaya/types';
import { isConfigured, memory, submitChange } from './_shared';

export const resourcesApi = {
  // --- RESOURCES ---
  async getResources(): Promise<Resource[]> {
    if (isConfigured) {
      const { data, error } = await supabase
        .from('resources')
        .select('*, subject:subjects(*), content_type:content_types(*), week:weeks(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Resource[]) || [];
    }
    return memory.resources.map((res) => ({
      ...res,
      subject: memory.subjects.find((s) => s.id === res.subject_id),
      content_type: memory.contentTypes.find((c) => c.id === res.content_type_id),
      week: memory.weeks.find((w) => w.id === res.week_id),
    }));
  },

  async createResource(resource: Omit<Resource, 'id' | 'views_count' | 'downloads_count' | 'created_at' | 'updated_at' | 'subject' | 'content_type' | 'week'>): Promise<Resource> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        const id = crypto.randomUUID();
        await submitChange({ entity: 'resources', entityId: id, action: 'create', payload: { id, ...resource } });
        const now = new Date().toISOString();
        return {
          ...resource,
          id,
          views_count: 0,
          downloads_count: 0,
          created_at: now,
          updated_at: now,
        } as Resource;
      }
      const { data, error } = await (supabase.from('resources') as any).insert(resource).select().single();
      if (error) throw error;
      return data as unknown as Resource;
    }
    const newResource: Resource = {
      ...resource,
      id: `res-${Date.now()}`,
      views_count: 0,
      downloads_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memory.resources.unshift(newResource);
    return newResource;
  },

  async updateResource(id: string, updates: Partial<Resource>): Promise<Resource> {
    if (isConfigured) {
      const allowedKeys = ['title', 'slug', 'description', 'subject_id', 'content_type_id', 'week_id', 'pdf_url', 'youtube_url', 'is_published', 'is_coming_soon', 'coming_soon_message', 'published_at'];
      const sanitized = Object.fromEntries(
        Object.entries(updates).filter(([key]) => allowedKeys.includes(key))
      );
      if (shouldQueueForApproval()) {
        await submitChange({ entity: 'resources', entityId: id, action: 'update', payload: sanitized });
        return { id, ...updates } as Resource;
      }
      const { data, error } = await (supabase.from('resources') as any).update(sanitized).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as Resource;
    }
    const index = memory.resources.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Resource not found');
    memory.resources[index] = { ...memory.resources[index], ...updates, updated_at: new Date().toISOString() };
    return memory.resources[index];
  },

  async deleteResource(id: string): Promise<void> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        await submitChange({ entity: 'resources', entityId: id, action: 'delete', payload: { id } });
        return;
      }
      const { error } = await supabase.from('resources').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memory.resources = memory.resources.filter((r) => r.id !== id);
  },

  async checkSlugExists(slug: string, excludeId?: string): Promise<boolean> {
    if (isConfigured) {
      let query = supabase.from('resources').select('id').eq('slug', slug);
      if (excludeId) {
        query = query.neq('id', excludeId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data && data.length > 0) || false;
    }
    return memory.resources.some((r) => r.slug === slug && r.id !== excludeId);
  },
};
