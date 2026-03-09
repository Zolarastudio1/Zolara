import { supabase } from '../integrations/supabase/client';

export interface PromotionalCode {
  id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  minimum_amount: number;
  maximum_discount?: number;
  usage_limit?: number;
  usage_count: number;
  per_client_limit: number;
  valid_from: string;
  valid_until?: string;
  applicable_services: string[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

export interface PromoCodeUsage {
  id: string;
  promo_code_id: string;
  booking_id: string;
  client_id: string;
  discount_applied: number;
  used_at: string;
}

export const promoCodes = {
  // Get all promo codes
  async getAllPromoCodes() {
    const { data, error } = await supabase
      .from('promotional_codes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as PromotionalCode[];
  },

  // Get active promo codes
  async getActivePromoCodes() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('promotional_codes')
      .select('*')
      .eq('is_active', true)
      .lte('valid_from', now)
      .or(`valid_until.is.null,valid_until.gt.${now}`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as PromotionalCode[];
  },

  // Validate promo code
  async validatePromoCode(code: string, clientId: string, serviceIds: string[], totalAmount: number) {
    const { data: promoCode, error } = await supabase
      .from('promotional_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !promoCode) {
      return { valid: false, error: 'Invalid promo code' };
    }

    // Check if code is within valid date range
    const now = new Date();
    const validFrom = new Date(promoCode.valid_from);
    const validUntil = promoCode.valid_until ? new Date(promoCode.valid_until) : null;

    if (now < validFrom) {
      return { valid: false, error: 'Promo code not yet valid' };
    }

    if (validUntil && now > validUntil) {
      return { valid: false, error: 'Promo code has expired' };
    }

    // Check usage limits
    if (promoCode.usage_limit && promoCode.usage_count >= promoCode.usage_limit) {
      return { valid: false, error: 'Promo code usage limit reached' };
    }

    // Check per-client usage limit
    const { data: clientUsage, error: usageError } = await supabase
      .from('promo_code_usage')
      .select('id')
      .eq('promo_code_id', promoCode.id)
      .eq('client_id', clientId);

    if (usageError) {
      return { valid: false, error: 'Unable to verify usage history' };
    }

    if (clientUsage.length >= promoCode.per_client_limit) {
      return { valid: false, error: 'You have already used this promo code' };
    }

    // Check minimum amount
    if (totalAmount < promoCode.minimum_amount) {
      return { valid: false, error: `Minimum order amount is GHS ${promoCode.minimum_amount}` };
    }

    // Check service applicability
    if (promoCode.applicable_services.length > 0) {
      const hasApplicableService = serviceIds.some(serviceId => 
        promoCode.applicable_services.includes(serviceId)
      );
      if (!hasApplicableService) {
        return { valid: false, error: 'Promo code not applicable to selected services' };
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (promoCode.discount_type === 'percentage') {
      discountAmount = (totalAmount * promoCode.discount_value) / 100;
      if (promoCode.maximum_discount) {
        discountAmount = Math.min(discountAmount, promoCode.maximum_discount);
      }
    } else {
      discountAmount = promoCode.discount_value;
    }

    // Ensure discount doesn't exceed total amount
    discountAmount = Math.min(discountAmount, totalAmount);

    return {
      valid: true,
      promoCode,
      discountAmount,
      finalAmount: totalAmount - discountAmount
    };
  },

  // Apply promo code to booking
  async applyPromoCode(promoCodeId: string, bookingId: string, clientId: string, discountAmount: number) {
    // Record usage
    const { data: usage, error: usageError } = await supabase
      .from('promo_code_usage')
      .insert([{
        promo_code_id: promoCodeId,
        booking_id: bookingId,
        client_id: clientId,
        discount_applied: discountAmount
      }])
      .select()
      .single();

    if (usageError) throw usageError;

    // Update usage count
    const { error: updateError } = await supabase
      .from('promotional_codes')
      .update({ 
        usage_count: supabase.raw('usage_count + 1') 
      })
      .eq('id', promoCodeId);

    if (updateError) throw updateError;

    return usage;
  },

  // Create new promo code
  async createPromoCode(promoCode: Omit<PromotionalCode, 'id' | 'usage_count' | 'created_at'>) {
    const { data, error } = await supabase
      .from('promotional_codes')
      .insert([{
        ...promoCode,
        code: promoCode.code.toUpperCase(),
        usage_count: 0
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data as PromotionalCode;
  },

  // Update promo code
  async updatePromoCode(id: string, updates: Partial<PromotionalCode>) {
    if (updates.code) {
      updates.code = updates.code.toUpperCase();
    }

    const { data, error } = await supabase
      .from('promotional_codes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as PromotionalCode;
  },

  // Delete promo code
  async deletePromoCode(id: string) {
    const { data, error } = await supabase
      .from('promotional_codes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return data;
  },

  // Get promo code usage statistics
  async getPromoCodeStats(promoCodeId: string) {
    const { data: usageData, error } = await supabase
      .from('promo_code_usage')
      .select(`
        *,
        bookings!inner(final_price),
        profiles!inner(full_name)
      `)
      .eq('promo_code_id', promoCodeId);

    if (error) throw error;

    const totalDiscountGiven = usageData.reduce((sum, usage) => sum + usage.discount_applied, 0);
    const uniqueClients = new Set(usageData.map(usage => usage.client_id)).size;
    
    return {
      totalUsage: usageData.length,
      totalDiscountGiven,
      uniqueClients,
      usageHistory: usageData
    };
  },

  // Generate random promo code
  generateRandomCode(length: number = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  },

  // Get usage history for client
  async getClientPromoUsage(clientId: string) {
    const { data, error } = await supabase
      .from('promo_code_usage')
      .select(`
        *,
        promotional_codes(code, description),
        bookings(appointment_date, final_price)
      `)
      .eq('client_id', clientId)
      .order('used_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};
