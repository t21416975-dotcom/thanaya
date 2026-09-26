export type AdminRole = 'super_admin' | 'admin' | 'editor';

export type AdminUser = {
  id: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PermissionEffect = 'allow' | 'deny';
export type PermissionScopeType = 'global' | 'subject' | 'content_type' | 'week' | 'resource' | 'exam';

export type Permission = {
  key: string;
  label_ar: string;
  category: 'general' | 'content' | 'exams' | 'structure' | 'operations' | 'system';
  supports_scope: boolean;
  order_index: number;
};

export type AdminRolePreset = { role: 'admin' | 'editor'; permission_key: string; created_at: string };

export type AdminPermission = {
  id: string;
  admin_id: string;
  permission_key: string;
  effect: PermissionEffect;
  scope_type: PermissionScopeType;
  scope_id: string | null;
  expires_at: string | null;
  granted_by: string | null;
  created_at: string;
};

export type AdminActivityLog = {
  id: number;
  admin_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
};

// ====== سير اعتماد التعديلات (طلبات التغيير) ======
export type ChangeRequestEntity = 'resources' | 'exams' | 'subjects' | 'content_types' | 'weeks';
export type ChangeRequestAction = 'create' | 'update' | 'delete';
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type ChangeRequest = {
  id: string;
  entity: ChangeRequestEntity;
  entity_id: string | null;
  action: ChangeRequestAction;
  payload: Record<string, any>;
  base_snapshot: Record<string, any> | null;
  status: ChangeRequestStatus;
  submitted_by: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
  // أعمدة مدمجة من جدول admins عبر دوال القوائم
  submitter_email?: string | null;
  reviewer_email?: string | null;
};

export type MyPermissions = {
  admin_id: string | null;
  email: string | null;
  role: AdminRole | null;
  is_active: boolean;
  is_super_admin: boolean;
  is_staff: boolean;
  global: string[];
  scoped: { key: string; scope_type: PermissionScopeType; scope_id: string | null }[];
  denied: string[];
  scoped_subject_ids: string[];
};

export type Subject = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ContentType = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Week = {
  id: string;
  week_number: number;
  title: string;
  term: 1 | 2;
  created_at: string;
};

export type Resource = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  subject_id: string;
  content_type_id: string;
  week_id?: string | null;
  pdf_url: string;
  youtube_url?: string | null;
  is_published: boolean;
  is_coming_soon: boolean;
  coming_soon_message?: string | null;
  published_at?: string | null;
  views_count: number;
  downloads_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  // Joined relation fields
  subject?: Subject;
  content_type?: ContentType;
  week?: Week;
};

export type ReportIssueType =
  | 'broken_file'
  | 'broken_link'
  | 'incorrect_content'
  | 'outdated'
  | 'other';

export type ReportStatus = 'pending' | 'resolved' | 'ignored';

export type ReportProblem = {
  id: string;
  resource_id: string;
  issue_type: ReportIssueType;
  details?: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at?: string | null;
  // Joined relation fields
  resource?: Resource;
};

export type AdSlotPosition =
  | 'homepage_top'
  | 'homepage_middle'
  | 'subject_page'
  | 'resource_after_meta'
  | 'footer';

export type AdSlotType = 'google' | 'direct' | 'fallback';

export type AdSlot = {
  id: string;
  name: string;
  position: AdSlotPosition;
  is_active: boolean;
  slot_type: AdSlotType;
  created_at: string;
  updated_at: string;
};

export type DirectAd = {
  id: string;
  advertiser_name: string;
  title: string;
  image_url: string;
  target_url: string;
  slot_position: AdSlotPosition;
  start_date: string;
  end_date: string;
  is_active: boolean;
  priority: number;
  impressions_count: number;
  clicks_count: number;
  created_at: string;
  updated_at: string;
};

export type Exam = {
  id: string;
  title: string;
  subject_id: string;
  time_limit_minutes: number;
  is_published: boolean;
  is_coming_soon: boolean;
  coming_soon_message?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  // Joined relation fields
  subject?: Subject;
  questions?: ExamQuestion[];
};

