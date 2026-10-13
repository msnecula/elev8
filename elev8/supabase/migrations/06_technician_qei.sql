-- ============================================================
-- Migration 06: Per-technician QEI number on technicians table
-- ============================================================
-- QEI (Qualified Elevator Inspector) numbers are assigned to
-- individual inspectors, not to the company. Storing them here
-- lets the system auto-fill the QEI field on Cal/OSHA forms
-- (EU-630, EU-632, DOSH-100, etc.) from the assigned technician's
-- record rather than a shared environment variable.
-- ============================================================

ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS qei_number VARCHAR(50);

-- Optional index: look up technicians by QEI number
CREATE INDEX IF NOT EXISTS technicians_qei_number_idx
  ON public.technicians (qei_number)
  WHERE qei_number IS NOT NULL;
