-- Convert birthday and anniversary from DATE to TEXT (MM-DD format)
-- This preserves only the month and day, removing the year component

ALTER TABLE guests 
  ALTER COLUMN birthday TYPE TEXT USING CASE WHEN birthday IS NOT NULL THEN TO_CHAR(birthday, 'MM-DD') ELSE NULL END,
  ALTER COLUMN anniversary TYPE TEXT USING CASE WHEN anniversary IS NOT NULL THEN TO_CHAR(anniversary, 'MM-DD') ELSE NULL END;

COMMENT ON COLUMN guests.birthday IS 'Birthday as MM-DD (month-day only)';
COMMENT ON COLUMN guests.anniversary IS 'Anniversary as MM-DD (month-day only)';