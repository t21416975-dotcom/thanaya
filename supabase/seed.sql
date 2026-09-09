-- Seed Data for Thanaya Platform

-- 1. Insert Initial Subjects (Egyptian High School / Thanaweya Amma)
INSERT INTO subjects (id, name, slug, icon, description, order_index, is_active)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'اللغة العربية', 'arabic', 'book-open', 'منهج اللغة العربية والنصوص والنحو والبلاغة والأدب', 1, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'اللغة الإنجليزية', 'english', 'languages', 'منهج اللغة الإنجليزية والقصة والقواعد', 2, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'الرياضيات البحتة', 'pure-math', 'calculator', 'الجبر والهندسة الفراغية والتفاضل والتكامل', 3, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'الرياضيات التطبيقية', 'applied-math', 'compass', 'الاستاتيكا والديناميكا', 4, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'الفيزياء', 'physics', 'zap', 'الكهربية والمغناطيسية والفيزياء الحديثة', 5, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'الكيمياء', 'chemistry', 'flask-conical', 'الكيمياء العضوية والتحليلية والكهربية', 6, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'الأحياء', 'biology', 'dna', 'الدعامة والحركة والهرمونات والتكاثر والـDNA', 7, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'الجيولوجيا وعلوم البيئة', 'geology', 'mountain', 'الجيولوجيا والظواهر الطبيعية وعلوم البيئة', 8, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'التاريخ', 'history', 'hourglass', 'تاريخ مصر والعالم الحديث والمعاصر', 9, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'الجغرافيا السياسية', 'geography', 'globe', 'الجغرافيا السياسية وتطور خريطة العالم', 10, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'الفلسفة والمنطق', 'philosophy', 'lightbulb', 'الفلسفة وقضايا العصر والمنطق التطبيقي', 11, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'علم النفس والاجتماع', 'psychology', 'brain', 'علم النفس ونظريات التعلم وعلم الاجتماع', 12, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'البرمجة وتكنولوجيا المعلومات', 'programming', 'code', 'مادة البرمجة والذكاء الاصطناعي الحديثة', 13, true)
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert Initial Content Types (Dynamically extensible by Admin)
INSERT INTO content_types (id, name, slug, description, order_index, is_active)
VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'التقييمات الأسبوعية', 'weekly-assessments', 'تقييمات الأداء الأسبوعية الصادرة من وزارة التربية والتعليم', 1, true),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'حلول التقييمات', 'assessment-solutions', 'إجابات ونماذج حل التقييمات الأسبوعية مع فيديو الشرح', 2, true),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'الامتحانات التجريبية', 'mock-exams', 'نماذج امتحانات تجريبية شاملة على الفصول والمنهج', 3, true),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'المذكرات الدراسية', 'study-notes', 'مذكرات الشرح وتلخيصات الفصول', 4, true),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b15', 'المراجعات النهائية', 'final-revisions', 'ليالي الامتحان والمراجعات المركزة', 5, true)
ON CONFLICT (slug) DO NOTHING;

-- 3. Insert Weeks (Term 1 & Term 2)
INSERT INTO weeks (id, week_number, title, term)
VALUES
    -- Term 1
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 1, 'الأسبوع الأول', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 2, 'الأسبوع الثاني', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 3, 'الأسبوع الثالث', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c04', 4, 'الأسبوع الرابع', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', 5, 'الأسبوع الخامس', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c06', 6, 'الأسبوع السادس', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c07', 7, 'الأسبوع السابع', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c08', 8, 'الأسبوع الثامن', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c09', 9, 'الأسبوع التاسع', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c10', 10, 'الأسبوع العاشر', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 11, 'الأسبوع الحادي عشر', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 12, 'الأسبوع الثاني عشر', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', 13, 'الأسبوع الثالث عشر', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 14, 'الأسبوع الرابع عشر', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c15', 15, 'الأسبوع الخامس عشر', 1),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c16', 16, 'الأسبوع السادس عشر', 1)
ON CONFLICT (term, week_number) DO NOTHING;

-- 4. Insert Default Ad Slots
INSERT INTO ad_slots (id, name, position, is_active, slot_type)
VALUES
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'إعلان أعلى الصفحة الرئيسية', 'homepage_top', true, 'google'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d02', 'إعلان منتصف الصفحة الرئيسية', 'homepage_middle', true, 'google'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d03', 'إعلان صفحة المادة', 'subject_page', true, 'google'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d04', 'إعلان صفحة المورد (بعد التفاصيل)', 'resource_after_meta', true, 'google'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d05', 'إعلان أسفل الموقع (Footer)', 'footer', true, 'google')
ON CONFLICT (position) DO NOTHING;
