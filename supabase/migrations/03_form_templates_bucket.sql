-- Create form-templates storage bucket for official Cal/OSHA forms
-- Run this in Supabase SQL Editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-templates',
  'form-templates',
  false,  -- private — only authenticated users
  10485760,  -- 10MB limit per file
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Only admins can upload/update form templates
CREATE POLICY "Admins can manage form templates"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'form-templates'
  AND auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'form-templates'
  AND auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
);

-- Admins and dispatchers can read/download form templates
CREATE POLICY "Staff can read form templates"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'form-templates'
  AND auth.uid() IN (
    SELECT id FROM public.users WHERE role IN ('admin', 'dispatcher')
  )
);
