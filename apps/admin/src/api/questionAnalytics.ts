import { supabase } from '../lib/supabase';
import { isConfigured } from './_shared';
import type { QuestionAnalyticsResult, QuestionAnalyticsRow } from '@thanaya/types';

/**
 * تحليل الأسئلة على مستوى المنصة (أصعب الأسئلة).
 *
 * ★ يتطلّب analytics.view — وهو في قالب admin افتراضيًا. المقصود:
 *   بيانات مجمّعة عن صعوبة السؤال (تجميعي، لا شخصي) مفيدة لكل محرر.
 *   بيانات الطلبة الفردية تبقى خلف students.* / attempts.*.
 */
export const questionAnalyticsApi = {
  async getAnalytics(
    subjectId?: string,
    limit = 25,
    offset = 0
  ): Promise<QuestionAnalyticsResult> {
    if (isConfigured) {
      const { data, error } = await supabase.rpc('get_question_analytics', {
        p_subject_id: subjectId || null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as QuestionAnalyticsResult;
    }
    return {
      items: [] as QuestionAnalyticsRow[],
      limit,
      offset,
      overall: { students: 0, questions_answered: 0, accuracy: null, mastered_rate: null },
    };
  },
};