export type ExamQuestion = {
  id: string;
  exam_id: string;
  question_number: number;
  question_text: string;
  image_url?: string | null;
  options: string[];
  correct_option_index: number; // 0 | 1 | 2 | 3
  explanation: string;
  created_at: string;
  // denormalized (migration 20261001000000) — تستخدمها "امتحان الأخطاء"
  // حتى نفلتر الأسئلة حسب المادة بدون JOIN على exams.
  subject_id?: string | null;
  /** بصمة نصية مطبَّعة (تجاهل التشكيل واختلاف الهمزات) لكشف التكرار. */
  fingerprint?: string | null;
  /** إحصاء المنصة (اختياري في النوع: بيانات معلوماتية لا يحتاجها المتصفح). */
  times_attempted?: number;
  times_correct?: number;
  is_deleted?: boolean;
};

// ===========================================================================
// نظام الطالب (migration 20261001000000 → 20261001000004)
// ===========================================================================

/** رتبة الطالب الدراسية. */
export type StudentGrade = 'third' | 'second' | 'first';

export type Student = {
  id: string;
  /** يربط صف الطالب بحسابه في auth.users (Google OAuth أو بريد). */
  auth_user_id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  grade?: StudentGrade | null;
  phone?: string | null;
  oauth_provider: string;
  email_verified: boolean;
  /** مفتاح التفعيل من الإدارة — kill switch عكسي. */
  is_active: boolean;
  preferred_locale: string;
  total_exams_taken: number;
  total_questions: number;
  total_correct: number;
  total_wrong: number;
  last_seen_at?: string | null;
  last_login_provider?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * نمط المحاولة:
 *  - exam  : امتحان منشور عادي
 *  - mock  : امتحان تدريبي
 *  - review: ★ "امتحان الأخطاء" — مولّد من أخطاء الطالب السابقة.
 *            ليس صفًا في exams، لذلك exam_id = NULL.
 */
export type AttemptMode = 'exam' | 'review' | 'mock';

export type AttemptStatus = 'in_progress' | 'submitted' | 'abandoned' | 'expired';

export type ExamAttempt = {
  id: string;
  student_id: string;
  /** NULL في نمط review — انظر AttemptMode. */
  exam_id?: string | null;
  mode: AttemptMode;
  subject_id: string;
  /** المحاولة التي رُسِم منها "امتحان الأخطاء" (source). */
  source_attempt_id?: string | null;
  status: AttemptStatus;
  started_at: string;
  expires_at?: string | null;
  submitted_at?: string | null;
  time_spent_seconds: number;
  total_questions: number;
  answered_count: number;
  correct_count: number;
  wrong_count: number;
  blank_count: number;
  score_percentage?: number | null;
  flagged_suspicious: boolean;
  flag_reason?: string | null;
  /**
   * تجزئة SHA-256 لكل مجموعة أسئلة المحاولة + مفاتيح إجاباتها.
   * تُولَّد عند start_exam_attempt وتُطلب عند submit — انظر migration 20261001000002.
   */
  answer_token?: string | null;
  created_at: string;
};

export type AttemptAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  /** NULL = لم يُجب. */
  selected_index?: number | null;
  /** NULL قبل التسليم — لا تصحيح تدريجي يكشف النتيجة. */
  is_correct?: boolean | null;
  is_blank: boolean;
  answer_hash?: string | null;
  /** هل السؤال جاء من "امتحان الأخطاء"؟ */
  during_review: boolean;
  answered_at: string;
  time_taken_seconds?: number | null;
};

/**
 * ★ مفتاح "امتحان الأخطاء": صف لكل (طالب × سؤال).
 * question_performance هو مصدر الحقيقة الوحيد لخوارزمية الاختيار
 * ولمسار "أخطأت فيها".
 */
