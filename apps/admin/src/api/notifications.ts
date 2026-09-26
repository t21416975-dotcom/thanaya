import { supabase } from '../lib/supabase';
import type { Notification } from '@thanaya/types';
import { isConfigured, memory } from './_shared';

export const notificationsApi = {
  // --- NOTIFICATIONS & PUSH ---
  async getNotifications(): Promise<Notification[]> {
    if (isConfigured) {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Notification[]) || [];
    }
    return [...memory.notifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async createNotification(
    notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Notification> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('notifications') as any)
        .insert(notification)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Notification;
    }
    const newNotif: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memory.notifications.unshift(newNotif);
    return newNotif;
  },

  async updateNotification(id: string, updates: Partial<Notification>): Promise<Notification> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('notifications') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Notification;
    }
    const index = memory.notifications.findIndex((n) => n.id === id);
    if (index === -1) throw new Error('Notification not found');
    memory.notifications[index] = {
      ...memory.notifications[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return memory.notifications[index];
  },

  async deleteNotification(id: string): Promise<void> {
    if (isConfigured) {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memory.notifications = memory.notifications.filter((n) => n.id !== id);
  },
};
