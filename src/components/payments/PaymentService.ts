// Payment Service - Abstraction layer for all payment operations
import { supabase } from "@/integrations/supabase/client";
import type {
  PaymentConfig,
  TokenizeRequest,
  TokenizeResponse,
  AuthorizeRequest,
  AuthorizeResponse,
  IncrementalAuthRequest,
  IncrementalAuthResponse,
  CaptureRequest,
  CaptureResponse,
  SaleRequest,
  SaleResponse,
  RefundRequest,
  RefundResponse,
  VoidRequest,
  VoidResponse,
  PaymentAuthorization,
  PaymentTransaction,
  PaymentCard,
  TokenStatus,
  AuthorizationStatus,
  TransactionType,
  TransactionStatus,
  PaymentSource,
} from "./types";

class PaymentServiceClass {
  /**
   * Get payment configuration for a property
   */
  async getConfig(propertyId: string): Promise<PaymentConfig> {
    const { data, error } = await supabase.functions.invoke('payment-config', {
      body: { propertyId }
    });

    if (error) {
      console.error('Error fetching payment config:', error);
      throw new Error('Failed to fetch payment configuration');
    }

    return data;
  }

  /**
   * Tokenize a card for future use
   */
  async tokenizeCard(request: TokenizeRequest): Promise<TokenizeResponse> {
    const { data, error } = await supabase.functions.invoke('process-payment', {
      body: {
        action: 'tokenize',
        ...request
      }
    });

    if (error) {
      console.error('Error tokenizing card:', error);
      return { success: false, error: 'Failed to save card', isMock: false };
    }

    return data;
  }

  /**
   * Create a pre-authorization (hold) on a card
   */
  async authorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {
    const { data, error } = await supabase.functions.invoke('process-payment', {
      body: {
        action: 'authorize',
        ...request
      }
    });

    if (error) {
      console.error('Error creating authorization:', error);
      return { success: false, error: 'Failed to authorize card', isMock: false };
    }

    return data;
  }

  /**
   * Increase an existing authorization amount
   */
  async incrementalAuth(request: IncrementalAuthRequest): Promise<IncrementalAuthResponse> {
    const { data, error } = await supabase.functions.invoke('process-payment', {
      body: {
        action: 'incremental_auth',
        ...request
      }
    });

    if (error) {
      console.error('Error increasing authorization:', error);
      return { success: false, error: 'Failed to increase authorization', isMock: false };
    }

    return data;
  }

  /**
   * Capture (settle) an authorization - full or partial
   */
  async capture(request: CaptureRequest): Promise<CaptureResponse> {
    const { data, error } = await supabase.functions.invoke('process-payment', {
      body: {
        action: 'capture',
        ...request
      }
    });

    if (error) {
      console.error('Error capturing authorization:', error);
      return { success: false, error: 'Failed to capture payment', isMock: false };
    }

    return data;
  }

  /**
   * Direct sale (charge) a card - used for advance deposits
   */
  async sale(request: SaleRequest): Promise<SaleResponse> {
    const { data, error } = await supabase.functions.invoke('process-payment', {
      body: {
        action: 'sale',
        ...request
      }
    });

    if (error) {
      console.error('Error processing sale:', error);
      return { success: false, error: 'Failed to charge card', isMock: false };
    }

    return data;
  }

  /**
   * Refund a captured transaction
   */
  async refund(request: RefundRequest): Promise<RefundResponse> {
    const { data, error } = await supabase.functions.invoke('process-payment', {
      body: {
        action: 'refund',
        ...request
      }
    });

    if (error) {
      console.error('Error processing refund:', error);
      return { success: false, error: 'Failed to process refund', isMock: false };
    }

    return data;
  }

  /**
   * Void an unused authorization
   */
  async voidAuth(request: VoidRequest): Promise<VoidResponse> {
    const { data, error } = await supabase.functions.invoke('process-payment', {
      body: {
        action: 'void',
        ...request
      }
    });

    if (error) {
      console.error('Error voiding authorization:', error);
      return { success: false, error: 'Failed to void authorization', isMock: false };
    }

    return data;
  }