export type QuestionPerformance = {
  id: string;
  student_id: string;
  question_id: string;
  subject_id: string;
  exam_id?: string | null;
  /** عدد مرات ظهور السؤال في محاولات مسلَّمة (يشمل المتروكة بلا إجابة). */
  times_seen: number;
  times_correct: number;
  /** عدد الأخطاء الصريحة. المرشحون لامتحان الأخطاء = times_wrong > 0. */
  times_wrong: number;
  consecutive_wrong: number;
  last_wrong_at?: string | null;
  last_seen_at?: string | null;
  /** أتقن السؤال = أجاب صحيحًا مرتين. يخرج من مرشحي الأخطاء. */
  is_mastered: boolean;
  /** 0..1 — 0.5 بعد محاولة، 0.7 بعد اثنتين، 0.85 بعد 3، 1.0 عند الإتقان. */
  mastery_confidence: number;
  first_attempted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentSubjectStats = {
  student_id: string;
  subject_id: string;
  attempts_count: number;
  total_questions: number;
  total_correct: number;
  avg_score?: number | null;
  best_score?: number | null;
  wrong_questions_count: number;
  mastered_questions_count: number;
  last_attempt_at?: string | null;
};

// ---------------------------------------------------------------------------
// حمولات JSON التي ترجعها الـ RPCs
// ---------------------------------------------------------------------------

/** حمولة bootstrap_student / نتيجة تسجيل الدخول بجوجل. */
export type StudentBootstrap = {
  student_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  provider: string;
};

/** سؤال يُرسل للعميل أثناء المحاولة — بلا مفتاح إجابة. */
export type AttemptQuestionPayload = {
  id: string;
  number: number;
  text: string;
  options: string[];
  image_url: string | null;
};

/** سؤال بعد التسليم — مع مفتاح الإجابة والشرح. */
export type GradedQuestionPayload = AttemptQuestionPayload & {
  selected_index: number | null;
  correct_index: number;
  is_correct: boolean | null;
  is_blank: boolean;
  explanation: string;
  during_review: boolean;
};

export type StartAttemptResult = {
  attempt_id: string;
  exam_id: string | null;
  exam_title: string | null;
  subject_id: string;
  mode: AttemptMode;
  is_new: boolean;
  started_at: string;
  expires_at: string | null;
  time_limit_minutes: number;
  total_questions: number;
  answer_token: string;
  questions: AttemptQuestionPayload[];
};

export type SubmitAttemptResult = {
  attempt_id: string;
  score_percentage: number | null;
  total_questions: number;
  answered_count: number;
  correct_count: number;
  wrong_count: number;
  blank_count: number;
  time_spent_seconds: number;
  submitted_at: string;
  mode: AttemptMode;
  subject_id: string;
  answers: GradedQuestionPayload[];
  /** في نمط review: الأسئلة التي ما زالت غلط بعد هذه المحاولة. */
  still_wrong: GradedQuestionPayload[];
};

export type CreateReviewResult = {
  attempt_id: string;
  subject_id: string;
  subject_name: string;
  mode: 'review';
  total_questions: number;
  requested_questions: number;
  /** عدد الأسئلة التي نقصت عن الطلب — تُعرض للطالب كرسالة توضيحية. */
  shortfall: number;
  wrong_questions_available: number;
  time_limit_minutes: number;
  answer_token: string;
  questions: AttemptQuestionPayload[];
};

export type MySubjectSummary = {
  subject_id: string;
  subject_name: string;
  subject_slug: string;
  attempts_count: number;
  total_questions: number;
  total_correct: number;
  accuracy: number | null;
  avg_score: number | null;
  best_score: number | null;
  wrong_questions_count: number;
  mastered_questions_count: number;
  last_attempt_at: string | null;
};

export type MyAttemptSummary = {
  id: string;
  subject_name: string;
  exam_title: string | null;
  mode: AttemptMode;
  status: AttemptStatus;
  score_percentage: number | null;
  correct_count: number;
  wrong_count: number;
  blank_count: number;
  total_questions: number;
  started_at: string;
  submitted_at: string | null;
};

export type MyDashboard = {
  student: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    grade: StudentGrade | null;
    phone: string | null;
    provider: string;
    email_verified: boolean;
    created_at: string;
    last_seen_at: string | null;
  };
  summary: {
    attempts: number;
    questions: number;
    correct: number;
    wrong: number;
    accuracy: number | null;
    wrong_questions: number;
    mastered_questions: number;
  };
  subjects: MySubjectSummary[];
  recent_attempts: MyAttemptSummary[];
};

