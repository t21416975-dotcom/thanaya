-- ============================================================================
-- Migration: Backfill student-auth denormalized data
-- الملف: supabase/migrations/20261001000004_backfill.sql
-- الهدف: ملء الأعمدة الجديدة على البيانات الموجودة قبل تشغيل التطبيق.
--
--   1. exam_questions.subject_id  ← من exams.subject_id
--   2. exam_questions.fingerprint ← بصمة نصية مطبَّعة
--   3. exam_questions.is_deleted   ← false (افتراضي)
--
-- ★ آمن للتشغيل على قاعدة فيها بيانات: UPDATE فقط، ولا DELETE.
-- ★ على قاعدة جديدة (لا أسئلة) لا يفعل شيئًا.
--
-- Idempotent: يمكن تشغيله أكثر من مرة بأمان (UPDATE مشروط).
-- ============================================================================

-- 1) مزامنة subject_id لكل سؤال من امتحانه
UPDATE public.exam_questions q
   SET subject_id = e.subject_id
  FROM public.exams e
 WHERE e.id = q.exam_id
   AND q.subject_id IS DISTINCT FROM e.subject_id;

-- 2) أي سؤال يتيم (امتحانه محذوف) → نُبقي subject_id كما هو إن وُجد.
--    نتحقق فقط ولا نكتب.
DO $$
DECLARE orphans BIGINT;
BEGIN
    SELECT count(*) INTO orphans
    FROM public.exam_questions q
    WHERE q.subject_id IS NULL;
    IF orphans > 0 THEN
        RAISE NOTICE 'تحذير: % سؤال بلا subject_id (امتحانه غير موجود). لن يدخلوا "امتحان الأخطاء".',
            orphans;
    END IF;
END $$;

-- 3) حساب البصمة للأسئلة التي لا تملك واحدة
UPDATE public.exam_questions
   SET fingerprint = encode(
           sha256(convert_to(private.normalize_question_text(question_text), 'utf8')), 'hex')
 WHERE fingerprint IS NULL;

-- 4) إحصاء سريع للتقرير
DO $$
DECLARE
    c_questions BIGINT;
    c_subjects  BIGINT;
    c_dupes     BIGINT;
BEGIN
    SELECT count(*) INTO c_questions
    FROM public.exam_questions WHERE subject_id IS NOT NULL;

    SELECT count(DISTINCT subject_id) INTO c_subjects
    FROM public.exam_questions WHERE subject_id IS NOT NULL;

    SELECT count(*) INTO c_dupes FROM (
        SELECT fingerprint FROM public.exam_questions
        WHERE fingerprint IS NOT NULL
        GROUP BY fingerprint HAVING count(*) > 1
    ) d;

    RAISE NOTICE 'تم مزامنة % سؤال عبر % مادة. مجموعات أسئلة متكررة (نفس البصمة): %.',
        c_questions, c_subjects, c_dupes;
END $$;
