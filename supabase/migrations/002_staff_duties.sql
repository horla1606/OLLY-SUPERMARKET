-- =============================================
-- Migration 002: Staff duties + order assignment
-- Run in Supabase SQL Editor
-- =============================================

-- Duty roster table
CREATE TABLE IF NOT EXISTS staff_duties (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id   UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- Track which staff member fulfilled an order
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  assigned_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE staff_duties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_duties_manager_all" ON staff_duties;
CREATE POLICY "staff_duties_manager_all" ON staff_duties
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

-- Index for date lookups
CREATE INDEX IF NOT EXISTS idx_staff_duties_date     ON staff_duties(date);
CREATE INDEX IF NOT EXISTS idx_staff_duties_staff_id ON staff_duties(staff_id);
