-- Add NO_SHOW status to reservation_status enum
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'NO_SHOW';