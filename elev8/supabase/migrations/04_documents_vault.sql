-- ─── Document Vault ──────────────────────────────────────────────────────────
-- Central table tracking every file that enters or exits the system:
-- original Cal/OSHA notice PDFs, generated compliance forms (EU-632, EU-787,
-- 48-hr advance notice), proposals, and work orders.
--
-- storageBucket: 'notices' for original notice PDFs (existing bucket)
--               'documents' for all generated forms (new bucket below)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enum for document types
CREATE TYPE document_type AS ENUM (
  'notice_pdf',
  'eu632',
  'eu787',
  'eu776a',
  'eu776b',
  'dosh100',
  'advance_notice_48hr',
  'proposal_pdf',
  'work_order_pdf'
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  property_id       UUID        REFERENCES properties(id) ON DELETE SET NULL,
  notice_id         UUID        REFERENCES notices(id) ON DELETE SET NULL,
  job_id            UUID        REFERENCES jobs(id) ON DELETE SET NULL,
  document_type     document_type NOT NULL,
  storage_bucket    TEXT        NOT NULL,
  storage_path      TEXT        NOT NULL,
  file_name         TEXT        NOT NULL,
  mime_type         TEXT        NOT NULL DEFAULT 'application/pdf',
  file_size_bytes   INTEGER,
  generated_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookup patterns
CREATE INDEX idx_documents_account_id  ON documents(account_id);
CREATE INDEX idx_documents_property_id ON documents(property_id);
CREATE INDEX idx_documents_notice_id   ON documents(notice_id);
CREATE INDEX idx_documents_job_id      ON documents(job_id);
CREATE INDEX idx_documents_created_at  ON documents(created_at DESC);

-- RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Users can read documents belonging to their account
CREATE POLICY "users_read_own_account_documents" ON documents
  FOR SELECT USING (
    account_id IN (
      SELECT account_id FROM users WHERE id = auth.uid()
    )
  );

-- Only service role can insert / update / delete
-- (all writes go through server actions with createServiceClient)
CREATE POLICY "service_role_full_access_documents" ON documents
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Supabase Storage: 'documents' bucket ────────────────────────────────────
-- Separate from the 'notices' bucket (which holds original uploaded notice PDFs).
-- Generated compliance forms, proposals, and work orders go here.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 26214400, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can read files in their account's folder
-- The folder structure is: {accountId}/{filename}
CREATE POLICY "authenticated_read_own_documents" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT account_id::text FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "service_role_full_access_documents_storage" ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'documents');
