-- Migration: Coming Soon Feature
-- Description: Adds is_coming_soon and coming_soon_message to resources and exams tables
-- Items marked as "coming soon" appear grayed out and non-clickable to students

-- 1. Add coming_soon columns to resources
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS coming_soon_message TEXT DEFAULT NULL;

-- 2. Add coming_soon columns to exams
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS coming_soon_message TEXT DEFAULT NULL;

-- 3. Update RLS policies to include coming_soon items for public viewing
DROP POLICY IF EXISTS "Public can view published resources" ON resources;
CREATE POLICY "Public can view published or coming_soon resources"
    ON resources FOR SELECT
    TO anon, authenticated
    USING (is_published = true OR is_coming_soon = true OR is_admin());

DROP POLICY IF EXISTS "Public can view published exams" ON exams;
CREATE POLICY "Public can view published or coming_soon exams"
    ON exams FOR SELECT
    TO anon, authenticated
    USING (is_published = true OR is_coming_soon = true OR is_admin());

-- 4. Update exam_questions policy to also allow viewing questions of coming_soon exams
DROP POLICY IF EXISTS "Public can view questions of published exams" ON exam_questions;
CREATE POLICY "Public can view questions of published or coming_soon exams"
    ON exam_questions FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM exams
            WHERE exams.id = exam_questions.exam_id
            AND (exams.is_published = true OR exams.is_coming_soon = true OR is_admin())
        )
    );
