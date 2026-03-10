import { supabase } from '../integrations/supabase/client';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  price: number;
  setup_fee: number;
  trial_days: number;
  max_services_per_cycle?: number;
  included_services: string[];
  discount_percentage: number;
  is_active: boolean;
  features: string[];
  created_at: string;
}

export interface Subscription {
  id: string;
  client_id: string;
  plan_id: string;
  status: 'trial' | 'active' | 'paused' | 'cancelled' | 'expired';
  starts_at: string;
  trial_ends_at?: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancelled_at?: string;
  services_used_this_cycle: number;
  last_payment_date?: string;
  next_payment_date?: string;
  payment_method_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUsage {
  id: string;
  subscription_id: string;
  booking_id: string;
  service_id: string;
  cycle_start_date: string;
  cycle_end_date: string;
  created_at: string;
}

export const subscriptionService = {
  // SUBSCRIPTION PLANS
  async getAllPlans() {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true });
    
    if (error) throw error;
    return data as SubscriptionPlan[];
  },

  async getActivePlans() {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });
    
    if (error) throw error;
    return data as SubscriptionPlan[];
  },

  async getPlanById(id: string) {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as SubscriptionPlan;
  },

  async createPlan(plan: Omit<SubscriptionPlan, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert([plan])
      .select()
      .single();
    
    if (error) throw error;
    return data as SubscriptionPlan;
  },

  async updatePlan(id: string, updates: Partial<SubscriptionPlan>) {
    const { data, error } = await supabase
      .from('subscription_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as SubscriptionPlan;
  },

  // SUBSCRIPTIONS
  async createSubscription(clientId: string, planId: string, paymentMethodId?: string) {
    const plan = await this.getPlanById(planId);
    
    const now = new Date();
    const trialEnds = plan.trial_days > 0 ? new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000) : null;
    
    // Calculate next cycle based on billing cycle
    const nextPeriodEnd = this.calculateNextPeriodEnd(now, plan.billing_cycle);
    const nextPaymentDate = trialEnds || now;

    const { data, error } = await supabase
      .from('subscriptions')
      .insert([{
        client_id: clientId,
        plan_id: planId,
        status: plan.trial_days > 0 ? 'trial' : 'active',
        starts_at: now.toISOString(),
        trial_ends_at: trialEnds?.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: nextPeriodEnd.toISOString(),
        next_payment_date: nextPaymentDate.toISOString(),
        payment_method_id: paymentMethodId,
        services_used_this_cycle: 0,
        cancel_at_period_end: false
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data as Subscription;
  },

  async getClientSubscriptions(clientId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getActiveSubscription(clientId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('client_id', clientId)
      .in('status', ['trial', 'active'])
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getAllSubscriptions(filters: {
    status?: string;
    plan_id?: string;
    payment_due?: boolean;
  } = {}) {
    let query = supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(name),
        profiles(full_name, email, phone)
      `)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.plan_id) {
      query = query.eq('plan_id', filters.plan_id);
    }
    if (filters.payment_due) {
      const today = new Date().toISOString().split('T')[0];
      query = query.lte('next_payment_date', today);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // SUBSCRIPTION USAGE
  async canUseService(subscriptionId: string, serviceId: string) {
    const subscription = await this.getSubscriptionById(subscriptionId);
    if (!subscription || !['trial', 'active'].includes(subscription.status)) {
      return { canUse: false, reason: 'Subscription not active' };
    }

    const plan = await this.getPlanById(subscription.plan_id);

    // Check if service is included
    if (plan.included_services.length > 0 && !plan.included_services.includes(serviceId)) {
      return { canUse: false, reason: 'Service not included in plan' };
    }

    // Check usage limits
    if (plan.max_services_per_cycle && subscription.services_used_this_cycle >= plan.max_services_per_cycle) {
      return { canUse: false, reason: 'Monthly service limit reached' };
    }

    return { canUse: true };
  },

  async recordServiceUsage(subscriptionId: string, bookingId: string, serviceId: string) {
    const subscription = await this.getSubscriptionById(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');

    // Record usage
    const { data: usage, error: usageError } = await supabase
      .from('subscription_usage')
      .insert([{
        subscription_id: subscriptionId,
        booking_id: bookingId,
        service_id: serviceId,
        cycle_start_date: subscription.current_period_start,
        cycle_end_date: subscription.current_period_end
      }])
      .select()
      .single();

    if (usageError) throw usageError;

    // Update usage count
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        services_used_this_cycle: subscription.services_used_this_cycle + 1
      })
      .eq('id', subscriptionId);

    if (updateError) throw updateError;

    return usage;
  },

  async getSubscriptionUsage(subscriptionId: string) {
    const { data, error } = await supabase
      .from('subscription_usage')
      .select(`
        *,
        bookings(appointment_date, final_price),
        services(name)
      `)
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // SUBSCRIPTION MANAGEMENT
  async pauseSubscription(subscriptionId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status: 'paused' })
      .eq('id', subscriptionId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async resumeSubscription(subscriptionId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status: 'active' })
      .eq('id', subscriptionId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async cancelSubscription(subscriptionId: string, immediately: boolean = false) {
    const updateData: any = {
      cancel_at_period_end: !immediately
    };

    if (immediately) {
      updateData.status = 'cancelled';
      updateData.cancelled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscriptionId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async renewSubscription(subscriptionId: string, paymentSuccessful: boolean = true) {
    const subscription = await this.getSubscriptionById(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');

    const plan = await this.getPlanById(subscription.plan_id);
    const nextPeriodEnd = this.calculateNextPeriodEnd(new Date(subscription.current_period_end), plan.billing_cycle);
    const nextPaymentDate = this.calculateNextPeriodEnd(new Date(), plan.billing_cycle);

    const updateData: any = {
      current_period_start: subscription.current_period_end,
      current_period_end: nextPeriodEnd.toISOString(),
      services_used_this_cycle: 0,
      next_payment_date: nextPaymentDate.toISOString()
    };

    if (paymentSuccessful) {
      updateData.status = 'active';
      updateData.last_payment_date = new Date().toISOString();
    } else {
      updateData.status = 'expired';
    }

    // Handle trial to active transition
    if (subscription.status === 'trial') {
      updateData.status = 'active';
    }

    // Handle cancellation at period end
    if (subscription.cancel_at_period_end) {
      updateData.status = 'cancelled';
      updateData.cancelled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscriptionId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // PAYMENT PROCESSING
  async processSubscriptionPayments() {
    const today = new Date().toISOString().split('T')[0];
    
    // Get subscriptions due for payment
    const { data: dueSubscriptions } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*),
        profiles(*)
      `)
      .in('status', ['trial', 'active'])
      .lte('next_payment_date', today);

    if (!dueSubscriptions) return [];

    const results = [];

    for (const subscription of dueSubscriptions) {
      try {
        // For trial subscriptions ending
        if (subscription.status === 'trial' && subscription.trial_ends_at && new Date(subscription.trial_ends_at) <= new Date()) {
          // Attempt to charge for the first time
          const paymentResult = await this.chargeSubscription(subscription);
          if (paymentResult.success) {
            await this.renewSubscription(subscription.id, true);
            results.push({ subscriptionId: subscription.id, status: 'charged', amount: subscription.subscription_plans.price });
          } else {
            await this.renewSubscription(subscription.id, false);
            results.push({ subscriptionId: subscription.id, status: 'failed', error: paymentResult.error });
          }
        }
        // For active subscriptions
        else if (subscription.status === 'active') {
          const paymentResult = await this.chargeSubscription(subscription);
          if (paymentResult.success) {
            await this.renewSubscription(subscription.id, true);
            results.push({ subscriptionId: subscription.id, status: 'charged', amount: subscription.subscription_plans.price });
          } else {
            await this.renewSubscription(subscription.id, false);
            results.push({ subscriptionId: subscription.id, status: 'failed', error: paymentResult.error });
          }
        }
      } catch (error) {
        results.push({ subscriptionId: subscription.id, status: 'error', error: error.message });
      }
    }

    return results;
  },

  async chargeSubscription(subscription: any) {
    // This would integrate with payment processor
    // For now, simulate the payment process
    try {
      if (!subscription.payment_method_id) {
        return { success: false, error: 'No payment method on file' };
      }

      // Simulate payment processing
      const amount = subscription.subscription_plans.price;
      
      // In real implementation, this would call Hubtel, Paystack, etc.
      // Record payment transaction
      const { data: transaction, error } = await supabase
        .from('payment_transactions')
        .insert([{
          reference: `SUB-${subscription.id}-${Date.now()}`,
          payment_method_id: subscription.payment_method_id,
          transaction_type: 'subscription',
          related_id: subscription.id,
          client_id: subscription.client_id,
          amount: amount,
          processing_fee: amount * 0.025, // 2.5% fee
          net_amount: amount * 0.975,
          status: 'completed' // In real world, this would be 'pending' initially
        }])
        .select()
        .single();

      if (error) throw error;

      return { success: true, transactionId: transaction.id };
      
    } catch (error) {
      console.error('Subscription payment failed:', error);
      return { success: false, error: error.message };
    }
  },

  // ANALYTICS
  async getSubscriptionAnalytics(period: 'week' | 'month' | 'quarter' = 'month') {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
    }

    // Get subscription counts
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('*')
      .gte('created_at', startDate.toISOString());

    // Get revenue from subscription payments
    const { data: payments } = await supabase
      .from('payment_transactions')
      .select('amount, created_at')
      .eq('transaction_type', 'subscription')
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString());

    const analytics = {
      newSubscriptions: subscriptions?.length || 0,
      totalRevenue: payments?.reduce((sum, p) => sum + p.amount, 0) || 0,
      averageRevenuePerUser: 0,
      churnRate: 0,
      activeSubscriptions: 0
    };

    // Get current active subscriptions
    const { data: activeData } = await supabase
      .from('subscriptions')
      .select('id')
      .in('status', ['trial', 'active']);

    analytics.activeSubscriptions = activeData?.length || 0;

    if (analytics.activeSubscriptions > 0) {
      analytics.averageRevenuePerUser = analytics.totalRevenue / analytics.activeSubscriptions;
    }

    return analytics;
  },

  async getSubscriptionById(id: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // UTILITY FUNCTIONS
  calculateNextPeriodEnd(currentDate: Date, billingCycle: string): Date {
    const nextDate = new Date(currentDate);
    
    switch (billingCycle) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    
    return nextDate;
  },

  calculateServiceDiscount(originalPrice: number, discountPercentage: number): number {
    return originalPrice * (discountPercentage / 100);
  },

  formatBillingCycle(cycle: string): string {
    const cycles = {
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Every 3 months',
      yearly: 'Yearly'
    };
    return cycles[cycle] || cycle;
  },

  getSubscriptionStatus(subscription: Subscription): {
    status: string;
    color: string;
    message: string;
  } {
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;

    if (subscription.status === 'trial' && trialEnd && now < trialEnd) {
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        status: 'trial',
        color: 'blue',
        message: `Trial ends in ${daysLeft} days`
      };
    }

    if (subscription.status === 'active') {
      if (subscription.cancel_at_period_end) {
        const daysLeft = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          status: 'ending',
          color: 'orange',
          message: `Ends in ${daysLeft} days`
        };
      }
      return {
        status: 'active',
        color: 'green',
        message: 'Active'
      };
    }

    const statusMap = {
      paused: { status: 'paused', color: 'yellow', message: 'Paused' },
      cancelled: { status: 'cancelled', color: 'red', message: 'Cancelled' },
      expired: { status: 'expired', color: 'red', message: 'Expired' }
    };

    return statusMap[subscription.status] || { status: 'unknown', color: 'gray', message: 'Unknown' };
  }
};
