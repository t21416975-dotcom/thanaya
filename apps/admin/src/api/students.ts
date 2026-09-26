import { supabase } from '../lib/supabase';
import { isConfigured, memory } from './_shared';
import type { AdminStudentRow, ListStudentsResult } from '@thanaya/types';

// ── فلاتر قائمة الطلاب ─────────────────────────────────────────────────────
export type StudentFilters = {
  search?: string;
  subjectId?: string;
  active?: boolean | null;
  sort?: 'recent' | 'name' | 'attempts' | 'accuracy';
  limit?: number;
  offset?: number;
};

/**
 * جدول الطلاب (server-side pagination + بحث + فلاتر).
 *
 * ★ كل القراءة عبر RPC واحد list_admin_students بدل 3 استعلامات:
 *   الملف + عدّاد الإجمالي + إحصاء عام. الدالة تفحص students.view بنفسها،
 *   فلا يمكن تجاوزها من المتصفح.
 *
 * ★ البيانات الشخصية (بريد + درجة) → students.view لا تُضاف لقالب الأدمن.
 *   super_admin فقط افتراضيًا.
 */
export const studentsApi = {
  async getStudents(filters: StudentFilters = {}): Promise<ListStudentsResult> {
    if (isConfigured) {
      const { data, error } = await supabase.rpc('list_admin_students', {
        p_search: filters.search?.trim() || null,
        p_subject_id: filters.subjectId || null,
        p_active: filters.active === undefined ? null : filters.active,
        p_sort: filters.sort || 'recent',
        p_limit: filters.limit ?? 25,
        p_offset: filters.offset ?? 0,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as ListStudentsResult;
    }

    // وضع التطوير: ذاكرة محلية
    const all = memory.students as AdminStudentRow[];
    const search = filters.search?.trim().toLowerCase();
    let rows = all.filter((s) => {
      if (filters.active !== undefined && filters.active !== null && s.is_active !== filters.active) return false;
      if (!search) return true;
      return (
        s.email.toLowerCase().includes(search) || (s.full_name || '').toLowerCase().includes(search)
      );
    });
    rows = [...rows].sort((a, b) => {
      switch (filters.sort) {
        case 'name':
          return (a.full_name || a.email).localeCompare(b.full_name || b.email, 'ar');
        case 'attempts':
          return b.attempts - a.attempts;
        case 'accuracy':
          return (b.accuracy ?? 0) - (a.accuracy ?? 0);
        default:
          return new Date(b.last_seen_at || b.created_at).getTime() - new Date(a.last_seen_at || a.created_at).getTime();
      }
    });
    const total = rows.length;
    const limit = filters.limit ?? 25;
    const offset = filters.offset ?? 0;
    return {
      total,
      limit,
      offset,
      items: rows.slice(offset, offset + limit),
      overall: {
        students: all.length,
        active: all.filter((s) => s.is_active).length,
        inactive: all.filter((s) => !s.is_active).length,
        attempts: 0,
        answers: 0,
        accuracy: null,
        new_this_week: 0,
      },
    };
  },

  /** ملف طالب: ملخص + per-subject + سجل المحاولات. */
  async getStudentDetail(studentId: string) {
    if (isConfigured) {
      const { data, error } = await supabase.rpc('get_admin_student_detail', {
        p_student_id: studentId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as {
        student: ListStudentsResult['items'][number] & { auth_user_id: string };
        summary: { attempts: number; questions: number; correct: number; wrong: number; accuracy: number | null };
        performance: { questions_seen: number; mastered: number; still_wrong: number };
        subjects: {
          subject_id: string;
          subject_name: string;
          attempts_count: number;
          accuracy: number | null;
          avg_score: number | null;
          best_score: number | null;
          wrong_questions_count: number;
          mastered_questions_count: number;
        }[];
        attempts: Record<string, any>[];
      };
    }
    const student = (memory.students as AdminStudentRow[]).find((s) => s.id === studentId);
    if (!student) throw new Error('الطالب غير موجود');
    return {
      student: { ...student, auth_user_id: '' },
      summary: {
        attempts: student.attempts,
        questions: student.questions,
        correct: student.correct,
        wrong: student.wrong,
        accuracy: student.accuracy,
      },
      performance: { questions_seen: student.questions, mastered: 0, still_wrong: student.wrong_questions },
      subjects: [],
      attempts: [],
    };
  },

  /** ★ kill switch: تعطيل/تنشيط حساب طالب. يتطلّب students.manage. */
  async setActive(studentId: string, active: boolean): Promise<void> {
    if (!isConfigured) {
      const student = (memory.students as AdminStudentRow[]).find((s) => s.id === studentId);
      if (student) student.is_active = active;
      return;
    }
    const { error } = await supabase.rpc('admin_set_student_active', {
      p_student_id: studentId,
      p_active: active,
    });
    if (error) throw error;
  },

  /** حذف كل بيانات طالب (GDPR) + حسابه في auth. يتطلّب students.manage. */
  async deleteStudentData(studentId: string) {
    if (!isConfigured) throw new Error('غير متاح في وضع المعاينة');
    const { data, error } = await supabase.rpc('admin_delete_student_data', {
      p_student_id: studentId,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) as {
      deleted: boolean;
      auth_user_deleted: boolean;
      email: string;
      counts: { attempts: number; answers: number; performance: number };
    };
  },
};
