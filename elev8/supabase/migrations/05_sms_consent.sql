-- ============================================================
-- Migration 05: SMS consent tracking on users table
-- ============================================================
-- Adds four columns required for CTIA-compliant A2P 10DLC SMS
-- consent management on the Elev8 Comply client portal.
--
-- sms_consent_given      – true once the user actively opts in
-- sms_consent_given_at   – timestamp of opt-in (for audit trail)
-- sms_phone              – the mobile number they consented with
--                          (may differ from the work `phone` field)
-- sms_consent_revoked_at – set when user revokes; null = active
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sms_consent_given      BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_given_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_phone              VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sms_consent_revoked_at TIMESTAMPTZ;

-- Useful index: quickly find users who have active SMS consent
CREATE INDEX IF NOT EXISTS users_sms_consent_idx
  ON public.users (sms_consent_given)
  WHERE sms_consent_given = true;
