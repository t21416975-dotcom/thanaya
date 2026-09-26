import { supabase } from '../lib/supabase';
import { isConfigured, memory } from './_shared';
import type { AdminAttemptRow, ListAttemptsResult } from '@thanaya/types';

export type AttemptFilters = {
  subjectId?: string;
  studentId?: string;
  examId?: string;
  mode?: 'exam' | 'review' | 'mock' | null;
  status?: 'in_progress' | 'submitted' | 'abandoned' | 'expired' | null;
  from?: string | null;
  to?: string | null;
  minScore?: number | null;
  maxScore?: number | null;
  onlyFlagged?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * تقرير الامتحانات والنتائج.
 *
 * ★ report كامل عبر RPC واحد get_admin_attempts (يتطلّب attempts.view).
 *   الفلاتر كلها على الخادم — لا نحمّل آلاف الصفوف في المتصفح.
 */
export const attemptsApi = {
  async getAttempts(filters: AttemptFilters = {}): Promise<ListAttemptsResult> {
    if (isConfigured) {
      const { data, error } = await supabase.rpc('get_admin_attempts', {
        p_subject_id: filters.subjectId || null,
        p_student_id: filters.studentId || null,
        p_exam_id: filters.examId || null,
        p_mode: filters.mode || null,
        p_status: filters.status || null,
        p_from: filters.from || null,
        p_to: filters.to || null,
        p_min_score: filters.minScore ?? null,
        p_max_score: filters.maxScore ?? null,
        p_only_flagged: filters.onlyFlagged ?? false,
        p_limit: filters.limit ?? 25,
        p_offset: filters.offset ?? 0,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as ListAttemptsResult;
    }

    let rows = [...(memory.attempts as AdminAttemptRow[])];
    if (filters.subjectId) rows = rows.filter((r) => r.subject_name === filters.subjectId);
    if (filters.studentId) rows = rows.filter((r) => r.student_id === filters.studentId);
    if (filters.mode) rows = rows.filter((r) => r.mode === filters.mode);
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.minScore !== null && filters.minScore !== undefined) {
      rows = rows.filter((r) => (r.score_percentage ?? 0) >= (filters.minScore as number));
    }
    if (filters.onlyFlagged) rows = rows.filter((r) => r.flagged_suspicious);

    const total = rows.length;
    const limit = filters.limit ?? 25;
    const offset = filters.offset ?? 0;
    return {
      total,
      limit,
      offset,
      items: rows.slice(offset, offset + limit),
      summary: {
        attempts: rows.filter((r) => r.status === 'submitted').length,
        avg_score: null,
        review_attempts: rows.filter((r) => r.mode === 'review').length,
        in_progress: rows.filter((r) => r.status === 'in_progress').length,
        abandoned: rows.filter((r) => r.status === 'abandoned').length,
        expired: rows.filter((r) => r.status === 'expired').length,
        flagged: rows.filter((r) => r.flagged_suspicious).length,
        active_students: new Set(rows.map((r) => r.student_id)).size,
      },
    };
  },

  /** تفاصيل محاولة واحدة مع كل إجاباتها (يتطلّب attempts.view). */
  async getAttemptDetail(attemptId: string) {
    if (isConfigured) {
      const { data, error } = await supabase.rpc('get_admin_attempt_detail', {
        p_attempt_id: attemptId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as {
        attempt: AdminAttemptRow & {
          student: { id: string; full_name: string | null; email: string };
          expires_at: string | null;
        };
        answers: (Record<string, any> & { answer_hash: string | null })[];
      };
    }
    const attempt = (memory.attempts as AdminAttemptRow[]).find((r) => r.id === attemptId);
    if (!attempt) throw new Error('المحاولة غير موجودة');
    return { attempt: { ...attempt, student: { id: '', full_name: null, email: '' }, expires_at: null }, answers: [] };
  },

  /** ★ تعليم كاشتباه غش (يتطلّب attempts.manage). */
  async flagAttempt(attemptId: string, flagged: boolean, reason?: string | null): Promise<void> {
    if (!isConfigured) {
      const attempt = (memory.attempts as AdminAttemptRow[]).find((r) => r.id === attemptId);
      if (attempt) {
        attempt.flagged_suspicious = flagged;
        attempt.flag_reason = flagged ? reason ?? null : null;
      }
      return;
    }
    const { error } = await supabase.rpc('admin_flag_attempt', {
      p_attempt_id: attemptId,
      p_flagged: flagged,
      p_reason: reason ?? null,
    });
    if (error) throw error;
  },

  /**
   * ★ حذف محاولة + إعادة حساب إحصاءات الطالب على الخادم
   *   (recompute_student_performance) — لا تترك أرقامًا متقنة يتيمة.
   */
  async deleteAttempt(attemptId: string) {
    if (!isConfigured) throw new Error('غير متاح في وضع المعاينة');
    const { data, error } = await supabase.rpc('admin_delete_attempt', { p_attempt_id: attemptId });
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) as { deleted: boolean; student_id: string; recomputed: boolean };
  },
};
