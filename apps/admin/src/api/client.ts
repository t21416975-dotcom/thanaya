import { supabase } from '../lib/supabase';
import type { Subject, ContentType, Week, Resource, ReportProblem, ReportStatus, AdSlot, DirectAd } from '@thanaya/types';

// Mock initial data used when Supabase is not connected in development
const initialSubjects: Subject[] = [
  { id: '1', name: 'اللغة العربية', slug: 'arabic', icon: 'book-open', description: 'منهج اللغة العربية', order_index: 1, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', name: 'الفيزياء', slug: 'physics', icon: 'zap', description: 'الكهربية والمغناطيسية والحديثة', order_index: 2, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', name: 'الرياضيات البحتة', slug: 'pure-math', icon: 'calculator', description: 'الجبر والتفاضل والتكامل', order_index: 3, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '4', name: 'الكيمياء', slug: 'chemistry', icon: 'flask-conical', description: 'العضوية والتحليلية', order_index: 4, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const initialContentTypes: ContentType[] = [
  { id: '1', name: 'التقييمات الأسبوعية', slug: 'weekly-assessments', description: 'التقييمات الرسمية', order_index: 1, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', name: 'حلول التقييمات', slug: 'assessment-solutions', description: 'إجابات التقييمات وفيديوهات الحل', order_index: 2, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', name: 'الامتحانات التجريبية', slug: 'mock-exams', description: 'نماذج امتحانات شاملة', order_index: 3, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const initialWeeks: Week[] = Array.from({ length: 16 }, (_, i) => ({
  id: `w-${i + 1}`,
  week_number: i + 1,
  title: `الأسبوع ${i + 1}`,
  term: 1 as const,
  created_at: new Date().toISOString(),
}));

const initialResources: Resource[] = [
  {
    id: 'res-1',
    title: 'تقييم الأسبوع الرابع في الرياضيات البحتة',
    slug: 'pure-math-assessment-week-4',
    subject_id: '3',
    content_type_id: '1',
    week_id: 'w-4',
    pdf_url: 'https://example.com/storage/math-week-4.pdf',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'تقييم الأسبوع الرابع للجبر والهندسة الفراغية',
    is_published: true,
    published_at: new Date().toISOString(),
    views_count: 142,
    downloads_count: 58,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const initialAdSlots: AdSlot[] = [
  { id: 'slot-1', name: 'أعلى الصفحة الرئيسية', position: 'homepage_top', is_active: true, slot_type: 'google', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'slot-2', name: 'منتصف الصفحة الرئيسية', position: 'homepage_middle', is_active: true, slot_type: 'google', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'slot-3', name: 'صفحة المادة الدراسية', position: 'subject_page', is_active: true, slot_type: 'google', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'slot-4', name: 'صفحة المورد (بعد التفاصيل)', position: 'resource_after_meta', is_active: true, slot_type: 'google', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'slot-5', name: 'أسفل الموقع (Footer)', position: 'footer', is_active: true, slot_type: 'google', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const initialDirectAds: DirectAd[] = [
  {
    id: 'ad-1',
    advertiser_name: 'أكاديمية العباقرة للثانوية',
    title: 'مراجعات نهائية مكثفة مع نخبة مدرسي مصر',
    image_url: 'https://placehold.co/728x90/16a34a/ffffff?text=Direct+Ad+Banner',
    target_url: 'https://example.com/academy',
    slot_position: 'homepage_top',
    start_date: new Date(Date.now() - 86400000).toISOString(),
    end_date: new Date(Date.now() + 30 * 86400000).toISOString(),
    is_active: true,
    priority: 1,
    impressions_count: 1250,
    clicks_count: 85,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Local state for offline / preview mode fallback
let memorySubjects = [...initialSubjects];
let memoryContentTypes = [...initialContentTypes];
let memoryWeeks = [...initialWeeks];
let memoryResources = [...initialResources];
let memoryAdSlots = [...initialAdSlots];
let memoryDirectAds = [...initialDirectAds];
let memoryReports: ReportProblem[] = [
  {
    id: 'rep-1',
    resource_id: 'res-1',
    issue_type: 'broken_link',
    details: 'رابط الحل لا يعمل بالشكل المطلوب',
    status: 'pending',
    created_at: new Date().toISOString(),
  },
];

const isConfigured = !!import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://your-project.supabase.co';

export const api = {
  isLive: isConfigured,

  // --- SUBJECTS ---
  async getSubjects(): Promise<Subject[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('subjects').select('*').order('order_index');
      if (error) throw error;
      return (data as unknown as Subject[]) || [];
    }
    return [...memorySubjects].sort((a, b) => a.order_index - b.order_index);
  },

  async createSubject(subject: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Promise<Subject> {
    if (isConfigured) {
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
    memorySubjects.push(newSubject);
    return newSubject;
  },

  async updateSubject(id: string, updates: Partial<Subject>): Promise<Subject> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('subjects') as any).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as Subject;
    }
    const index = memorySubjects.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('Subject not found');
    memorySubjects[index] = { ...memorySubjects[index], ...updates, updated_at: new Date().toISOString() };
    return memorySubjects[index];
  },

  async deleteSubject(id: string): Promise<void> {
    if (isConfigured) {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memorySubjects = memorySubjects.filter((s) => s.id !== id);
  },

  // --- CONTENT TYPES ---
  async getContentTypes(): Promise<ContentType[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('content_types').select('*').order('order_index');
      if (error) throw error;
      return (data as unknown as ContentType[]) || [];
    }
    return [...memoryContentTypes].sort((a, b) => a.order_index - b.order_index);
  },

  async createContentType(contentType: Omit<ContentType, 'id' | 'created_at' | 'updated_at'>): Promise<ContentType> {
    if (isConfigured) {
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
    memoryContentTypes.push(newType);
    return newType;
  },

  async updateContentType(id: string, updates: Partial<ContentType>): Promise<ContentType> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('content_types') as any).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as ContentType;
    }
    const index = memoryContentTypes.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('ContentType not found');
    memoryContentTypes[index] = { ...memoryContentTypes[index], ...updates, updated_at: new Date().toISOString() };
    return memoryContentTypes[index];
  },

  async deleteContentType(id: string): Promise<void> {
    if (isConfigured) {
      const { error } = await supabase.from('content_types').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memoryContentTypes = memoryContentTypes.filter((c) => c.id !== id);
  },

  // --- WEEKS ---
  async getWeeks(): Promise<Week[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('weeks').select('*').order('term').order('week_number');
      if (error) throw error;
      return (data as unknown as Week[]) || [];
    }
    return [...memoryWeeks].sort((a, b) => a.term - b.term || a.week_number - b.week_number);
  },

  async createWeek(week: Omit<Week, 'id' | 'created_at'>): Promise<Week> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('weeks') as any).insert(week).select().single();
      if (error) throw error;
      return data as unknown as Week;
    }
    const newWeek: Week = {
      ...week,
      id: `w-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    memoryWeeks.push(newWeek);
    return newWeek;
  },

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
    return memoryResources.map((res) => ({
      ...res,
      subject: memorySubjects.find((s) => s.id === res.subject_id),
      content_type: memoryContentTypes.find((c) => c.id === res.content_type_id),
      week: memoryWeeks.find((w) => w.id === res.week_id),
    }));
  },

  async createResource(resource: Omit<Resource, 'id' | 'views_count' | 'downloads_count' | 'created_at' | 'updated_at' | 'subject' | 'content_type' | 'week'>): Promise<Resource> {
    if (isConfigured) {
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
    memoryResources.unshift(newResource);
    return newResource;
  },

  async updateResource(id: string, updates: Partial<Resource>): Promise<Resource> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('resources') as any).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as Resource;
    }
    const index = memoryResources.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Resource not found');
    memoryResources[index] = { ...memoryResources[index], ...updates, updated_at: new Date().toISOString() };
    return memoryResources[index];
  },

  async deleteResource(id: string): Promise<void> {
    if (isConfigured) {
      const { error } = await supabase.from('resources').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memoryResources = memoryResources.filter((r) => r.id !== id);
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
    return memoryResources.some((r) => r.slug === slug && r.id !== excludeId);
  },

  // --- REPORTS ---
  async getReports(): Promise<ReportProblem[]> {
    if (isConfigured) {
      const { data, error } = await supabase
        .from('reports')
        .select('*, resource:resources(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as ReportProblem[]) || [];
    }
    return memoryReports.map((rep) => ({
      ...rep,
      resource: memoryResources.find((r) => r.id === rep.resource_id),
    }));
  },

  async updateReportStatus(id: string, status: ReportStatus): Promise<void> {
    if (isConfigured) {
      const { error } = await (supabase.from('reports') as any)
        .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
      return;
    }
    const report = memoryReports.find((r) => r.id === id);
    if (report) {
      report.status = status;
      report.resolved_at = status === 'resolved' ? new Date().toISOString() : null;
    }
  },

  // --- AD SLOTS & DIRECT ADS ---
  async getAdSlots(): Promise<AdSlot[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('ad_slots').select('*');
      if (error) throw error;
      return (data as unknown as AdSlot[]) || [];
    }
    return [...memoryAdSlots];
  },

  async updateAdSlot(id: string, updates: Partial<AdSlot>): Promise<AdSlot> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('ad_slots') as any).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as AdSlot;
    }
    const index = memoryAdSlots.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('AdSlot not found');
    memoryAdSlots[index] = { ...memoryAdSlots[index], ...updates, updated_at: new Date().toISOString() };
    return memoryAdSlots[index];
  },

  async getDirectAds(): Promise<DirectAd[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('direct_ads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as DirectAd[]) || [];
    }
    return [...memoryDirectAds];
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
    memoryDirectAds.unshift(newAd);
    return newAd;
  },

  async updateDirectAd(id: string, updates: Partial<DirectAd>): Promise<DirectAd> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('direct_ads') as any).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as unknown as DirectAd;
    }
    const index = memoryDirectAds.findIndex((a) => a.id === id);
    if (index === -1) throw new Error('DirectAd not found');
    memoryDirectAds[index] = { ...memoryDirectAds[index], ...updates, updated_at: new Date().toISOString() };
    return memoryDirectAds[index];
  },

  async deleteDirectAd(id: string): Promise<void> {
    if (isConfigured) {
      const { error } = await supabase.from('direct_ads').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memoryDirectAds = memoryDirectAds.filter((a) => a.id !== id);
  },
};
