import { supabase } from '../lib/supabase';
import type { AdSlot, DirectAd } from '@thanaya/types';
import { isConfigured, memory } from './_shared';

export const adsApi = {
  // --- AD SLOTS & DIRECT ADS ---
  async getAdSlots(): Promise<AdSlot[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('ad_slots').select('*');
      if (error) throw error;
      return (data as unknown as AdSlot[]) || [];
    }
    return [...memory.adSlots];
  },

  async updateAdSlot(id: string, updates: Partial<AdSlot>): Promise<AdSlot> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('ad_slots') as any).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as AdSlot;
    }
    const index = memory.adSlots.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('AdSlot not found');
    memory.adSlots[index] = { ...memory.adSlots[index], ...updates, updated_at: new Date().toISOString() };
    return memory.adSlots[index];
  },

  async getDirectAds(): Promise<DirectAd[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('direct_ads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as DirectAd[]) || [];
    }
    return [...memory.directAds];
  },

  async createDirectAd(ad: Omit<DirectAd, 'id' | 'impressions_count' | 'clicks_count' | 'created_at' | 'updated_at'>): Promise<DirectAd> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('direct_ads') as any).insert(ad).select().single();
      if (error) throw error;
      return data as unknown as DirectAd;
    }
    const newAd: DirectAd = {
      ...ad,
      id: `ad-${Date.now()}`,
      impressions_count: 0,
      clicks_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memory.directAds.unshift(newAd);
    return newAd;
  },

  async updateDirectAd(id: string, updates: Partial<DirectAd>): Promise<DirectAd> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('direct_ads') as any).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as DirectAd;
    }
    const index = memory.directAds.findIndex((a) => a.id === id);
    if (index === -1) throw new Error('DirectAd not found');
    memory.directAds[index] = { ...memory.directAds[index], ...updates, updated_at: new Date().toISOString() };
    return memory.directAds[index];
  },

  async deleteDirectAd(id: string): Promise<void> {
    if (isConfigured) {
      const { error } = await supabase.from('direct_ads').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memory.directAds = memory.directAds.filter((a) => a.id !== id);
  },
};
