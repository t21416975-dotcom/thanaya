-- Migration: In-App Notifications & Web Push Subscriptions
-- Description: Adds tables and policies for in-app announcements and Web Push notifications

-- 1. Notifications Table (In-app Bell, Top Banner, Popups)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    type TEXT NOT NULL DEFAULT 'bell' CHECK (type IN ('bell', 'banner', 'popup')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_active_type ON notifications(is_active, type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE TRIGGER set_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Web Push Subscriptions Table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Notifications Policies
CREATE POLICY "Public can view active notifications"
    ON notifications FOR SELECT
    TO anon, authenticated
    USING ((is_active = true AND (expires_at IS NULL OR expires_at > NOW())) OR is_admin());

CREATE POLICY "Admins can insert notifications"
    ON notifications FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update notifications"
    ON notifications FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "Admins can delete notifications"
    ON notifications FOR DELETE
    TO authenticated
    USING (is_admin());

-- Push Subscriptions Policies
-- Anyone (students without login) can subscribe
CREATE POLICY "Public can insert push subscriptions"
    ON push_subscriptions FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Anyone can unsubscribe their own endpoint
CREATE POLICY "Public can delete push subscriptions"
    ON push_subscriptions FOR DELETE
    TO anon, authenticated
    USING (true);

-- Admins can view subscriptions list (to count / broadcast)
CREATE POLICY "Admins can view push subscriptions"
    ON push_subscriptions FOR SELECT
    TO authenticated
    USING (is_admin());
