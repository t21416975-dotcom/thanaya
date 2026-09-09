import { supabase } from './supabase';
import type { Subject, ContentType, Week, Resource, AdSlot, DirectAd } from '@thanaya/types';

// Mock seed data for development fallback
const mockSubjects: Subject[] = [
  { id: '1', name: 'اللغة العربية', slug: 'arabic', icon: 'book-open', description: 'النحو والبلاغة والنصوص والأدب', order_index: 1, is_active: true, created_at: '', updated_at: '' },
  { id: '2', name: 'الفيزياء', slug: 'physics', icon: 'zap', description: 'الكهربية والمغناطيسية والفيزياء الحديثة', order_index: 2, is_active: true, created_at: '', updated_at: '' },
  { id: '3', name: 'الرياضيات البحتة', slug: 'pure-math', icon: 'calculator', description: 'الجبر والتفاضل والتكامل والهندسة الفراغية', order_index: 3, is_active: true, created_at: '', updated_at: '' },
  { id: '4', name: 'الكيمياء', slug: 'chemistry', icon: 'flask-conical', description: 'الكيمياء العضوية والتحليلية والكهربية', order_index: 4, is_active: true, created_at: '', updated_at: '' },
  { id: '5', name: 'الأحياء', slug: 'biology', icon: 'dna', description: 'الدعامة والهرمونات والتكاثر والبيولوجيا الجزيئية', order_index: 5, is_active: true, created_at: '', updated_at: '' },
  { id: '6', name: 'الجيولوجيا', slug: 'geology', icon: 'mountain', description: 'علوم الأرض والبيئة', order_index: 6, is_active: true, created_at: '', updated_at: '' },
  { id: '7', name: 'اللغة الإنجليزية', slug: 'english', icon: 'languages', description: 'القصة والقواعد والمفردات', order_index: 7, is_active: true, created_at: '', updated_at: '' },
  { id: '8', name: 'التاريخ', slug: 'history', icon: 'hourglass', description: 'تاريخ مصر والعالم الحديث', order_index: 8, is_active: true, created_at: '', updated_at: '' },
];

const mockContentTypes: ContentType[] = [
  { id: '1', name: 'التقييمات الأسبوعية', slug: 'weekly-assessments', description: 'التقييمات الرسمية لوزارة التربية والتعليم', order_index: 1, is_active: true, created_at: '', updated_at: '' },
  { id: '2', name: 'حلول التقييمات', slug: 'assessment-solutions', description: 'نماذج الإجابة وفيديوهات شرح خطوات الحل', order_index: 2, is_active: true, created_at: '', updated_at: '' },
  { id: '3', name: 'الامتحانات التجريبية', slug: 'mock-exams', description: 'امتحانات شاملة وتدريبية على نمط البكالوريا', order_index: 3, is_active: true, created_at: '', updated_at: '' },
  { id: '4', name: 'المذكرات والملخصات', slug: 'study-notes', description: 'مذكرات مراجعة وتلخيص لأهم القوانين والنقاط', order_index: 4, is_active: true, created_at: '', updated_at: '' },
];

const mockWeeks: Week[] = Array.from({ length: 16 }, (_, i) => ({
  id: `w-${i + 1}`,
  week_number: i + 1,
  title: `الأسبوع ${i + 1}`,
  term: 1 as const,
  created_at: '',
}));

const mockResources: Resource[] = [
  {
    id: 'res-1',
    title: 'تقييم الأسبوع الرابع في الرياضيات البحتة (الجبر)',
    slug: 'pure-math-assessment-week-4',
    subject_id: '3',
    content_type_id: '1',
    week_id: 'w-4',
    pdf_url: 'https://example.com/storage/math-week-4.pdf',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'أسئلة التقييم الوزاري الأسبوعي لمادة الجبر والهندسة الفراغية.',
    is_published: true,
    published_at: new Date().toISOString(),
    views_count: 512,
    downloads_count: 240,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subject: mockSubjects[2],
    content_type: mockContentTypes[0],
    week: mockWeeks[3],
  },
  {
    id: 'res-2',
    title: 'حل تقييم الأسبوع الرابع في الرياضيات البحتة',
    slug: 'pure-math-solution-week-4',
    subject_id: '3',
    content_type_id: '2',
    week_id: 'w-4',
    pdf_url: 'https://example.com/storage/math-solution-week-4.pdf',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'نموذج الإجابة التفصيلي لتقييم الأسبوع الرابع مع فيديو الشرح.',
    is_published: true,
    published_at: new Date().toISOString(),
    views_count: 820,
    downloads_count: 430,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subject: mockSubjects[2],
    content_type: mockContentTypes[1],
    week: mockWeeks[3],
  },
  {
    id: 'res-3',
    title: 'تقييم الأسبوع الرابع في الفيزياء (قانون كيرشوف)',
    slug: 'physics-assessment-week-4',
    subject_id: '2',
    content_type_id: '1',
    week_id: 'w-4',
    pdf_url: 'https://example.com/storage/physics-week-4.pdf',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'تقييم الوزارة للأسبوع الرابع في فيزياء الثانوية العامة.',
    is_published: true,
    published_at: new Date().toISOString(),
    views_count: 670,
    downloads_count: 310,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subject: mockSubjects[1],
    content_type: mockContentTypes[0],
    week: mockWeeks[3],
  },
  {
    id: 'res-4',
    title: 'امتحان تجريبي شامل في الكيمياء العضوية',
    slug: 'chemistry-mock-exam-organic',
    subject_id: '4',
    content_type_id: '3',
    week_id: null,
    pdf_url: 'https://example.com/storage/chemistry-exam.pdf',
    youtube_url: null,
    description: 'نموذج اختبار شامل مع سلم التقدير والتصحيح.',
    is_published: true,
    published_at: new Date().toISOString(),
    views_count: 380,
    downloads_count: 190,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subject: mockSubjects[3],
    content_type: mockContentTypes[2],
  },
];

