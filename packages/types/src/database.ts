export type AdminUser = {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
  created_at: string;
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
  published_at?: string | null;
  views_count: number;
  downloads_count: number;
  created_at: string;
  updated_at: string;
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

// Database Schema Representation
export interface Database {
  public: {
    Tables: {
      admins: {
        Row: AdminUser;
        Insert: Omit<AdminUser, 'created_at'>;
        Update: Partial<Omit<AdminUser, 'id' | 'created_at'>>;
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
    };
    Functions: {
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
