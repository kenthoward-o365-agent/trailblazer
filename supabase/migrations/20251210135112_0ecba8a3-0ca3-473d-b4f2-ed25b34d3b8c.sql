-- Add audit_date column to properties table
-- This represents the current business date that only advances when Day-End Close is completed
ALTER TABLE properties ADD COLUMN IF NOT EXISTS audit_date date DEFAULT CURRENT_DATE;

-- Initialize with today's date for existing properties
UPDATE properties SET audit_date = CURRENT_DATE WHERE audit_date IS NULL;