const isLive = !!import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_URL !== 'https://your-project.supabase.co';

export const publicApi = {
  async getActiveSubjects(): Promise<Subject[]> {
    if (isLive) {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('is_active', true)
        .order('order_index');
      if (error) {
        console.error('Error fetching subjects:', error);
        return mockSubjects;
      }
      return (data as unknown as Subject[]) || mockSubjects;
    }
    return mockSubjects.filter((s) => s.is_active).sort((a, b) => a.order_index - b.order_index);
  },

  async getSubjectBySlug(slug: string): Promise<Subject | null> {
    const subjects = await this.getActiveSubjects();
    return subjects.find((s) => s.slug === slug) || null;
  },

  async getActiveContentTypes(): Promise<ContentType[]> {
    if (isLive) {
      const { data, error } = await supabase
        .from('content_types')
        .select('*')
        .eq('is_active', true)
        .order('order_index');
      if (error) {
        console.error('Error fetching content types:', error);
        return mockContentTypes;
      }
      return (data as unknown as ContentType[]) || mockContentTypes;
    }
    return mockContentTypes.filter((c) => c.is_active).sort((a, b) => a.order_index - b.order_index);
  },

  async getContentTypeBySlug(slug: string): Promise<ContentType | null> {
    const types = await this.getActiveContentTypes();
    return types.find((c) => c.slug === slug) || null;
  },

  async getWeeks(): Promise<Week[]> {
    if (isLive) {
      const { data, error } = await supabase
        .from('weeks')
        .select('*')
        .order('term')
        .order('week_number');
      if (error) {
        console.error('Error fetching weeks:', error);
        return mockWeeks;
      }
      return (data as unknown as Week[]) || mockWeeks;
    }
    return mockWeeks;
  },

  async getPublishedResources(filter?: { subjectId?: string; contentTypeId?: string; limit?: number }): Promise<Resource[]> {
    if (isLive) {
      let query = supabase
        .from('resources')
        .select('*, subject:subjects(*), content_type:content_types(*), week:weeks(*)')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (filter?.subjectId) query = query.eq('subject_id', filter.subjectId);
      if (filter?.contentTypeId) query = query.eq('content_type_id', filter.contentTypeId);
      if (filter?.limit) query = query.limit(filter.limit);

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching resources:', error);
        return mockResources;
      }
      return (data as unknown as Resource[]) || mockResources;
    }

    let list = mockResources.filter((r) => r.is_published);
    if (filter?.subjectId) list = list.filter((r) => r.subject_id === filter.subjectId);
    if (filter?.contentTypeId) list = list.filter((r) => r.content_type_id === filter.contentTypeId);
    if (filter?.limit) list = list.slice(0, filter.limit);
    return list;
  },

  async getResourceBySlug(slug: string): Promise<Resource | null> {
    if (isLive) {
      const { data, error } = await supabase
        .from('resources')
        .select('*, subject:subjects(*), content_type:content_types(*), week:weeks(*)')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();
      if (error) {
        console.error('Error fetching resource by slug:', error);
        return mockResources.find((r) => r.slug === slug) || null;
      }
      return data as unknown as Resource;
    }
    return mockResources.find((r) => r.slug === slug && r.is_published) || null;
  },

  async getAdSlot(position: string): Promise<AdSlot | null> {
    if (isLive) {
      const { data } = await supabase
        .from('ad_slots')
        .select('*')
        .eq('position', position as any)
        .eq('is_active', true)
        .single();
      return (data as unknown as AdSlot) || null;
    }
    return {
      id: `slot-${position}`,
      name: position,
      position: position as any,
      is_active: true,
      slot_type: 'google',
      created_at: '',
      updated_at: '',
    };
  },

  async getActiveDirectAdForSlot(position: string): Promise<DirectAd | null> {
    if (isLive) {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('direct_ads')
        .select('*')
        .eq('slot_position', position as any)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .order('priority', { ascending: false })
        .limit(1)
        .single();
      return (data as unknown as DirectAd) || null;
    }
    return null;
  },
};
