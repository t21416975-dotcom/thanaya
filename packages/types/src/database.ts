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
    Tables: {
      admins: {
        Row: AdminUser;
        Insert: Omit<AdminUser, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string };
        Update: Partial<Omit<AdminUser, 'id' | 'created_at'>>;
      };
      permissions: {
        Row: Permission;
        Insert: Omit<Permission, never>;
        Update: Partial<Permission>;
      };
      admin_role_presets: {
        Row: AdminRolePreset;
        Insert: Omit<AdminRolePreset, 'created_at'> & { created_at?: string };
        Update: Partial<AdminRolePreset>;
      };
      admin_permissions: {
        Row: AdminPermission;
        Insert: Omit<AdminPermission, 'id' | 'created_at' | 'granted_by'> & { id?: string; granted_by?: string | null };
        Update: Partial<AdminPermission>;
      };
      admin_activity_log: {
        Row: AdminActivityLog;
        Insert: Omit<AdminActivityLog, 'id' | 'created_at'> & { id?: number };
        Update: never;
      };
      change_requests: {
        Row: ChangeRequest;
        Insert: Omit<ChangeRequest, 'id' | 'created_at' | 'status' | 'submitted_by' | 'submitter_email' | 'reviewer_email'> & {
          id?: string;
          status?: ChangeRequestStatus;
        };
        Update: Partial<Pick<ChangeRequest, 'status' | 'review_note' | 'reviewed_by' | 'reviewed_at' | 'payload'>>;
      };
      subjects: {
        Row: Subject;
        Insert: Omit<Subject, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<Subject, 'id' | 'created_at' | 'updated_at'>>;
      };
      content_types: {
        Row: ContentType;
        Insert: Omit<ContentType, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<ContentType, 'id' | 'created_at' | 'updated_at'>>;
      };
      weeks: {
        Row: Week;
        Insert: Omit<Week, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<Week, 'id' | 'created_at'>>;
      };
      resources: {
        Row: Resource;
        Insert: Omit<Resource, 'id' | 'views_count' | 'downloads_count' | 'created_at' | 'updated_at' | 'subject' | 'content_type' | 'week'> & {
          id?: string;
          views_count?: number;
          downloads_count?: number;
        };
        Update: Partial<Omit<Resource, 'id' | 'created_at' | 'updated_at' | 'subject' | 'content_type' | 'week'>>;
      };
      reports: {
        Row: ReportProblem;
        Insert: Omit<ReportProblem, 'id' | 'status' | 'created_at' | 'resolved_at' | 'resource'> & {
          id?: string;
          status?: ReportStatus;
        };
        Update: Partial<Omit<ReportProblem, 'id' | 'created_at' | 'resource'>>;
      };
      ad_slots: {
        Row: AdSlot;
        Insert: Omit<AdSlot, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<AdSlot, 'id' | 'created_at' | 'updated_at'>>;
      };
      direct_ads: {
        Row: DirectAd;
        Insert: Omit<DirectAd, 'id' | 'impressions_count' | 'clicks_count' | 'created_at' | 'updated_at'> & {
          id?: string;
          impressions_count?: number;
          clicks_count?: number;
        };
        Update: Partial<Omit<DirectAd, 'id' | 'created_at' | 'updated_at'>>;
      };
      exams: {
        Row: Exam;
        Insert: Omit<Exam, 'id' | 'created_at' | 'updated_at' | 'subject' | 'questions'> & { id?: string };
        Update: Partial<Omit<Exam, 'id' | 'created_at' | 'updated_at' | 'subject' | 'questions'>>;
      };
      exam_questions: {
        Row: ExamQuestion;
        Insert: Omit<ExamQuestion, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<ExamQuestion, 'id' | 'created_at'>>;
      };
      system_settings: {
        Row: SystemSetting;
        Insert: Omit<SystemSetting, 'updated_at'>;
        Update: Partial<Omit<SystemSetting, 'key'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<Notification, 'id' | 'created_at' | 'updated_at'>>;
      };
      push_subscriptions: {
        Row: PushSubscriptionRecord;
        Insert: Omit<PushSubscriptionRecord, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<PushSubscriptionRecord, 'id' | 'created_at'>>;
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
    };
  };
}