export type MyWrongQuestion = {
  question_id: string;
  subject_id: string;
  subject_name: string;
  text: string;
  options: string[];
  image_url: string | null;
  times_seen: number;
  times_wrong: number;
  consecutive_wrong: number;
  last_wrong_at: string | null;
  mastery_confidence: number;
};

export type MyWrongQuestionsResult = {
  total: number;
  items: MyWrongQuestion[];
  limit: number;
  offset: number;
};

export type AttemptQuestionsResult = {
  attempt_id: string;
  exam_id: string | null;
  exam_title: string | null;
  subject_id: string;
  subject_name: string | null;
  mode: AttemptMode;
  status: AttemptStatus;
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  total_questions: number;
  score_percentage: number | null;
  correct_count: number;
  wrong_count: number;
  blank_count: number;
  time_spent_seconds: number;
  /** متاح فقط أثناء المحاولة (in_progress) — يلزم لإتمام التسليم بعد استئناف. */
  answer_token?: string | null;
  questions: (AttemptQuestionPayload | GradedQuestionPayload)[];
};

// ---------------------------------------------------------------------------
// حمولات لوحة التحكم
// ---------------------------------------------------------------------------

export type AdminStudentRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  grade: StudentGrade | null;
  provider: string;
  email_verified: boolean;
  is_active: boolean;
  attempts: number;
  questions: number;
  correct: number;
  wrong: number;
  accuracy: number | null;
  wrong_questions: number;
  created_at: string;
  last_seen_at: string | null;
};

export type ListStudentsResult = {
  total: number;
  limit: number;
  offset: number;
  items: AdminStudentRow[];
  overall: {
    students: number;
    active: number;
    inactive: number;
    attempts: number;
    answers: number;
    accuracy: number | null;
    new_this_week: number;
  };
};

export type AdminAttemptRow = {
  id: string;
  student_id: string;
  student_name: string | null;
  student_email: string;
  subject_name: string;
  exam_title: string | null;
  mode: AttemptMode;
  status: AttemptStatus;
  score_percentage: number | null;
  correct_count: number;
  wrong_count: number;
  blank_count: number;
  total_questions: number;
  time_spent_seconds: number;
  flagged_suspicious: boolean;
  flag_reason: string | null;
  started_at: string;
  submitted_at: string | null;
};

export type ListAttemptsResult = {
  total: number;
  limit: number;
  offset: number;
  items: AdminAttemptRow[];
  summary: {
    attempts: number;
    avg_score: number | null;
    review_attempts: number;
    in_progress: number;
    abandoned: number;
    expired: number;
    flagged: number;
    active_students: number;
  };
};

export type QuestionAnalyticsRow = {
  question_id: string;
  subject_id: string;
  subject_name: string;
  text: string;
  image_url: string | null;
  attempts: number;
  wrong: number;
  error_rate: number | null;
  blank: number;
  students_wrong: number;
  /** توزيع إجابات الطلاب: { "0": 12, "1": 3, ... } — لكشف الأسئلة الغامضة. */
  options_distribution: Record<string, number> | null;
};

export type QuestionAnalyticsResult = {
  items: QuestionAnalyticsRow[];
  limit: number;
  offset: number;
  overall: {
    students: number;
    questions_answered: number;
    accuracy: number | null;
    mastered_rate: number | null;
  };
};

export type SystemSetting = {
  key: string;
  value: string;
  description?: string | null;
  updated_at: string;
};

export type ExamWithQuestions = Exam & {
  questions: ExamQuestion[];
};

export type NotificationType = 'bell' | 'banner' | 'popup';
export type NotificationPriority = 'normal' | 'urgent';

