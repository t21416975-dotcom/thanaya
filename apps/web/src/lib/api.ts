import { supabase, isSupabaseConfigured } from './supabase';
import { smartCache } from './cache';
import type { Subject, ContentType, Week, Resource, AdSlot, DirectAd, Exam, ExamQuestion, ExamWithQuestions } from '@thanaya/types';

// Mock seed data for development fallback when Supabase is not connected
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

const mockExams: ExamWithQuestions[] = [
  {
    id: 'exam-1',
    title: 'امتحان تجريبي شامل في الفيزياء - التيار الكهربي وقوانين كيرشوف',
    subject_id: '2',
    time_limit_minutes: 30,
    is_published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subject: mockSubjects[1],
    questions: [
      {
        id: 'q-1',
        exam_id: 'exam-1',
        question_number: 1,
        question_text: 'في الدائرة الكهربية الموضحة، إذا كانت قراءة الفولتميتر 12 فولت والمقاومة الداخلية للمصدر مهملة، والمقاومة الخارجية 6 أوم، فإن شدة التيار المار تساوي:',
        options: ['2 أمبير', '4 أمبير', '6 أمبير', '8 أمبير'],
        correct_option_index: 0,
        explanation: 'بتطبيق قانون أوم: I = V / R = 12 / 6 = 2 A. فرق الجهد عبر المقاومة مقسوماً على قيمتها يعطي شدة التيار مباشرة.',
        created_at: new Date().toISOString(),
      },
      {
        id: 'q-2',
        exam_id: 'exam-1',
        question_number: 2,
        question_text: 'أي من المواد التالية تقل مقاومتها النوعية وتزداد توصيليتها الكهربية عند رفع درجة حرارتها؟',
        options: ['أشباه الموصلات (مثل السيليكون والجرمانيوم)', 'الموصلات الفلزية (مثل النحاس)', 'الألومنيوم', 'الفضة'],
        correct_option_index: 0,
        explanation: 'في أشباه الموصلات، تعمل الطاقة الحرارية على كسر بعض الروابط التساهمية، مما يحرر إلكترونات حرة وفجوات تساهم في التوصيل الكهربي.',
        created_at: new Date().toISOString(),
      },
      {
        id: 'q-3',
        exam_id: 'exam-1',
        question_number: 3,
        question_text: 'قانون كيرشوف الأول (قانون حفظ الشحنة) ينص على أن المجموع الجبري للتيارات الكهربية عند أي نقطة تفرع في دائرة مغلقة يساوي:',
        options: ['صفراً', 'القوة الدافعة الكهربية للبطارية', 'مجموع فروق الجهد', 'اللانهاية'],
        correct_option_index: 0,
        explanation: 'قانون كيرشوف الأول (KCL): Σ I_in = Σ I_out أي أن المجموع الجبري للتيارات الداخلة والخارجة عند أي نقطة تفرع يساوي صفراً (Σ I = 0).',
        created_at: new Date().toISOString(),
      },
    ],
  },
];

