-- Migration: Security Hardening & Constraints Fixes
-- Addresses CRIT-2, HIGH-7, and MED-3 from security audit

-- 1. MED-3: Enforce maximum length of 2000 characters on reports.details
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reports_details_length'
    ) THEN
        ALTER TABLE reports ADD CONSTRAINT reports_details_length CHECK (details IS NULL OR char_length(details) <= 2000);
    END IF;
END $$;

-- 2. CRIT-2: Clean up any plaintext Gemini API keys stored in database
DELETE FROM system_settings WHERE key = 'gemini_api_key';

-- 3. HIGH-7: Hardening is_admin() SECURITY DEFINER function with explicit search_path
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
