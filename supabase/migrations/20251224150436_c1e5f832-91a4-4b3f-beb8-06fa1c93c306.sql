-- Add payment_type column to accounts table for BIN auto-recognition
-- This allows users to explicitly define which payment type an account handles
ALTER TABLE public.accounts 
ADD COLUMN payment_type text;

-- Add a comment explaining the purpose
COMMENT ON COLUMN public.accounts.payment_type IS 'Payment type for auto-selecting accounts based on card brand (visa, mastercard, amex, discover, cash, check, etc.)';