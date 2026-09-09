-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Helper trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper function to check if current authenticated user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_slug ON subjects(slug);
CREATE INDEX IF NOT EXISTS idx_subjects_active_order ON subjects(is_active, order_index);

CREATE TRIGGER set_subjects_updated_at
    BEFORE UPDATE ON subjects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Content Types Table (Admin can add any type dynamically)
CREATE TABLE IF NOT EXISTS content_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_types_slug ON content_types(slug);
CREATE INDEX IF NOT EXISTS idx_content_types_active_order ON content_types(is_active, order_index);

CREATE TRIGGER set_content_types_updated_at
    BEFORE UPDATE ON content_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Weeks Table
CREATE TABLE IF NOT EXISTS weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    term INTEGER NOT NULL DEFAULT 1 CHECK (term IN (1, 2)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_weeks_term_number UNIQUE (term, week_number)
);

CREATE INDEX IF NOT EXISTS idx_weeks_term_number ON weeks(term, week_number);

-- 6. Resources Table
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    content_type_id UUID NOT NULL REFERENCES content_types(id) ON DELETE RESTRICT,
    week_id UUID REFERENCES weeks(id) ON DELETE SET NULL,
    pdf_url TEXT NOT NULL,
    youtube_url TEXT,
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    views_count BIGINT NOT NULL DEFAULT 0,
    downloads_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_resources_subject_content_slug UNIQUE (subject_id, content_type_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_resources_lookup ON resources(subject_id, content_type_id, is_published);
CREATE INDEX IF NOT EXISTS idx_resources_slug ON resources(slug);
CREATE INDEX IF NOT EXISTS idx_resources_week ON resources(week_id);
CREATE INDEX IF NOT EXISTS idx_resources_published_at ON resources(is_published, published_at DESC);

CREATE TRIGGER set_resources_updated_at
    BEFORE UPDATE ON resources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Reports Problem Table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    issue_type TEXT NOT NULL CHECK (issue_type IN ('broken_file', 'broken_link', 'incorrect_content', 'outdated', 'other')),
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_resource ON reports(resource_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);

-- 8. Ad Slots Table
CREATE TABLE IF NOT EXISTS ad_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    position TEXT NOT NULL UNIQUE CHECK (position IN ('homepage_top', 'homepage_middle', 'subject_page', 'resource_after_meta', 'footer')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    slot_type TEXT NOT NULL DEFAULT 'google' CHECK (slot_type IN ('google', 'direct', 'fallback')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_slots_position ON ad_slots(position, is_active);

CREATE TRIGGER set_ad_slots_updated_at
    BEFORE UPDATE ON ad_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Direct Advertisements Table
CREATE TABLE IF NOT EXISTS direct_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_name TEXT NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    slot_position TEXT NOT NULL REFERENCES ad_slots(position) ON DELETE CASCADE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    impressions_count BIGINT NOT NULL DEFAULT 0,
    clicks_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_ads_active_slot ON direct_ads(slot_position, is_active, start_date, end_date);

CREATE TRIGGER set_direct_ads_updated_at
    BEFORE UPDATE ON direct_ads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_ads ENABLE ROW LEVEL SECURITY;

-- Admins Table Policies
CREATE POLICY "Admins can view admins list"
    ON admins FOR SELECT
    TO authenticated
    USING (is_admin());

CREATE POLICY "Super admins can manage admins"
    ON admins FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admins WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Subjects Policies
CREATE POLICY "Public can view active subjects"
    ON subjects FOR SELECT
    TO anon, authenticated
    USING (is_active = true OR is_admin());

CREATE POLICY "Admins can insert subjects"
    ON subjects FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update subjects"
    ON subjects FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "Admins can delete subjects"
    ON subjects FOR DELETE
    TO authenticated
    USING (is_admin());

-- Content Types Policies
CREATE POLICY "Public can view active content types"
    ON content_types FOR SELECT
    TO anon, authenticated
    USING (is_active = true OR is_admin());

CREATE POLICY "Admins can insert content types"
    ON content_types FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update content types"
    ON content_types FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "Admins can delete content types"
    ON content_types FOR DELETE
    TO authenticated
    USING (is_admin());

-- Weeks Policies
CREATE POLICY "Public can view weeks"
    ON weeks FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Admins can insert weeks"
    ON weeks FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update weeks"
    ON weeks FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "Admins can delete weeks"
    ON weeks FOR DELETE
    TO authenticated
    USING (is_admin());

-- Resources Policies
CREATE POLICY "Public can view published resources"
    ON resources FOR SELECT
    TO anon, authenticated
    USING (is_published = true OR is_admin());

CREATE POLICY "Admins can insert resources"
    ON resources FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update resources"
    ON resources FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "Admins can delete resources"
    ON resources FOR DELETE
    TO authenticated
    USING (is_admin());

-- Reports Policies
CREATE POLICY "Admins can view all reports"
    ON reports FOR SELECT
    TO authenticated
    USING (is_admin());

CREATE POLICY "Public and users can submit reports"
    ON reports FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Admins can update reports"
    ON reports FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "Admins can delete reports"
    ON reports FOR DELETE
    TO authenticated
    USING (is_admin());

-- Ad Slots Policies
CREATE POLICY "Public can view active ad slots"
    ON ad_slots FOR SELECT
    TO anon, authenticated
    USING (is_active = true OR is_admin());

CREATE POLICY "Admins can manage ad slots"
    ON ad_slots FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- Direct Ads Policies
CREATE POLICY "Public can view running direct ads"
    ON direct_ads FOR SELECT
    TO anon, authenticated
    USING (
        (is_active = true AND NOW() BETWEEN start_date AND end_date)
        OR is_admin()
    );

CREATE POLICY "Admins can manage direct ads"
    ON direct_ads FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

--------------------------------------------------------------------------------
-- SECURE RPC FUNCTIONS FOR ANALYTICS AND COUNTERS
--------------------------------------------------------------------------------

-- Secure increment for Resource Views
CREATE OR REPLACE FUNCTION increment_resource_views(p_resource_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE resources
    SET views_count = views_count + 1
    WHERE id = p_resource_id AND is_published = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure increment for Resource Downloads
CREATE OR REPLACE FUNCTION increment_resource_downloads(p_resource_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE resources
    SET downloads_count = downloads_count + 1
    WHERE id = p_resource_id AND is_published = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure increment for Direct Ad Impressions
CREATE OR REPLACE FUNCTION increment_ad_impressions(p_ad_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE direct_ads
    SET impressions_count = impressions_count + 1
    WHERE id = p_ad_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure increment for Direct Ad Clicks
CREATE OR REPLACE FUNCTION increment_ad_clicks(p_ad_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE direct_ads
    SET clicks_count = clicks_count + 1
    WHERE id = p_ad_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