  /**
   * Get cards for a reservation/folio
   */
  async getCards(params: { 
    reservationId?: string; 
    ledgerAccountId?: string;
    propertyId?: string;
  }): Promise<PaymentCard[]> {
    let query = supabase
      .from('payment_cards')
      .select('*')
      .order('card_sequence', { ascending: true });

    if (params.reservationId) {
      query = query.eq('reservation_id', params.reservationId);
    }
    if (params.ledgerAccountId) {
      query = query.eq('ledger_account_id', params.ledgerAccountId);
    }
    if (params.propertyId) {
      query = query.eq('property_id', params.propertyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching cards:', error);
      return [];
    }

    return (data || []).map(card => ({
      id: card.id,
      propertyId: card.property_id,
      reservationId: card.reservation_id,
      ledgerAccountId: card.ledger_account_id,
      guestId: card.guest_id,
      cardSequence: card.card_sequence || 1,
      cardBrand: card.card_brand,
      lastFourDigits: card.last_four_digits,
      cardholderName: card.cardholder_name,
      expiryMonth: card.expiry_month,
      expiryYear: card.expiry_year,
      tokenStatus: (card.token_status || 'active') as TokenStatus,
      isMock: card.is_mock || false,
      isPrimary: card.is_primary || false,
      adyenShopperReference: card.adyen_shopper_reference,
      adyenRecurringReference: card.adyen_recurring_reference,
      createdAt: card.created_at,
    })) as PaymentCard[];
  }

  /**
   * Get active authorizations for a folio
   */
  async getAuthorizations(ledgerAccountId: string): Promise<PaymentAuthorization[]> {
    const { data, error } = await supabase
      .from('payment_authorizations')
      .select(`
        *,
        payment_cards (
          id,
          card_brand,
          last_four_digits,
          cardholder_name
        )
      `)
      .eq('ledger_account_id', ledgerAccountId)
      .in('status', ['active', 'partially_captured'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching authorizations:', error);
      return [];
    }

    return (data || []).map(auth => ({
      id: auth.id,
      propertyId: auth.property_id,
      ledgerAccountId: auth.ledger_account_id,
      paymentCardId: auth.payment_card_id,
      originalAmount: parseFloat(String(auth.original_amount)),
      currentAmount: parseFloat(String(auth.current_amount)),
      capturedAmount: parseFloat(String(auth.captured_amount || 0)),
      currency: auth.currency,
      status: auth.status as AuthorizationStatus,
      adyenPspReference: auth.adyen_psp_reference,
      adyenAuthCode: auth.adyen_auth_code,
      expiresAt: auth.expires_at,
      isMock: auth.is_mock,
      createdAt: auth.created_at,
      updatedAt: auth.updated_at,
      createdByName: auth.created_by_name,
      paymentCard: auth.payment_cards ? {
        id: auth.payment_cards.id,
        cardBrand: auth.payment_cards.card_brand,
        lastFourDigits: auth.payment_cards.last_four_digits,
        cardholderName: auth.payment_cards.cardholder_name,
      } as PaymentCard : undefined,
    })) as PaymentAuthorization[];
  }

  /**
   * Get transaction history for a folio or reservation
   */
  async getTransactions(params: {
    reservationId?: string;
    ledgerAccountId?: string;
    propertyId?: string;
  }): Promise<PaymentTransaction[]> {
    let query = supabase
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (params.reservationId) {
      query = query.eq('reservation_id', params.reservationId);
    }
    if (params.ledgerAccountId) {
      query = query.eq('ledger_account_id', params.ledgerAccountId);
    }
    if (params.propertyId) {
      query = query.eq('property_id', params.propertyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }

    return (data || []).map(tx => ({
      id: tx.id,
      propertyId: tx.property_id,
      reservationId: tx.reservation_id,
      ledgerAccountId: tx.ledger_account_id,
      paymentCardId: tx.payment_card_id,
      authorizationId: tx.authorization_id,
      amount: parseFloat(String(tx.amount)),
      currency: tx.currency,
      transactionType: tx.transaction_type as TransactionType,
      status: tx.status as TransactionStatus,
      adyenPspReference: tx.adyen_psp_reference,
      gatewayResponse: tx.gateway_response as Record<string, unknown>,
      source: tx.source as PaymentSource,
      isMock: tx.is_mock,
      folioPostingId: tx.folio_posting_id,
      createdAt: tx.created_at,
      createdByName: tx.created_by_name,
    })) as PaymentTransaction[];
  }

  /**
   * Delete a card (only if no active authorizations)
   */
  async deleteCard(cardId: string): Promise<{ success: boolean; error?: string }> {
    // Check for active authorizations first
    const { data: auths } = await supabase
      .from('payment_authorizations')
      .select('id')
      .eq('payment_card_id', cardId)
      .in('status', ['active', 'partially_captured'])
      .limit(1);

    if (auths && auths.length > 0) {
      return { success: false, error: 'Cannot delete card with active authorizations' };
    }

    const { error } = await supabase
      .from('payment_cards')
      .delete()
      .eq('id', cardId);

    if (error) {
      console.error('Error deleting card:', error);
      return { success: false, error: 'Failed to delete card' };
    }

    return { success: true };
  }

  /**
   * Set a card as primary
   */
  async setPrimaryCard(cardId: string, reservationId: string): Promise<{ success: boolean; error?: string }> {
    // First, unset all primary cards for this reservation
    await supabase
      .from('payment_cards')
      .update({ is_primary: false })
      .eq('reservation_id', reservationId);

    // Then set the selected card as primary
    const { error } = await supabase
      .from('payment_cards')
      .update({ is_primary: true })
      .eq('id', cardId);

    if (error) {
      console.error('Error setting primary card:', error);
      return { success: false, error: 'Failed to set primary card' };
    }

    return { success: true };
  }
}

export const PaymentService = new PaymentServiceClass();