export type Notification = {
  id: string;
  title: string;
  message: string;
  link_url?: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  is_active: boolean;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

// Database Schema Representation
export interface Database {
  public: {
    /**
     * لا توجد Views في المشروع. نُعلنها صراحةً لأن GenericSchema في
     * supabase-js يتطلّب وجودها: بدونها لا يحقّق Database['public']
     * القيد، فتتراجع أنواع `rpc` إلى "args = undefined" وتفقد كل
     * الدوال التي لها وسائط أنواعها (.submit_exam_attempt وأخواتها).
     */
    Views: Record<string, never>;
    Tables: {
      admins: {
        Row: AdminUser;
        Insert: Omit<AdminUser, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string };
        Update: Partial<Omit<AdminUser, 'id' | 'created_at'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      permissions: {
        Row: Permission;
        Insert: Omit<Permission, never>;
        Update: Partial<Permission>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      admin_role_presets: {
        Row: AdminRolePreset;
        Insert: Omit<AdminRolePreset, 'created_at'> & { created_at?: string };
        Update: Partial<AdminRolePreset>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      admin_permissions: {
        Row: AdminPermission;
        Insert: Omit<AdminPermission, 'id' | 'created_at' | 'granted_by'> & { id?: string; granted_by?: string | null };
        Update: Partial<AdminPermission>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      admin_activity_log: {
        Row: AdminActivityLog;
        Insert: Omit<AdminActivityLog, 'id' | 'created_at'> & { id?: number };
        Update: never;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      change_requests: {
        Row: ChangeRequest;
        Insert: Omit<ChangeRequest, 'id' | 'created_at' | 'status' | 'submitted_by' | 'submitter_email' | 'reviewer_email'> & {
          id?: string;
          status?: ChangeRequestStatus;
        };
        Update: Partial<Pick<ChangeRequest, 'status' | 'review_note' | 'reviewed_by' | 'reviewed_at' | 'payload'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      subjects: {
        Row: Subject;
        Insert: Omit<Subject, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<Subject, 'id' | 'created_at' | 'updated_at'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      content_types: {
        Row: ContentType;
        Insert: Omit<ContentType, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<ContentType, 'id' | 'created_at' | 'updated_at'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      weeks: {
        Row: Week;
        Insert: Omit<Week, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<Week, 'id' | 'created_at'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      resources: {
        Row: Resource;
        Insert: Omit<Resource, 'id' | 'views_count' | 'downloads_count' | 'created_at' | 'updated_at' | 'subject' | 'content_type' | 'week'> & {
          id?: string;
          views_count?: number;
          downloads_count?: number;
        };
        Update: Partial<Omit<Resource, 'id' | 'created_at' | 'updated_at' | 'subject' | 'content_type' | 'week'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      reports: {
        Row: ReportProblem;
        Insert: Omit<ReportProblem, 'id' | 'status' | 'created_at' | 'resolved_at' | 'resource'> & {
          id?: string;
          status?: ReportStatus;
        };
        Update: Partial<Omit<ReportProblem, 'id' | 'created_at' | 'resource'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      ad_slots: {
        Row: AdSlot;
        Insert: Omit<AdSlot, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<AdSlot, 'id' | 'created_at' | 'updated_at'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      direct_ads: {
        Row: DirectAd;
        Insert: Omit<DirectAd, 'id' | 'impressions_count' | 'clicks_count' | 'created_at' | 'updated_at'> & {
          id?: string;
          impressions_count?: number;
          clicks_count?: number;
        };
        Update: Partial<Omit<DirectAd, 'id' | 'created_at' | 'updated_at'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      exams: {
        Row: Exam;
        Insert: Omit<Exam, 'id' | 'created_at' | 'updated_at' | 'subject' | 'questions'> & { id?: string };
        Update: Partial<Omit<Exam, 'id' | 'created_at' | 'updated_at' | 'subject' | 'questions'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      exam_questions: {
        Row: ExamQuestion;
        Insert: Omit<ExamQuestion, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<ExamQuestion, 'id' | 'created_at'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      system_settings: {
        Row: SystemSetting;
        Insert: Omit<SystemSetting, 'updated_at'>;
        Update: Partial<Omit<SystemSetting, 'key'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<Notification, 'id' | 'created_at' | 'updated_at'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRecord;
        Insert: Omit<PushSubscriptionRecord, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<PushSubscriptionRecord, 'id' | 'created_at'>>;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      students: {
        Row: Student;
        Insert: Omit<Student, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        /** ★ لا يُستخدم من العميل: كل تعديل يمر عبر update_own_profile. */
        Update: never;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      exam_attempts: {
        Row: ExamAttempt;
        Insert: Omit<ExamAttempt, 'id' | 'created_at'> & { id?: string; created_at?: string };
        /** ★ لا يُستخدم من العميل: كل كتابة تمر عبر start/save/submit RPCs. */
        Update: never;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      attempt_answers: {
        Row: AttemptAnswer;
        Insert: Omit<AttemptAnswer, 'id' | 'answered_at'> & { id?: string; answered_at?: string };
        Update: never;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      question_performance: {
        Row: QuestionPerformance;
        Insert: Omit<QuestionPerformance, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: never;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      student_subject_stats: {
        Row: StudentSubjectStats;
        Insert: StudentSubjectStats;
        Update: never;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
      rate_limits: {
        Row: { bucket: string; hits: number; window_start: string };
        Insert: { bucket: string; hits?: number; window_start?: string };
        Update: never;
        /** Supabase 2.116+ يتطلب هذا الحقل ضمن GenericTable. */
        Relationships: [];
      };
    };
    Functions: {
      get_my_permissions: {
        Args: Record<string, never>;
        Returns: MyPermissions;
      };
      set_staff_permissions: {
        Args: {
          p_admin_id: string;
          p_entries: {
            key: string;
            effect?: PermissionEffect;
            scope_type?: PermissionScopeType;
            scope_id?: string | null;
            expires_at?: string | null;
          }[];
        };
        Returns: number;
      };
      list_staff_reports: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          resource_id: string;
          issue_type: ReportIssueType;
          details: string | null;
          status: ReportStatus;
          created_at: string;
          resolved_at: string | null;
          resource_title: string;
          subject_id: string | null;
          subject_name: string | null;
        }[];
      };
      submit_change_request: {
        Args: {
          p_entity: ChangeRequestEntity;
          p_entity_id: string | null;
          p_action: ChangeRequestAction;
          p_payload: Record<string, any>;
        };
        Returns: string;
      };
      review_change_request: {
        Args: {
          p_id: string;
          p_decision: 'approved' | 'rejected';
          p_note?: string | null;
          p_modified_payload?: Record<string, any> | null;
        };
        Returns: void;
      };
      cancel_change_request: {
        Args: { p_id: string };
        Returns: void;
      };
      list_pending_changes: {
        Args: Record<string, never>;
        Returns: ChangeRequest[];
      };
      list_my_changes: {
        Args: Record<string, never>;
        Returns: ChangeRequest[];
      };
      list_all_changes: {
        Args: Record<string, never>;
        Returns: ChangeRequest[];
      };
      increment_resource_views: {
        Args: { p_resource_id: string };
        Returns: void;
      };
      increment_resource_downloads: {
        Args: { p_resource_id: string };
        Returns: void;
      };
      increment_ad_impressions: {
        Args: { p_ad_id: string };
        Returns: void;
      };
      increment_ad_clicks: {
        Args: { p_ad_id: string };
        Returns: void;
      };

      // ----- الطالب: تسجيل الدخول والحساب -----
      /** يُستدعى من /auth/callback بعد نجاح Google OAuth. */
      bootstrap_student: {
        Args: Record<string, never>;
        Returns: StudentBootstrap;
      };
      /** قائمة بيضاء صريحة — is_active و total_* غير قابلة للتعديل. */
      update_own_profile: {
        Args: {
          p_full_name?: string | null;
          p_phone?: string | null;
          p_grade?: StudentGrade | null;
          p_avatar_url?: string | null;
          p_locale?: string | null;
        };
        Returns: Student;
      };

      // ----- الطالب: الامتحانات -----
      /** يبدأ محاولة أو يستأنف مفتوحة. ★ لا تُعيد correct_index ولا explanation. */
      start_exam_attempt: {
        Args: { p_exam_id: string; p_mode?: AttemptMode };
        Returns: StartAttemptResult;
      };
      /** يحفظ إجابة واحدة. يُرفض إن كان السؤال خارج المحاولة أو انتهى وقتها. */
      save_answer: {
        Args: {
          p_attempt_id: string;
          p_question_id: string;
          p_selected_index: number | null;
          p_time_taken?: number | null;
        };
        Returns: void;
      };
      /** ★ التصحيح كله هنا (السيرفر) + تسجيل question_performance. */
      submit_exam_attempt: {
        Args: { p_attempt_id: string; p_token: string; p_time_spent?: number };
        Returns: SubmitAttemptResult;
      };
      /** ★ "امتحان الأخطاء": يولّد محاولة من الأسئلة غير المتقنة في مادة. */
      create_review_exam: {
        Args: {
          p_subject_id: string;
          p_count?: number | null;
          p_only_wrong?: boolean;
          p_include_unseen?: boolean;
        };
        Returns: CreateReviewResult;
      };
      get_attempt_questions: {
        Args: { p_attempt_id: string };
        Returns: AttemptQuestionsResult;
      };
      abandon_attempt: {
        Args: { p_attempt_id: string };
        Returns: void;
      };
      get_my_dashboard: {
        Args: Record<string, never>;
        Returns: MyDashboard;
      };
      get_my_wrong_questions: {
        Args: { p_subject_id?: string | null; p_limit?: number; p_offset?: number };
        Returns: MyWrongQuestionsResult;
      };
      delete_my_account: {
        Args: Record<string, never>;
        Returns: { deleted: boolean; auth_user_deleted?: boolean; email?: string; reason?: string };
      };

      // ----- الإدارة: قراءة بيانات الطلبة (students.view / attempts.view) -----
      list_admin_students: {
        Args: {
          p_search?: string | null;
          p_subject_id?: string | null;
          p_active?: boolean | null;
          p_sort?: 'recent' | 'name' | 'attempts' | 'accuracy';
          p_limit?: number;
          p_offset?: number;
        };
        Returns: ListStudentsResult;
      };
      get_admin_student_detail: {
        Args: { p_student_id: string };
        Returns: {
          student: Student;
          summary: {
            attempts: number;
            questions: number;
            correct: number;
            wrong: number;
            accuracy: number | null;
          };
          performance: { questions_seen: number; mastered: number; still_wrong: number };
          subjects: MySubjectSummary[];
          attempts: AdminAttemptRow[];
        };
      };
      get_admin_attempts: {
        Args: {
          p_subject_id?: string | null;
          p_student_id?: string | null;
          p_exam_id?: string | null;
          p_mode?: AttemptMode | null;
          p_status?: AttemptStatus | null;
          p_from?: string | null;
          p_to?: string | null;
          p_min_score?: number | null;
          p_max_score?: number | null;
          p_only_flagged?: boolean;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: ListAttemptsResult;
      };
      get_admin_attempt_detail: {
        Args: { p_attempt_id: string };
        Returns: {
          attempt: AdminAttemptRow & {
            student: { id: string; full_name: string | null; email: string };
            expires_at: string | null;
          };
          answers: (GradedQuestionPayload & {
            answered_at: string;
            time_taken_seconds: number | null;
            answer_hash: string | null;
          })[];
        };
      };
      /** يتطلّب analytics.view (متاح في قالب admin) — تجميعي وليس شخصيًا. */
      get_question_analytics: {
        Args: { p_subject_id?: string | null; p_limit?: number; p_offset?: number };
        Returns: QuestionAnalyticsResult;
      };

      // ----- الإدارة: إجراءات (students.manage / attempts.manage) -----
      admin_set_student_active: {
        Args: { p_student_id: string; p_active: boolean };
        Returns: void;
      };
      admin_flag_attempt: {
        Args: { p_attempt_id: string; p_flagged: boolean; p_reason?: string | null };
        Returns: void;
      };
      admin_delete_attempt: {
        Args: { p_attempt_id: string };
        Returns: { deleted: boolean; student_id: string; recomputed: boolean };
      };
      admin_delete_student_data: {
        Args: { p_student_id: string };
        Returns: {
          deleted: boolean;
          auth_user_deleted: boolean;
          email: string;
          counts: { attempts: number; answers: number; performance: number };
        };
      };
    };
  };
}
