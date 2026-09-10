-- Migration: Interactive MCQs Exams & Gemini AI Settings
-- Description: Creates exams, exam_questions, and system_settings tables with RLS and initial configuration

-- 1. Exams Table
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    time_limit_minutes INTEGER NOT NULL DEFAULT 30 CHECK (time_limit_minutes > 0),
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exams_subject_published ON exams(subject_id, is_published);
CREATE INDEX IF NOT EXISTS idx_exams_created_at ON exams(created_at DESC);

CREATE TRIGGER set_exams_updated_at
    BEFORE UPDATE ON exams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Exam Questions Table
CREATE TABLE IF NOT EXISTS exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_option_index INTEGER NOT NULL CHECK (correct_option_index >= 0 AND correct_option_index <= 3),
    explanation TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_number ON exam_questions(exam_id, question_number);

-- 3. System Settings Table (for Gemini AI configuration & general settings)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert Default AI Settings
INSERT INTO system_settings (key, value, description)
VALUES
    (
        'gemini_model_name',
        'gemini-2.5-flash',
        'اسم موديل Google Gemini المعتمد لاستخراج الأسئلة من ملفات الـ PDF'
    ),
    (
        'gemini_exam_prompt',
        'أنت خبير تربوي ومعلم أول في وزارة التربية والتعليم للثانوية العامة والبكالوريا المصرية. مهمتك هي إنشاء واستخراج أسئلة الاختيار من متعدد (MCQs) التفاعلية من ملف الـ PDF المرفق بدقة علمية وتربوية عالية، مع توليد إجابات دقيقة وشرح وتفسير نموذجي شامل لكل سؤال.\n\nالقواعد والضوابط الصارمة:\n1. الالتزام التام بالمنهج ومنع الخروج عنه: استخرج واعتمد حصراً على المفاهيم والقوانين والدروس الواردة في ملف الـ PDF المرفوع. يُمنع منعاً باتاً إدخال أسئلة أو مواضيع من مناهج أخرى أو معلومات خارجية خارج حدود هذا الملف.\n2. مستوى الأسئلة وجودتها: صغ أسئلة تقيس الفهم والتطبيق والتحليل الشامل للطلاب بناءً على محتوى الملف؛ ابتعد عن البصمجية والنقل الحرفي السطحي، وفي نفس الوقت لا تخرج عن نطاق المادة.\n3. التوزيع العشوائي لموقع الإجابة الصحيحة: قم بتوزيع موقع الإجابة الصحيحة (correct_option_index) بشكل عشوائي ومتوازن بين الخيارات الأربعة (0, 1, 2, 3)، ويُمنع منعاً باتاً جعل الإجابة الصحيحة دائماً في الخيار الأول (0).\n4. الخيارات الأربعة: لكل سؤال، وفر 4 خيارات واضحة ومتمايزة ومكتوبة بدقة.\n5. التفسير والشرح النموذجي: اكتب في حقل explanation شرحاً علمياً تفصيلياً مقنعاً وواضحاً يوضح للطالب خطوات الحل الرياضي أو التعليل العلمي والقاعدة المتبعة وسبب صحة الخيار المختار.\n6. الإخراج الإجباري: يجب أن تكون النتيجة حصراً بصيغة JSON المحددة.',
        'الـ System Prompt الافتراضي الموجه لـ Gemini لاستخراج وتفسير أسئلة الـ MCQs'
    )
ON CONFLICT (key) DO NOTHING;

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Exams Policies
CREATE POLICY "Public can view published exams"
    ON exams FOR SELECT
    TO anon, authenticated
    USING (is_published = true OR is_admin());

CREATE POLICY "Admins can insert exams"
    ON exams FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update exams"
    ON exams FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "Admins can delete exams"
    ON exams FOR DELETE
    TO authenticated
    USING (is_admin());

-- Exam Questions Policies
CREATE POLICY "Public can view questions of published exams"
    ON exam_questions FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = exam_questions.exam_id
            AND (exams.is_published = true OR is_admin())
        )
    );

CREATE POLICY "Admins can insert exam questions"
    ON exam_questions FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update exam questions"
    ON exam_questions FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "Admins can delete exam questions"
    ON exam_questions FOR DELETE
    TO authenticated
    USING (is_admin());

-- System Settings Policies
CREATE POLICY "Admins can view system settings"
    ON system_settings FOR SELECT
    TO authenticated
    USING (is_admin());

CREATE POLICY "Admins can manage system settings"
    ON system_settings FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