export const publicApi = {
  /**
   * Get all active subjects (Cached for 60s)
   */
  async getActiveSubjects(): Promise<Subject[]> {
    return smartCache.wrap('subjects:active', 60, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('subjects')
            .select('*')
            .eq('is_active', true)
            .order('order_index');
          if (error) {
            console.error('Error fetching subjects from Supabase:', error);
            return mockSubjects.filter((s) => s.is_active);
          }
          return (data as unknown as Subject[]) || [];
        } catch (err) {
          console.error('Supabase exception in getActiveSubjects:', err);
          return mockSubjects.filter((s) => s.is_active);
        }
      }
      return mockSubjects.filter((s) => s.is_active).sort((a, b) => a.order_index - b.order_index);
    }, mockSubjects.filter((s) => s.is_active));
  },

  /**
   * Get single subject by slug (Cached for 60s)
   */
  async getSubjectBySlug(slug: string): Promise<Subject | null> {
    if (!slug) return null;
    return smartCache.wrap(`subject:${slug}`, 60, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('subjects')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .single();
          if (error) {
            return null;
          }
          return data as unknown as Subject;
        } catch (err) {
          console.error(`Supabase exception in getSubjectBySlug (${slug}):`, err);
          return mockSubjects.find((s) => s.slug === slug && s.is_active) || null;
        }
      }
      return mockSubjects.find((s) => s.slug === slug && s.is_active) || null;
    }, null);
  },

  /**
   * Get all active content types (Cached for 60s)
   */
  async getActiveContentTypes(): Promise<ContentType[]> {
    return smartCache.wrap('content_types:active', 60, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('content_types')
            .select('*')
            .eq('is_active', true)
            .order('order_index');
          if (error) {
            console.error('Error fetching content types:', error);
            return mockContentTypes.filter((c) => c.is_active);
          }
          return (data as unknown as ContentType[]) || [];
        } catch (err) {
          console.error('Supabase exception in getActiveContentTypes:', err);
          return mockContentTypes.filter((c) => c.is_active);
        }
      }
      return mockContentTypes.filter((c) => c.is_active).sort((a, b) => a.order_index - b.order_index);
    }, mockContentTypes.filter((c) => c.is_active));
  },

  /**
   * Get single content type by slug (Cached for 60s)
   */
  async getContentTypeBySlug(slug: string): Promise<ContentType | null> {
    if (!slug) return null;
    return smartCache.wrap(`content_type:${slug}`, 60, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('content_types')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .single();
          if (error) {
            return null;
          }
          return data as unknown as ContentType;
        } catch (err) {
          console.error(`Supabase exception in getContentTypeBySlug (${slug}):`, err);
          return mockContentTypes.find((c) => c.slug === slug && c.is_active) || null;
        }
      }
      return mockContentTypes.find((c) => c.slug === slug && c.is_active) || null;
    }, null);
  },

  /**
   * Get weeks (Cached for 120s)
   */
  async getWeeks(): Promise<Week[]> {
    return smartCache.wrap('weeks:all', 120, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('weeks')
            .select('*')
            .order('term')
            .order('week_number');
          if (error) {
            console.error('Error fetching weeks:', error);
            return mockWeeks;
          }
          return (data as unknown as Week[]) || [];
        } catch (err) {
          console.error('Supabase exception in getWeeks:', err);
          return mockWeeks;
        }
      }
      return mockWeeks;
    }, mockWeeks);
  },

  /**
   * Get published resources with optional filtering (Cached for 30s)
   */
  async getPublishedResources(filter?: { subjectId?: string; contentTypeId?: string; limit?: number }): Promise<Resource[]> {
    const cacheKey = `resources:${filter?.subjectId || 'all'}:${filter?.contentTypeId || 'all'}:${filter?.limit || 'all'}`;
    return smartCache.wrap(cacheKey, 30, async () => {
      if (isSupabaseConfigured) {
        try {
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
            return [];
          }
          return (data as unknown as Resource[]) || [];
        } catch (err) {
          console.error('Supabase exception in getPublishedResources:', err);
          return [];
        }
      }

      let list = mockResources.filter((r) => r.is_published);
      if (filter?.subjectId) list = list.filter((r) => r.subject_id === filter.subjectId);
      if (filter?.contentTypeId) list = list.filter((r) => r.content_type_id === filter.contentTypeId);
      if (filter?.limit) list = list.slice(0, filter.limit);
      return list;
    }, []);
  },

  /**
   * Get single published resource by slug (Cached for 30s)
   */
  async getResourceBySlug(slug: string): Promise<Resource | null> {
    if (!slug) return null;
    return smartCache.wrap(`resource:${slug}`, 30, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('resources')
            .select('*, subject:subjects(*), content_type:content_types(*), week:weeks(*)')
            .eq('slug', slug)
            .eq('is_published', true)
            .single();
          if (error) {
            return null;
          }
          return data as unknown as Resource;
        } catch (err) {
          console.error(`Supabase exception in getResourceBySlug (${slug}):`, err);
          return mockResources.find((r) => r.slug === slug && r.is_published) || null;
        }
      }
      return mockResources.find((r) => r.slug === slug && r.is_published) || null;
    }, null);
  },

  /**
   * Get ad slot config (Cached for 60s)
   */
  async getAdSlot(position: string): Promise<AdSlot | null> {
    if (!position) return null;
    return smartCache.wrap(`ad_slot:${position}`, 60, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase
            .from('ad_slots')
            .select('*')
            .eq('position', position as any)
            .eq('is_active', true)
            .single();
          return (data as unknown as AdSlot) || null;
        } catch (err) {
          console.error(`Supabase exception in getAdSlot (${position}):`, err);
          return null;
        }
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
    }, null);
  },

  /**
   * Get direct ad for slot (Cached for 60s)
   */
  async getActiveDirectAdForSlot(position: string): Promise<DirectAd | null> {
    if (!position) return null;
    return smartCache.wrap(`direct_ad:${position}`, 60, async () => {
      if (isSupabaseConfigured) {
        try {
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
        } catch (err) {
          console.error(`Supabase exception in getActiveDirectAdForSlot (${position}):`, err);
          return null;
        }
      }
      return null;
    }, null);
  },

  /**
   * Get all published exams with optional subject filter (Cached for 30s)
   */
  async getPublishedExams(subjectId?: string): Promise<ExamWithQuestions[]> {
    const cacheKey = `exams:published:${subjectId || 'all'}`;
    return smartCache.wrap(cacheKey, 30, async () => {
      if (isSupabaseConfigured) {
        try {
          let query = supabase
            .from('exams')
            .select('*, subject:subjects(*), questions:exam_questions(*)')
            .eq('is_published', true)
            .order('created_at', { ascending: false });

          if (subjectId) query = query.eq('subject_id', subjectId);

          const { data, error } = await query;
          if (error) {
            console.error('Error fetching exams:', error);
            return mockExams.filter((e) => !subjectId || e.subject_id === subjectId);
          }
          return (data as unknown as ExamWithQuestions[]) || [];
        } catch (err) {
          console.error('Supabase exception in getPublishedExams:', err);
          return mockExams.filter((e) => !subjectId || e.subject_id === subjectId);
        }
      }
      return mockExams.filter((e) => e.is_published && (!subjectId || e.subject_id === subjectId));
    }, mockExams);
  },

  /**
   * Get single exam by ID with full questions (Cached for 30s)
   */
  async getExamById(id: string): Promise<ExamWithQuestions | null> {
    if (!id) return null;
    return smartCache.wrap(`exam:${id}`, 30, async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('exams')
            .select('*, subject:subjects(*), questions:exam_questions(*)')
            .eq('id', id)
            .eq('is_published', true)
            .single();

          if (error) return null;
          const exam = data as unknown as Exam;
          const questions = ((data as any).questions as ExamQuestion[]) || [];
          questions.sort((a, b) => a.question_number - b.question_number);
          return { ...exam, questions };
        } catch (err) {
          console.error(`Supabase exception in getExamById (${id}):`, err);
          return mockExams.find((e) => e.id === id) || null;
        }
      }
      return mockExams.find((e) => e.id === id) || null;
    }, null);
  },

  /**
   * Manual cache purge helper
   */
  clearCache(): void {
    smartCache.invalidate();
  }
};
