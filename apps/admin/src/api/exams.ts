import { supabase } from '../lib/supabase';
import { shouldQueueForApproval } from '../lib/approval';
import type { Exam, ExamQuestion, ExamWithQuestions } from '@thanaya/types';
import { isConfigured, memory, submitChange, examPayloadFrom } from './_shared';

export const examsApi = {
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
    return memory.exams.map((exam) => ({
      ...exam,
      subject: memory.subjects.find((s) => s.id === exam.subject_id),
      questions: memory.examQuestions
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
    const exam = memory.exams.find((e) => e.id === id);
    if (!exam) return null;
    const questions = memory.examQuestions
      .filter((q) => q.exam_id === id)
      .sort((a, b) => a.question_number - b.question_number);
    return {
      ...exam,
      subject: memory.subjects.find((s) => s.id === exam.subject_id),
      questions,
    };
  },

  async createExam(
    examData: Omit<Exam, 'id' | 'created_at' | 'updated_at' | 'subject' | 'questions'>,
    questionsData: Omit<ExamQuestion, 'id' | 'exam_id' | 'created_at'>[]
  ): Promise<ExamWithQuestions> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const examEcho: Exam = {
          id,
          title: examData.title,
          subject_id: examData.subject_id,
          time_limit_minutes: examData.time_limit_minutes,
          is_published: examData.is_published,
          is_coming_soon: examData.is_coming_soon ?? false,
          coming_soon_message: examData.coming_soon_message ?? null,
          created_at: now,
          updated_at: now,
        };
        const questionsEcho: ExamQuestion[] = questionsData.map((q, idx) => ({
          id: crypto.randomUUID(),
          exam_id: id,
          question_number: q.question_number || idx + 1,
          question_text: q.question_text,
          options: q.options,
          correct_option_index: q.correct_option_index,
          explanation: q.explanation || '',
          created_at: now,
        }));
        await submitChange({
          entity: 'exams',
          entityId: id,
          action: 'create',
          payload: examPayloadFrom(examEcho, questionsEcho),
        });
        return { ...examEcho, questions: questionsEcho };
      }
      const { data: newExam, error: examError } = await (supabase.from('exams') as any)
        .insert({
          title: examData.title,
          subject_id: examData.subject_id,
          time_limit_minutes: examData.time_limit_minutes,
          is_published: examData.is_published,
          is_coming_soon: examData.is_coming_soon ?? false,
          coming_soon_message: examData.coming_soon_message ?? null,
        })
        .select('*, subject:subjects(*)')
        .single();
      if (examError) throw examError;

      const questionsToInsert = questionsData.map((q, idx) => ({
        exam_id: newExam.id,
        question_number: q.question_number || idx + 1,
        question_text: q.question_text,
        image_url: q.image_url || null,
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
      is_coming_soon: examData.is_coming_soon ?? false,
      coming_soon_message: examData.coming_soon_message ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subject: memory.subjects.find((s) => s.id === examData.subject_id),
    };

    const newQuestions: ExamQuestion[] = questionsData.map((q, idx) => ({
      id: `q-${Date.now()}-${idx + 1}`,
      exam_id: examId,
      question_number: q.question_number || idx + 1,
      question_text: q.question_text,
      image_url: q.image_url || null,
      options: q.options,
      correct_option_index: q.correct_option_index,
      explanation: q.explanation || '',
      created_at: new Date().toISOString(),
    }));

    memory.exams.unshift(newExam);
    memory.examQuestions.push(...newQuestions);

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
      if (shouldQueueForApproval()) {
        const { data: currentExam, error: fetchError } = await supabase
          .from('exams').select('*').eq('id', id).single();
        if (fetchError) throw fetchError;

        let mergedQuestions: ExamQuestion[];
        if (questionsData) {
          mergedQuestions = questionsData.map((q, idx) => ({
            id: crypto.randomUUID(),
            exam_id: id,
            question_number: q.question_number || idx + 1,
            question_text: q.question_text,
            options: q.options,
            correct_option_index: q.correct_option_index,
            explanation: q.explanation || '',
            created_at: new Date().toISOString(),
          }));
        } else {
          const { data: existingQ, error: qErr } = await supabase
            .from('exam_questions').select('*').eq('exam_id', id).order('question_number');
          if (qErr) throw qErr;
          mergedQuestions = (existingQ as unknown as ExamQuestion[]) || [];
        }

        const merged = { ...(currentExam as unknown as Exam), ...examUpdates };
        await submitChange({
          entity: 'exams',
          entityId: id,
          action: 'update',
          payload: examPayloadFrom(merged, mergedQuestions),
        });
        return { ...merged, questions: mergedQuestions };
      }
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
          image_url: q.image_url || null,
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

    const examIdx = memory.exams.findIndex((e) => e.id === id);
    if (examIdx === -1) throw new Error('Exam not found');

    memory.exams[examIdx] = {
      ...memory.exams[examIdx],
      ...examUpdates,
      updated_at: new Date().toISOString(),
      subject: examUpdates.subject_id
        ? memory.subjects.find((s) => s.id === examUpdates.subject_id)
        : memory.exams[examIdx].subject,
    };

    if (questionsData) {
      memory.examQuestions = memory.examQuestions.filter((q) => q.exam_id !== id);
      const newQ: ExamQuestion[] = questionsData.map((q, idx) => ({
        id: `q-${Date.now()}-${idx + 1}`,
        exam_id: id,
        question_number: q.question_number || idx + 1,
        question_text: q.question_text,
        image_url: q.image_url || null,
        options: q.options,
        correct_option_index: q.correct_option_index,
        explanation: q.explanation || '',
        created_at: new Date().toISOString(),
      }));
      memory.examQuestions.push(...newQ);
    }

    const questions = memory.examQuestions
      .filter((q) => q.exam_id === id)
      .sort((a, b) => a.question_number - b.question_number);

    return {
      ...memory.exams[examIdx],
      questions,
    };
  },

  async deleteExam(id: string): Promise<void> {
    if (isConfigured) {
      if (shouldQueueForApproval()) {
        await submitChange({ entity: 'exams', entityId: id, action: 'delete', payload: { id } });
        return;
      }
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    memory.exams = memory.exams.filter((e) => e.id !== id);
    memory.examQuestions = memory.examQuestions.filter((q) => q.exam_id !== id);
  },
};
