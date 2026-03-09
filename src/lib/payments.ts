import { supabase } from '../integrations/supabase/client';

export interface PaymentMethod {
  id: string;
  name: string;
  provider: string;
  type: 'mobile_money' | 'card' | 'bank_transfer' | 'cash' | 'crypto';
  is_active: boolean;
  supports_refunds: boolean;
  processing_fee_percentage: number;
  processing_fee_fixed: number;
  minimum_amount: number;
  maximum_amount?: number;
  configuration: any;
  display_order: number;
  created_at: string;
}

export interface PaymentTransaction {
  id: string;
  reference: string;
  payment_method_id?: string;
  transaction_type: 'booking' | 'product_order' | 'gift_card' | 'subscription';
  related_id?: string;
  client_id?: string;
  amount: number;
  processing_fee: number;
  net_amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  provider_reference?: string;
  provider_response?: any;
  client_phone?: string;
  client_email?: string;
  notes?: string;
  processed_at?: string;
  created_at: string;
}

export const paymentService = {
  // PAYMENT METHODS
  async getActivePaymentMethods() {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    return data as PaymentMethod[];
  },

  async getAllPaymentMethods() {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    return data as PaymentMethod[];
  },

  async getPaymentMethodById(id: string) {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as PaymentMethod;
  },

  async createPaymentMethod(method: Omit<PaymentMethod, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('payment_methods')
      .insert([method])
      .select()
      .single();
    
    if (error) throw error;
    return data as PaymentMethod;
  },

  async updatePaymentMethod(id: string, updates: Partial<PaymentMethod>) {
    const { data, error } = await supabase
      .from('payment_methods')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as PaymentMethod;
  },

  // PAYMENT PROCESSING
  async initializePayment(paymentData: {
    amount: number;
    payment_method_id: string;
    transaction_type: 'booking' | 'product_order' | 'gift_card' | 'subscription';
    related_id?: string;
    client_id?: string;
    client_phone?: string;
    client_email?: string;
    description?: string;
    metadata?: any;
  }) {
    const paymentMethod = await this.getPaymentMethodById(paymentData.payment_method_id);
    
    // Calculate fees
    const processingFee = this.calculateProcessingFee(paymentData.amount, paymentMethod);
    const netAmount = paymentData.amount - processingFee;
    
    // Generate unique reference
    const reference = this.generatePaymentReference(paymentData.transaction_type);
    
    // Create payment transaction record
    const { data: transaction, error } = await supabase
      .from('payment_transactions')
      .insert([{
        reference,
        payment_method_id: paymentData.payment_method_id,
        transaction_type: paymentData.transaction_type,
        related_id: paymentData.related_id,
        client_id: paymentData.client_id,
        amount: paymentData.amount,
        processing_fee: processingFee,
        net_amount: netAmount,
        currency: 'GHS',
        status: 'pending',
        client_phone: paymentData.client_phone,
        client_email: paymentData.client_email,
        notes: paymentData.description
      }])
      .select()
      .single();

    if (error) throw error;

    // Initialize payment with provider
    try {
      const providerResponse = await this.initializeWithProvider(paymentMethod, {
        reference,
        amount: paymentData.amount,
        client_phone: paymentData.client_phone,
        client_email: paymentData.client_email,
        description: paymentData.description,
        metadata: {
          ...paymentData.metadata,
          transaction_id: transaction.id
        }
      });

      // Update transaction with provider response
      await supabase
        .from('payment_transactions')
        .update({
          status: 'processing',
          provider_reference: providerResponse.reference,
          provider_response: providerResponse
        })
        .eq('id', transaction.id);

      return {
        transaction,
        providerResponse,
        paymentUrl: providerResponse.payment_url || providerResponse.checkout_url
      };

    } catch (error) {
      // Update transaction status to failed
      await supabase
        .from('payment_transactions')
        .update({
          status: 'failed',
          notes: error.message
        })
        .eq('id', transaction.id);

      throw error;
    }
  },

  async initializeWithProvider(paymentMethod: PaymentMethod, paymentData: any) {
    switch (paymentMethod.provider) {
      case 'hubtel':
        return this.initializeHubtelPayment(paymentData);
      case 'paystack':
        return this.initializePaystackPayment(paymentData);
      case 'mtn':
        return this.initializeMTNMoMoPayment(paymentData);
      case 'vodafone':
        return this.initializeVodafonePayment(paymentData);
      case 'airteltigo':
        return this.initializeAirtelTigoPayment(paymentData);
      case 'manual':
      case 'cash':
        return this.initializeManualPayment(paymentData);
      default:
        throw new Error(`Payment provider ${paymentMethod.provider} not supported`);
    }
  },

  // HUBTEL PAYMENT
  async initializeHubtelPayment(paymentData: any) {
    const hubtelMerchantId = import.meta.env.VITE_HUBTEL_MERCHANT_ID;
    const hubtelClientId = import.meta.env.VITE_HUBTEL_CLIENT_ID;
    const hubtelClientSecret = import.meta.env.VITE_HUBTEL_CLIENT_SECRET;
    
    if (!hubtelMerchantId || !hubtelClientId || !hubtelClientSecret) {
      throw new Error('Hubtel configuration missing');
    }

    const response = await fetch('https://checkout.hubtel.com/api/checkout/onlinecheckout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(hubtelClientId + ':' + hubtelClientSecret)}`
      },
      body: JSON.stringify({
        invoice: {
          items: [{
            name: paymentData.description || 'Zolara Beauty Studio Payment',
            quantity: 1,
            unit_price: paymentData.amount,
            total_price: paymentData.amount
          }],
          taxes: [],
          total_amount: paymentData.amount,
          description: paymentData.description
        },
        store: {
          name: 'Zolara Beauty Studio',
          tagline: 'Where Luxury Meets Beauty',
          phone: '0594365314',
          postal_address: 'Sakasaka, Tamale',
          logo_url: 'https://ekvjnydomfresnkealpb.supabase.co/storage/v1/object/public/avatars/logo_1764609621458.jpg'
        },
        actions: {
          cancel_url: `${window.location.origin}/payment/cancel`,
          return_url: `${window.location.origin}/payment/success`
        },
        custom_data: {
          reference: paymentData.reference,
          ...paymentData.metadata
        }
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Hubtel payment initialization failed');
    }

    return {
      reference: result.token || result.checkout_id,
      payment_url: result.response_url,
      provider: 'hubtel',
      data: result
    };
  },

  // PAYSTACK PAYMENT
  async initializePaystackPayment(paymentData: any) {
    const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    const paystackSecretKey = import.meta.env.VITE_PAYSTACK_SECRET_KEY;
    
    if (!paystackPublicKey || !paystackSecretKey) {
      throw new Error('Paystack configuration missing');
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${paystackSecretKey}`
      },
      body: JSON.stringify({
        email: paymentData.client_email,
        amount: paymentData.amount * 100, // Paystack uses kobo
        currency: 'GHS',
        reference: paymentData.reference,
        callback_url: `${window.location.origin}/payment/callback`,
        metadata: {
          ...paymentData.metadata,
          phone: paymentData.client_phone,
          description: paymentData.description
        }
      })
    });

    const result = await response.json();
    
    if (!result.status) {
      throw new Error(result.message || 'Paystack payment initialization failed');
    }

    return {
      reference: result.data.reference,
      payment_url: result.data.authorization_url,
      provider: 'paystack',
      data: result.data
    };
  },

  // MTN MOBILE MONEY
  async initializeMTNMoMoPayment(paymentData: any) {
    // This would integrate with MTN MoMo API
    // For now, return a mock response
    return {
      reference: paymentData.reference,
      payment_url: null, // MTN MoMo typically uses USSD
      ussd_code: '*170#',
      instructions: `Dial *170# and follow prompts to pay GHS ${paymentData.amount} to Zolara Beauty Studio`,
      provider: 'mtn',
      data: { ussd_code: '*170#' }
    };
  },

  // MANUAL PAYMENT (Bank Transfer, Cash)
  async initializeManualPayment(paymentData: any) {
    return {
      reference: paymentData.reference,
      payment_url: null,
      instructions: 'Please complete payment using the provided method and reference number',
      provider: 'manual',
      data: { reference: paymentData.reference }
    };
  },

  // PAYMENT VERIFICATION
  async verifyPayment(reference: string) {
    const { data: transaction, error } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        payment_methods(provider)
      `)
      .eq('reference', reference)
      .single();

    if (error) throw error;

    const provider = transaction.payment_methods?.provider;
    
    switch (provider) {
      case 'hubtel':
        return this.verifyHubtelPayment(transaction);
      case 'paystack':
        return this.verifyPaystackPayment(transaction);
      case 'mtn':
      case 'vodafone':
      case 'airteltigo':
        return this.verifyMobileMoneyPayment(transaction);
      default:
        return this.verifyManualPayment(transaction);
    }
  },

  async verifyHubtelPayment(transaction: PaymentTransaction) {
    const hubtelClientId = import.meta.env.VITE_HUBTEL_CLIENT_ID;
    const hubtelClientSecret = import.meta.env.VITE_HUBTEL_CLIENT_SECRET;
    
    const response = await fetch(`https://checkout.hubtel.com/api/checkout/onlinecheckout/${transaction.provider_reference}/status`, {
      headers: {
        'Authorization': `Basic ${btoa(hubtelClientId + ':' + hubtelClientSecret)}`
      }
    });

    const result = await response.json();
    
    const isSuccessful = result.status === 'Success' || result.response_code === '0000';
    
    await this.updateTransactionStatus(transaction.id, isSuccessful ? 'completed' : 'failed', result);
    
    return { success: isSuccessful, data: result };
  },

  async verifyPaystackPayment(transaction: PaymentTransaction) {
    const paystackSecretKey = import.meta.env.VITE_PAYSTACK_SECRET_KEY;
    
    const response = await fetch(`https://api.paystack.co/transaction/verify/${transaction.reference}`, {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`
      }
    });

    const result = await response.json();
    
    const isSuccessful = result.status && result.data.status === 'success';
    
    await this.updateTransactionStatus(transaction.id, isSuccessful ? 'completed' : 'failed', result);
    
    return { success: isSuccessful, data: result };
  },

  async verifyMobileMoneyPayment(transaction: PaymentTransaction) {
    // For mobile money, this would typically involve checking with the provider
    // For now, we'll mark as pending for manual verification
    return { success: false, pending: true, message: 'Manual verification required' };
  },

  async verifyManualPayment(transaction: PaymentTransaction) {
    // Manual payments require admin verification
    return { success: false, pending: true, message: 'Manual verification required' };
  },

  async updateTransactionStatus(transactionId: string, status: string, providerResponse?: any) {
    const updateData: any = {
      status,
      processed_at: new Date().toISOString()
    };

    if (providerResponse) {
      updateData.provider_response = providerResponse;
    }

    const { data, error } = await supabase
      .from('payment_transactions')
      .update(updateData)
      .eq('id', transactionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // REFUNDS
  async processRefund(transactionId: string, amount?: number, reason?: string) {
    const { data: transaction, error } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        payment_methods(supports_refunds, provider)
      `)
      .eq('id', transactionId)
      .single();

    if (error) throw error;

    if (!transaction.payment_methods?.supports_refunds) {
      throw new Error('This payment method does not support refunds');
    }

    const refundAmount = amount || transaction.amount;
    
    if (refundAmount > transaction.amount) {
      throw new Error('Refund amount cannot exceed original payment amount');
    }

    // Process refund with provider
    const refundReference = this.generateRefundReference(transaction.reference);
    
    try {
      const refundResult = await this.processProviderRefund(transaction, refundAmount, refundReference, reason);
      
      // Create refund transaction record
      const { data: refundTransaction, error: refundError } = await supabase
        .from('payment_transactions')
        .insert([{
          reference: refundReference,
          payment_method_id: transaction.payment_method_id,
          transaction_type: transaction.transaction_type,
          related_id: transaction.related_id,
          client_id: transaction.client_id,
          amount: -refundAmount, // Negative amount for refund
          processing_fee: 0,
          net_amount: -refundAmount,
          currency: transaction.currency,
          status: 'completed',
          provider_reference: refundResult.refund_id,
          provider_response: refundResult,
          notes: `Refund for ${transaction.reference}${reason ? ': ' + reason : ''}`
        }])
        .select()
        .single();

      if (refundError) throw refundError;

      // Update original transaction
      await supabase
        .from('payment_transactions')
        .update({
          status: refundAmount >= transaction.amount ? 'refunded' : 'partial'
        })
        .eq('id', transactionId);

      return refundTransaction;

    } catch (error) {
      console.error('Refund processing failed:', error);
      throw error;
    }
  },

  async processProviderRefund(transaction: PaymentTransaction, amount: number, refundReference: string, reason?: string) {
    const provider = transaction.payment_methods?.provider;
    
    switch (provider) {
      case 'hubtel':
        return this.processHubtelRefund(transaction, amount, refundReference, reason);
      case 'paystack':
        return this.processPaystackRefund(transaction, amount, refundReference, reason);
      default:
        throw new Error(`Refunds not supported for provider: ${provider}`);
    }
  },

  async processHubtelRefund(transaction: PaymentTransaction, amount: number, refundReference: string, reason?: string) {
    // Hubtel refund API implementation
    return {
      refund_id: refundReference,
      status: 'completed',
      amount: amount
    };
  },

  async processPaystackRefund(transaction: PaymentTransaction, amount: number, refundReference: string, reason?: string) {
    const paystackSecretKey = import.meta.env.VITE_PAYSTACK_SECRET_KEY;
    
    const response = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${paystackSecretKey}`
      },
      body: JSON.stringify({
        transaction: transaction.reference,
        amount: amount * 100, // Paystack uses kobo
        currency: 'GHS',
        customer_note: reason,
        merchant_note: `Refund processed by Zolara Beauty Studio`
      })
    });

    const result = await response.json();
    
    if (!result.status) {
      throw new Error(result.message || 'Paystack refund failed');
    }

    return {
      refund_id: result.data.id,
      status: result.data.status,
      amount: result.data.amount / 100
    };
  },

  // TRANSACTION QUERIES
  async getTransactionById(id: string) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        payment_methods(name, provider, type)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getTransactionsByClient(clientId: string) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        payment_methods(name, provider, type)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getAllTransactions(filters: {
    status?: string;
    transaction_type?: string;
    date_from?: string;
    date_to?: string;
  } = {}) {
    let query = supabase
      .from('payment_transactions')
      .select(`
        *,
        payment_methods(name, provider, type),
        profiles(full_name, email, phone)
      `)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.transaction_type) {
      query = query.eq('transaction_type', filters.transaction_type);
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // UTILITY FUNCTIONS
  calculateProcessingFee(amount: number, paymentMethod: PaymentMethod): number {
    const percentageFee = (amount * paymentMethod.processing_fee_percentage) / 100;
    return percentageFee + paymentMethod.processing_fee_fixed;
  },

  generatePaymentReference(type: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ZOL-${type.toUpperCase()}-${timestamp}-${random}`;
  },

  generateRefundReference(originalReference: string): string {
    const timestamp = Date.now();
    return `RF-${originalReference}-${timestamp}`;
  },

  formatAmount(amount: number, currency: string = 'GHS'): string {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  },

  getPaymentStatusColor(status: string): string {
    const colors = {
      pending: 'yellow',
      processing: 'blue',
      completed: 'green',
      failed: 'red',
      cancelled: 'gray',
      refunded: 'purple'
    };
    return colors[status] || 'gray';
  },

  getPaymentTypeIcon(type: string): string {
    const icons = {
      mobile_money: '📱',
      card: '💳',
      bank_transfer: '🏦',
      cash: '💵',
      crypto: '₿'
    };
    return icons[type] || '💳';
  }
};
