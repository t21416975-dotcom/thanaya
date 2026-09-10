import { supabase } from '../lib/supabase';
import type { Subject, ContentType, Week, Resource, ReportProblem, ReportStatus, AdSlot, DirectAd, Exam, ExamQuestion, SystemSetting, ExamWithQuestions } from '@thanaya/types';

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

const initialExams: Exam[] = [
  {
    id: 'exam-1',
    title: 'امتحان تجريبي شامل في الفيزياء - الفصل الأول (التيار الكهربي وقانون كيرشوف)',
    subject_id: '2',
    time_limit_minutes: 30,
    is_published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const initialExamQuestions: ExamQuestion[] = [
  {
    id: 'q-1',
    exam_id: 'exam-1',
    question_number: 1,
    question_text: 'في الدائرة الكهربية الموضحة، إذا كانت قراءة الفولتميتر 12 فولت والمقاومة الداخلية للمصدر مهملة، فإن شدة التيار المار في المقاومة R تساوي:',
    options: ['2 أمبير', '4 أمبير', '6 أمبير', '8 أمبير'],
    correct_option_index: 0,
    explanation: 'بتطبيق قانون أوم للدوائر المغلقة: I = V / R = 12 / 6 = 2 A. المقاومة الكلية للفرع تساوي 6 أوم وفرق الجهد 12V.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'q-2',
    exam_id: 'exam-1',
    question_number: 2,
    question_text: 'أي من المواد التالية تقل مقاومتها النوعية بزيادة درجة الحرارة؟',
    options: ['أشباه الموصلات (مثل السيليكون)', 'الموصلات الفلزية (مثل النحاس)', 'الألومنيوم', 'الحديد'],
    correct_option_index: 0,
    explanation: 'في أشباه الموصلات، يؤدي رفع درجة الحرارة إلى كسر بعض الروابط التساهمية وتحرير إلكترونات وفجوات، مما يزيد التوصيلية ويقلل المقاومة النوعية.',
    created_at: new Date().toISOString(),
  },
];

const initialSystemSettings: SystemSetting[] = [
  {
    key: 'gemini_model_name',
    value: 'gemini-2.5-flash',
    description: 'اسم موديل Google Gemini المعتمد لاستخراج الأسئلة من ملفات الـ PDF',
    updated_at: new Date().toISOString(),
  },
  {
    key: 'gemini_exam_prompt',
    value: `أنت خبير تربوي ومعلم أول في وزارة التربية والتعليم للثانوية العامة والبكالوريا المصرية. مهمتك هي إنشاء واستخراج أسئلة الاختيار من متعدد (MCQs) التفاعلية من ملف الـ PDF المرفق بدقة علمية وتربوية عالية، مع توليد إجابات دقيقة وشرح وتفسير نموذجي شامل لكل سؤال.\n\nالقواعد والضوابط الصارمة:\n1. الالتزام التام بالمنهج ومنع الخروج عنه: استخرج واعتمد حصراً على المفاهيم والقوانين والدروس الواردة في ملف الـ PDF المرفوع. يُمنع منعاً باتاً إدخال أسئلة أو مواضيع من مناهج أخرى أو معلومات خارجية خارج حدود هذا الملف.\n2. مستوى الأسئلة وجودتها: صغ أسئلة تقيس الفهم والتطبيق والتحليل الشامل للطلاب بناءً على محتوى الملف؛ ابتعد عن البصمجية والنقل الحرفي السطحي، وفي نفس الوقت لا تخرج عن نطاق المادة.\n3. التوزيع العشوائي لموقع الإجابة الصحيحة: قم بتوزيع موقع الإجابة الصحيحة (correct_option_index) بشكل عشوائي ومتوازن بين الخيارات الأربعة (0, 1, 2, 3)، ويُمنع منعاً باتاً جعل الإجابة الصحيحة دائماً في الخيار الأول (0).\n4. الخيارات الأربعة: لكل سؤال، وفر 4 خيارات واضحة ومتمايزة ومكتوبة بدقة.\n5. التفسير والشرح النموذجي: اكتب في حقل explanation شرحاً علمياً تفصيلياً مقنعاً وواضحاً يوضح للطالب خطوات الحل الرياضي أو التعليل العلمي والقاعدة المتبعة وسبب صحة الخيار المختار.\n6. الإخراج الإجباري: يجب أن تكون النتيجة حصراً بصيغة JSON المحددة.`,
    description: 'الـ System Prompt الافتراضي الموجه لـ Gemini لاستخراج وتفسير أسئلة الـ MCQs',
    updated_at: new Date().toISOString(),
  },
];

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
let memoryExams: Exam[] = [...initialExams];
let memoryExamQuestions: ExamQuestion[] = [...initialExamQuestions];
let memorySystemSettings: SystemSetting[] = [...initialSystemSettings];

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

  async updateWeek(id: string, week: Partial<Omit<Week, 'id' | 'created_at'>>): Promise<Week> {
    if (isConfigured) {
      const { data, error } = await (supabase.from('weeks') as any)
        .update(week)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Week;
    }
    const idx = memoryWeeks.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error('Week not found');
    memoryWeeks[idx] = { ...memoryWeeks[idx], ...week };
    return memoryWeeks[idx];
  },

  async deleteWeek(id: string): Promise<void> {
    if (isConfigured) {
      const { error } = await supabase.from('weeks').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memoryWeeks = memoryWeeks.filter((w) => w.id !== id);
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

  // --- EXAMS ---
  async getExams(): Promise<Exam[]> {
    if (isConfigured) {
      const { data, error } = await supabase
        .from('exams')
        .select('*, subject:subjects(*), questions:exam_questions(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Exam[]) || [];
    }
    return memoryExams.map((exam) => ({
      ...exam,
      subject: memorySubjects.find((s) => s.id === exam.subject_id),
      questions: memoryExamQuestions
        .filter((q) => q.exam_id === exam.id)
        .sort((a, b) => a.question_number - b.question_number),
    }));
  },

  async getExamById(id: string): Promise<ExamWithQuestions | null> {
    if (isConfigured) {
      const { data, error } = await supabase
        .from('exams')
        .select('*, subject:subjects(*), questions:exam_questions(*)')
        .eq('id', id)
        .single();
      if (error) return null;
      const exam = data as unknown as Exam;
      const questions = ((data as any).questions as ExamQuestion[]) || [];
      questions.sort((a, b) => a.question_number - b.question_number);
      return { ...exam, questions };
    }
    const exam = memoryExams.find((e) => e.id === id);
    if (!exam) return null;
    const questions = memoryExamQuestions
      .filter((q) => q.exam_id === id)
      .sort((a, b) => a.question_number - b.question_number);
    return {
      ...exam,
      subject: memorySubjects.find((s) => s.id === exam.subject_id),
      questions,
    };
  },

  async createExam(
    examData: Omit<Exam, 'id' | 'created_at' | 'updated_at' | 'subject' | 'questions'>,
    questionsData: Omit<ExamQuestion, 'id' | 'exam_id' | 'created_at'>[]
  ): Promise<ExamWithQuestions> {
    if (isConfigured) {
      const { data: newExam, error: examError } = await (supabase.from('exams') as any)
        .insert({
          title: examData.title,
          subject_id: examData.subject_id,
          time_limit_minutes: examData.time_limit_minutes,
          is_published: examData.is_published,
        })
        .select('*, subject:subjects(*)')
        .single();
      if (examError) throw examError;

      const questionsToInsert = questionsData.map((q, idx) => ({
        exam_id: newExam.id,
        question_number: q.question_number || idx + 1,
        question_text: q.question_text,
        options: q.options,
        correct_option_index: q.correct_option_index,
        explanation: q.explanation || '',
      }));

      const { data: insertedQuestions, error: qError } = await (supabase.from('exam_questions') as any)
        .insert(questionsToInsert)
        .select();
      if (qError) throw qError;

      return {
        ...(newExam as unknown as Exam),
        questions: (insertedQuestions as unknown as ExamQuestion[]) || [],
      };
    }

    const examId = `exam-${Date.now()}`;
    const newExam: Exam = {
      id: examId,
      title: examData.title,
      subject_id: examData.subject_id,
      time_limit_minutes: examData.time_limit_minutes,
      is_published: examData.is_published,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subject: memorySubjects.find((s) => s.id === examData.subject_id),
    };

    const newQuestions: ExamQuestion[] = questionsData.map((q, idx) => ({
      id: `q-${Date.now()}-${idx + 1}`,
      exam_id: examId,
      question_number: q.question_number || idx + 1,
      question_text: q.question_text,
      options: q.options,
      correct_option_index: q.correct_option_index,
      explanation: q.explanation || '',
      created_at: new Date().toISOString(),
    }));

    memoryExams.unshift(newExam);
    memoryExamQuestions.push(...newQuestions);

    return {
      ...newExam,
      questions: newQuestions,
    };
  },

  async updateExam(
    id: string,
    examUpdates: Partial<Omit<Exam, 'id' | 'created_at' | 'updated_at' | 'subject' | 'questions'>>,
    questionsData?: Omit<ExamQuestion, 'id' | 'exam_id' | 'created_at'>[]
  ): Promise<ExamWithQuestions> {
    if (isConfigured) {
      const { data: updatedExam, error: examError } = await (supabase.from('exams') as any)
        .update(examUpdates)
        .eq('id', id)
        .select('*, subject:subjects(*)')
        .single();
      if (examError) throw examError;

      let currentQuestions: ExamQuestion[] = [];
      if (questionsData) {
        // Delete old questions and re-insert new
        await supabase.from('exam_questions').delete().eq('exam_id', id);
        const questionsToInsert = questionsData.map((q, idx) => ({
          exam_id: id,
          question_number: q.question_number || idx + 1,
          question_text: q.question_text,
          options: q.options,
          correct_option_index: q.correct_option_index,
          explanation: q.explanation || '',
        }));
        const { data: insQ, error: insErr } = await (supabase.from('exam_questions') as any)
          .insert(questionsToInsert)
          .select();
        if (insErr) throw insErr;
        currentQuestions = (insQ as unknown as ExamQuestion[]) || [];
      } else {
        const { data: existingQ } = await supabase.from('exam_questions').select('*').eq('exam_id', id);
        currentQuestions = (existingQ as unknown as ExamQuestion[]) || [];
      }

      currentQuestions.sort((a, b) => a.question_number - b.question_number);
      return {
        ...(updatedExam as unknown as Exam),
        questions: currentQuestions,
      };
    }

    const examIdx = memoryExams.findIndex((e) => e.id === id);
    if (examIdx === -1) throw new Error('Exam not found');

    memoryExams[examIdx] = {
      ...memoryExams[examIdx],
      ...examUpdates,
      updated_at: new Date().toISOString(),
      subject: examUpdates.subject_id
        ? memorySubjects.find((s) => s.id === examUpdates.subject_id)
        : memoryExams[examIdx].subject,
    };

    if (questionsData) {
      memoryExamQuestions = memoryExamQuestions.filter((q) => q.exam_id !== id);
      const newQ: ExamQuestion[] = questionsData.map((q, idx) => ({
        id: `q-${Date.now()}-${idx + 1}`,
        exam_id: id,
        question_number: q.question_number || idx + 1,
        question_text: q.question_text,
        options: q.options,
        correct_option_index: q.correct_option_index,
        explanation: q.explanation || '',
        created_at: new Date().toISOString(),
      }));
      memoryExamQuestions.push(...newQ);
    }

    const questions = memoryExamQuestions
      .filter((q) => q.exam_id === id)
      .sort((a, b) => a.question_number - b.question_number);

    return {
      ...memoryExams[examIdx],
      questions,
    };
  },

  async deleteExam(id: string): Promise<void> {
    if (isConfigured) {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memoryExams = memoryExams.filter((e) => e.id !== id);
    memoryExamQuestions = memoryExamQuestions.filter((q) => q.exam_id !== id);
  },

  // --- SYSTEM SETTINGS (AI) ---
  async getSystemSettings(): Promise<SystemSetting[]> {
    if (isConfigured) {
      const { data, error } = await supabase.from('system_settings').select('*');
      if (error) throw error;
      return (data as unknown as SystemSetting[]) || [];
    }
    return [...memorySystemSettings];
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
    const idx = memorySystemSettings.findIndex((s) => s.key === key);
    const updated: SystemSetting = {
      key,
      value,
      description: description !== undefined ? description : (idx !== -1 ? memorySystemSettings[idx].description : null),
      updated_at: new Date().toISOString(),
    };
    if (idx !== -1) {
      memorySystemSettings[idx] = updated;
    } else {
      memorySystemSettings.push(updated);
    }
    return updated;
  },
};
