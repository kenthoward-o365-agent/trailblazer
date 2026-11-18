// Payment integration types for PCI-compliant Adyen integration

export type PaymentGatewayMode = 'mock' | 'test' | 'live';
export type TokenStatus = 'active' | 'expired' | 'failed';
export type AuthorizationStatus = 'active' | 'partially_captured' | 'fully_captured' | 'cancelled' | 'expired';
export type TransactionType = 'tokenization' | 'authorization' | 'incremental_auth' | 'capture' | 'partial_capture' | 'sale' | 'refund' | 'void';
export type TransactionStatus = 'pending' | 'success' | 'failed' | 'cancelled';
export type PaymentSource = 'pms' | 'booking_engine' | 'ota';

export interface PaymentConfig {
  mode: PaymentGatewayMode;
  clientKey?: string;
  environment?: 'test' | 'live';
  merchantAccount?: string;
}

export interface PaymentCard {
  id: string;
  propertyId: string;
  reservationId?: string;
  ledgerAccountId?: string;
  guestId?: string;
  cardSequence: number;
  cardBrand: string;
  lastFourDigits: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  tokenStatus: TokenStatus;
  isMock: boolean;
  isPrimary: boolean;
  adyenShopperReference?: string;
  adyenRecurringReference?: string;
  createdAt: string;
}

export interface PaymentAuthorization {
  id: string;
  propertyId: string;
  ledgerAccountId: string;
  paymentCardId: string;
  originalAmount: number;
  currentAmount: number;
  capturedAmount: number;
  currency: string;
  status: AuthorizationStatus;
  adyenPspReference?: string;
  adyenAuthCode?: string;
  expiresAt?: string;
  isMock: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  // Joined data
  paymentCard?: PaymentCard;
}

export interface PaymentTransaction {
  id: string;
  propertyId: string;
  reservationId?: string;
  ledgerAccountId?: string;
  paymentCardId?: string;
  authorizationId?: string;
  amount: number;
  currency: string;
  transactionType: TransactionType;
  status: TransactionStatus;
  adyenPspReference?: string;
  gatewayResponse?: Record<string, unknown>;
  source: PaymentSource;
  isMock: boolean;
  folioPostingId?: string;
  createdAt: string;
  createdByName?: string;
}

// Request/Response types for edge functions
export interface TokenizeRequest {
  propertyId: string;
  reservationId?: string;
  ledgerAccountId?: string;
  guestId?: string;
  cardSequence?: number;
  cardData: {
    cardNumber: string;
    cardholderName: string;
    expiryMonth: string;
    expiryYear: string;
    cvc?: string;
  };
  source?: PaymentSource;
}

export interface TokenizeResponse {
  success: boolean;
  cardId?: string;
  error?: string;
  isMock: boolean;
}

export interface AuthorizeRequest {
  propertyId: string;
  cardId: string;
  ledgerAccountId: string;
  amount: number;
  currency?: string;
  source?: PaymentSource;
}

export interface AuthorizeResponse {
  success: boolean;
  authorizationId?: string;
  pspReference?: string;
  authCode?: string;
  error?: string;
  isMock: boolean;
}

export interface IncrementalAuthRequest {
  propertyId: string;
  authorizationId: string;
  newAmount: number;
}

export interface IncrementalAuthResponse {
  success: boolean;
  newAmount?: number;
  pspReference?: string;
  error?: string;
  isMock: boolean;
}

export interface CaptureRequest {
  propertyId: string;
  authorizationId: string;
  amount: number;
  ledgerAccountId?: string;
}

export interface CaptureResponse {
  success: boolean;
  transactionId?: string;
  pspReference?: string;
  capturedAmount?: number;
  error?: string;
  isMock: boolean;
}

export interface SaleRequest {
  propertyId: string;
  cardId: string;
  amount: number;
  currency?: string;
  reservationId?: string;
  ledgerAccountId?: string;
  source?: PaymentSource;
}

export interface SaleResponse {
  success: boolean;
  transactionId?: string;
  pspReference?: string;
  error?: string;
  isMock: boolean;
}

export interface RefundRequest {
  propertyId: string;
  transactionId: string;
  amount: number;
}

export interface RefundResponse {
  success: boolean;
  refundTransactionId?: string;
  pspReference?: string;
  error?: string;
  isMock: boolean;
}

export interface VoidRequest {
  propertyId: string;
  authorizationId: string;
}

export interface VoidResponse {
  success: boolean;
  error?: string;
  isMock: boolean;
}

// Test card patterns for mock mode
export const TEST_CARDS = {
  SUCCESS: '4111111111111111',
  DECLINED: '4000000000000002',
  INSUFFICIENT_FUNDS: '4000000000009995',
  EXPIRED_CARD: '4000000000000069',
  INVALID_CVV: '4000000000000127',
} as const;

export const getTestCardResult = (cardNumber: string): { approved: boolean; declineReason?: string } => {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  
  if (cleanNumber === TEST_CARDS.DECLINED) {
    return { approved: false, declineReason: 'Card declined' };
  }
  if (cleanNumber === TEST_CARDS.INSUFFICIENT_FUNDS) {
    return { approved: false, declineReason: 'Insufficient funds' };
  }
  if (cleanNumber === TEST_CARDS.EXPIRED_CARD) {
    return { approved: false, declineReason: 'Expired card' };
  }
  if (cleanNumber === TEST_CARDS.INVALID_CVV) {
    return { approved: false, declineReason: 'Invalid CVV' };
  }
  
  // All other valid card numbers succeed
  return { approved: true };
};

export const detectCardBrand = (cardNumber: string): string => {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  
  if (/^4/.test(cleanNumber)) return 'visa';
  if (/^5[1-5]/.test(cleanNumber)) return 'mastercard';
  if (/^3[47]/.test(cleanNumber)) return 'amex';
  if (/^6(?:011|5)/.test(cleanNumber)) return 'discover';
  if (/^35(?:2[89]|[3-8])/.test(cleanNumber)) return 'jcb';
  if (/^3(?:0[0-5]|[68])/.test(cleanNumber)) return 'diners';
  
  return 'unknown';
};

export const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(' ') : cleaned;
};

export const validateCardNumber = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(cleaned)) return false;
  
  // Luhn algorithm
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

export const validateExpiry = (month: string, year: string): boolean => {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  
  if (isNaN(m) || isNaN(y)) return false;
  if (m < 1 || m > 12) return false;
  
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  
  if (y < currentYear) return false;
  if (y === currentYear && m < currentMonth) return false;
  
  return true;
};
