-- Add external_account column for accounting export integration
ALTER TABLE accounts 
ADD COLUMN external_account TEXT NULL;

COMMENT ON COLUMN accounts.external_account IS 'Maps to external accounting system account code/reference';