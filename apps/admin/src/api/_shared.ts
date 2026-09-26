import { supabase } from '../lib/supabase';
import { notifyApprovalQueued } from '../lib/approval';
import type {
  Subject, ContentType, Week, Resource, ReportProblem, AdSlot, DirectAd, Exam, ExamQuestion, SystemSetting, Notification,
  ChangeRequestEntity, ChangeRequestAction,
  AdminStudentRow, AdminAttemptRow,
} from '@thanaya/types';

// Mock initial data used when Supabase is not connected in development
export const initialSubjects: Subject[] = [
  { id: '1', name: 'اللغة العربية', slug: 'arabic', icon: 'book-open', description: 'منهج اللغة العربية', order_index: 1, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', name: 'الفيزياء', slug: 'physics', icon: 'zap', description: 'الكهربية والمغناطيسية والحديثة', order_index: 2, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', name: 'الرياضيات البحتة', slug: 'pure-math', icon: 'calculator', description: 'الجبر والتفاضل والتكامل', order_index: 3, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '4', name: 'الكيمياء', slug: 'chemistry', icon: 'flask-conical', description: 'العضوية والتحليلية', order_index: 4, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const initialContentTypes: ContentType[] = [
  { id: '1', name: 'التقييمات الأسبوعية', slug: 'weekly-assessments', description: 'التقييمات الرسمية', order_index: 1, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', name: 'حلول التقييمات', slug: 'assessment-solutions', description: 'إجابات التقييمات وفيديوهات الحل', order_index: 2, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', name: 'الامتحانات التجريبية', slug: 'mock-exams', description: 'نماذج امتحانات شاملة', order_index: 3, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const initialWeeks: Week[] = Array.from({ length: 16 }, (_, i) => ({
  id: `w-${i + 1}`,
  week_number: i + 1,
  title: `الأسبوع ${i + 1}`,
  term: 1 as const,
  created_at: new Date().toISOString(),
}));

export const initialExams: Exam[] = [
  {
    id: 'exam-1',
    title: 'امتحان تجريبي شامل في الفيزياء - الفصل الأول (التيار الكهربي وقانون كيرشوف)',
    subject_id: '2',
    time_limit_minutes: 30,
    is_published: true,
    is_coming_soon: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const initialExamQuestions: ExamQuestion[] = [
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

export const initialSystemSettings: SystemSetting[] = [
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

export const initialResources: Resource[] = [
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
    is_coming_soon: false,
    published_at: new Date().toISOString(),
    views_count: 142,
    downloads_count: 58,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const initialAdSlots: AdSlot[] = [
  { id: 'slot-1', name: 'أعلى الصفحة الرئيسية', position: 'homepage_top', is_active: true, slot_type: 'google', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'slot-2', name: 'منتصف الصفحة الرئيسية', position: 'homepage_middle', is_active: true, slot_type: 'google', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'slot-3', name: 'صفحة المادة الدراسية', position: 'subject_page', is_active: true, slot_type: 'google', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'slot-4', name: 'صفحة المورد (بعد التفاصيل)', position: 'resource_after_meta', is_active: true, slot_type: 'google', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'slot-5', name: 'أسفل الموقع (Footer)', position: 'footer', is_active: true, slot_type: 'google', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const initialDirectAds: DirectAd[] = [
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

export const initialNotifications: Notification[] = [
  {
    id: 'notif-1',
    title: 'تحديث أسبوعي جديد',
    message: 'تم إضافة تقييمات وحلول الأسبوع الرابع لجميع المواد الدراسية.',
    link_url: '/',
    type: 'bell',
    priority: 'normal',
    is_active: true,
    expires_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];


// ── بيانات معاينة للطلبة (وضع عدم الاتصال فقط) ────────────────────────────
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export const initialStudents: AdminStudentRow[] = [
  {
    id: 'stu-1',
    email: 'sara@student.test',
    full_name: 'سارة أحمد',
    avatar_url: null,
    grade: 'third',
    provider: 'google',
    email_verified: true,
    is_active: true,
    attempts: 4,
    questions: 24,
    correct: 17,
    wrong: 7,
    accuracy: 70.8,
    wrong_questions: 5,
    created_at: daysAgo(40),
    last_seen_at: daysAgo(1),
  },
  {
    id: 'stu-2',
    email: 'omar@student.test',
    full_name: 'عمر علي',
    avatar_url: null,
    grade: 'third',
    provider: 'email',
    email_verified: false,
    is_active: true,
    attempts: 2,
    questions: 12,
    correct: 5,
    wrong: 7,
    accuracy: 41.7,
    wrong_questions: 6,
    created_at: daysAgo(21),
    last_seen_at: daysAgo(3),
  },
  {
    id: 'stu-3',
    email: 'nour@student.test',
    full_name: 'نور حسن',
    avatar_url: null,
    grade: 'second',
    provider: 'google',
    email_verified: true,
    is_active: false,
    attempts: 1,
    questions: 6,
    correct: 1,
    wrong: 5,
    accuracy: 16.7,
    wrong_questions: 5,
    created_at: daysAgo(60),
    last_seen_at: daysAgo(45),
  },
];

export const initialAttempts: AdminAttemptRow[] = [
  {
    id: 'att-1',
    student_id: 'stu-1',
    student_name: 'سارة أحمد',
    student_email: 'sara@student.test',
    subject_name: 'الفيزياء',
    exam_title: 'امتحان الفيزياء الموحّد',
    mode: 'exam',
    status: 'submitted',
    score_percentage: 75,
    correct_count: 3,
    wrong_count: 1,
    blank_count: 0,
    total_questions: 4,
    time_spent_seconds: 620,
    flagged_suspicious: false,
    flag_reason: null,
    started_at: daysAgo(1),
    submitted_at: daysAgo(1),
  },
  {
    id: 'att-2',
    student_id: 'stu-1',
    student_name: 'سارة أحمد',
    student_email: 'sara@student.test',
    subject_name: 'الفيزياء',
    exam_title: null,
    mode: 'review',
    status: 'submitted',
    score_percentage: 50,
    correct_count: 2,
    wrong_count: 2,
    blank_count: 0,
    total_questions: 4,
    time_spent_seconds: 300,
    flagged_suspicious: false,
    flag_reason: null,
    started_at: daysAgo(1),
    submitted_at: daysAgo(1),
  },
  {
    id: 'att-3',
    student_id: 'stu-2',
    student_name: 'عمر علي',
    student_email: 'omar@student.test',
    subject_name: 'الكيمياء',
    exam_title: 'امتحان الكيمياء',
    mode: 'exam',
    status: 'submitted',
    score_percentage: 25,
    correct_count: 1,
    wrong_count: 3,
    blank_count: 0,
    total_questions: 4,
    time_spent_seconds: 480,
    flagged_suspicious: true,
    flag_reason: 'وقت إجابة أقل من المتوسط بشكل غير معتاد',
    started_at: daysAgo(3),
    submitted_at: daysAgo(3),
  },
];

// Local state for offline / preview mode fallback
// مخزن واحد كائن حتى تتمكن ملفات الكيانات من إعادة إسناد المصفوفات
// (مثل memory.resources = memory.resources.filter(...)) بنفس سلوك الملف الواحد.
export const memory = {
  subjects: [...initialSubjects] as Subject[],
  contentTypes: [...initialContentTypes] as ContentType[],
  weeks: [...initialWeeks] as Week[],
  resources: [...initialResources] as Resource[],
  adSlots: [...initialAdSlots] as AdSlot[],
  directAds: [...initialDirectAds] as DirectAd[],
  reports: [
    {
      id: 'rep-1',
      resource_id: 'res-1',
      issue_type: 'broken_link',
      details: 'رابط الحل لا يعمل بالشكل المطلوب',
      status: 'pending' as const,
      created_at: new Date().toISOString(),
    },
  ] as ReportProblem[],
  exams: [...initialExams] as Exam[],
  examQuestions: [...initialExamQuestions] as ExamQuestion[],
  systemSettings: [...initialSystemSettings] as SystemSetting[],
  notifications: [...initialNotifications] as Notification[],
  students: [...initialStudents] as AdminStudentRow[],
  attempts: [...initialAttempts] as AdminAttemptRow[],
};

export const isConfigured = !!import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://your-project.supabase.co';

// ====== سير اعتماد التعديلات: مساعدات التحويل إلى طابور الموافقات ======
// أي كتابة على المحتوى من موظف (ليس super_admin) تتحول تلقائيًا إلى طلب تغيير
// معلّق؛ الإنفاذ الفعلي في RLS + RPC، وهذه الطبقة للتحويل الشفاف في الواجهة.

export async function submitChange(input: {
  entity: ChangeRequestEntity;
  entityId: string | null;
  action: ChangeRequestAction;
  payload: Record<string, any>;
}): Promise<string> {
  const { data, error } = await supabase.rpc('submit_change_request' as any, {
    p_entity: input.entity,
    p_entity_id: input.entityId,
    p_action: input.action,
    p_payload: input.payload,
  } as any);
  if (error) throw error;
  notifyApprovalQueued(input.entity, input.action);
  return data as string;
}

export function examPayloadFrom(exam: Exam, questions: ExamQuestion[]): Record<string, any> {
  return {
    id: exam.id,
    title: exam.title,
    subject_id: exam.subject_id,
    time_limit_minutes: exam.time_limit_minutes,
    is_published: exam.is_published,
    is_coming_soon: exam.is_coming_soon,
    coming_soon_message: exam.coming_soon_message ?? null,
    questions: questions.map((q) => ({
      id: q.id,
      question_number: q.question_number,
      question_text: q.question_text,
      options: q.options,
      correct_option_index: q.correct_option_index,
      explanation: q.explanation ?? '',
    })),
  };
}

