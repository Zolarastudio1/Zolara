import { supabase } from '../integrations/supabase/client';

export interface SMSCampaign {
  id: string;
  name: string;
  message_template: string;
  trigger_type: 'booking_reminder' | 'birthday' | 'anniversary' | 'follow_up' | 'promotional' | 'waitlist';
  send_hours_before?: number;
  is_active: boolean;
  created_at: string;
}

export interface SMSQueueItem {
  id: string;
  phone_number: string;
  message: string;
  campaign_id?: string;
  booking_id?: string;
  client_id?: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sent_at?: string;
  error_message?: string;
  created_at: string;
}

const ARKESEL_API_KEY = import.meta.env.VITE_ARKESEL_API_KEY;
const ARKESEL_SENDER_ID = 'ZOLARA'; // Will be approved by Arkesel

export const smsService = {
  // Get all SMS campaigns
  async getAllCampaigns() {
    const { data, error } = await supabase
      .from('sms_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as SMSCampaign[];
  },

  // Get active campaigns
  async getActiveCampaigns() {
    const { data, error } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    return data as SMSCampaign[];
  },

  // Create SMS campaign
  async createCampaign(campaign: Omit<SMSCampaign, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('sms_campaigns')
      .insert([campaign])
      .select()
      .single();
    
    if (error) throw error;
    return data as SMSCampaign;
  },

  // Update SMS campaign
  async updateCampaign(id: string, updates: Partial<SMSCampaign>) {
    const { data, error } = await supabase
      .from('sms_campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as SMSCampaign;
  },

  // Delete SMS campaign
  async deleteCampaign(id: string) {
    const { data, error } = await supabase
      .from('sms_campaigns')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return data;
  },

  // Queue SMS message
  async queueSMS(smsData: {
    phone_number: string;
    message: string;
    campaign_id?: string;
    booking_id?: string;
    client_id?: string;
    scheduled_for?: Date;
  }) {
    const scheduledFor = smsData.scheduled_for || new Date();
    
    const { data, error } = await supabase
      .from('sms_queue')
      .insert([{
        phone_number: this.cleanPhoneNumber(smsData.phone_number),
        message: smsData.message,
        campaign_id: smsData.campaign_id,
        booking_id: smsData.booking_id,
        client_id: smsData.client_id,
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending'
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data as SMSQueueItem;
  },

  // Send immediate SMS
  async sendImmediateSMS(phoneNumber: string, message: string) {
    try {
      const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': ARKESEL_API_KEY
        },
        body: JSON.stringify({
          sender: ARKESEL_SENDER_ID,
          message: message,
          recipients: [this.cleanPhoneNumber(phoneNumber)]
        })
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        return { success: true, data: result };
      } else {
        throw new Error(result.message || 'Failed to send SMS');
      }
    } catch (error) {
      console.error('SMS sending failed:', error);
      throw error;
    }
  },

  // Process SMS queue (called by cron job or manually)
  async processSMSQueue() {
    const now = new Date().toISOString();
    
    // Get pending messages that are due to be sent
    const { data: pendingMessages, error } = await supabase
      .from('sms_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(50); // Process in batches

    if (error) {
      console.error('Failed to get pending SMS messages:', error);
      return;
    }

    for (const message of pendingMessages || []) {
      try {
        await this.sendImmediateSMS(message.phone_number, message.message);
        
        // Update status to sent
        await supabase
          .from('sms_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', message.id);

      } catch (error) {
        // Update status to failed with error message
        await supabase
          .from('sms_queue')
          .update({
            status: 'failed',
            error_message: error.message || 'Unknown error'
          })
          .eq('id', message.id);
      }
    }

    return pendingMessages?.length || 0;
  },

  // Schedule booking reminders
  async scheduleBookingReminders(booking: any) {
    const { data: campaigns } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('trigger_type', 'booking_reminder')
      .eq('is_active', true);

    if (!campaigns) return;

    for (const campaign of campaigns) {
      if (!campaign.send_hours_before) continue;

      const appointmentTime = new Date(booking.appointment_date + ' ' + booking.appointment_time);
      const sendTime = new Date(appointmentTime.getTime() - (campaign.send_hours_before * 60 * 60 * 1000));

      // Only schedule if send time is in the future
      if (sendTime > new Date()) {
        const message = this.replacePlaceholders(campaign.message_template, {
          client_name: booking.client_name || 'Valued Client',
          service: booking.service_name,
          date: appointmentTime.toLocaleDateString(),
          time: booking.appointment_time,
          staff: booking.staff_name
        });

        await this.queueSMS({
          phone_number: booking.client_phone,
          message,
          campaign_id: campaign.id,
          booking_id: booking.id,
          client_id: booking.client_id,
          scheduled_for: sendTime
        });
      }
    }
  },

  // Schedule birthday messages
  async scheduleBirthdayMessages() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find clients with birthdays tomorrow
    const { data: clients } = await supabase
      .from('profiles')
      .select('*')
      .not('birthday', 'is', null)
      .eq('prefers_birthday_sms', true)
      .eq(supabase.raw("EXTRACT(MONTH FROM birthday)"), tomorrow.getMonth() + 1)
      .eq(supabase.raw("EXTRACT(DAY FROM birthday)"), tomorrow.getDate());

    if (!clients) return;

    const { data: campaign } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('trigger_type', 'birthday')
      .eq('is_active', true)
      .single();

    if (!campaign) return;

    for (const client of clients) {
      if (!client.phone) continue;

      const message = this.replacePlaceholders(campaign.message_template, {
        client_name: client.full_name || 'Valued Client'
      });

      const sendTime = new Date(tomorrow);
      sendTime.setHours(10, 0, 0, 0); // Send at 10 AM

      await this.queueSMS({
        phone_number: client.phone,
        message,
        campaign_id: campaign.id,
        client_id: client.id,
        scheduled_for: sendTime
      });
    }
  },

  // Schedule anniversary messages
  async scheduleAnniversaryMessages() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find clients with anniversaries tomorrow
    const { data: clients } = await supabase
      .from('profiles')
      .select('*')
      .not('anniversary', 'is', null)
      .eq('prefers_anniversary_sms', true)
      .eq(supabase.raw("EXTRACT(MONTH FROM anniversary)"), tomorrow.getMonth() + 1)
      .eq(supabase.raw("EXTRACT(DAY FROM anniversary)"), tomorrow.getDate());

    if (!clients) return;

    const { data: campaign } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('trigger_type', 'anniversary')
      .eq('is_active', true)
      .single();

    if (!campaign) return;

    for (const client of clients) {
      if (!client.phone) continue;

      const message = this.replacePlaceholders(campaign.message_template, {
        client_name: client.full_name || 'Valued Client'
      });

      const sendTime = new Date(tomorrow);
      sendTime.setHours(11, 0, 0, 0); // Send at 11 AM

      await this.queueSMS({
        phone_number: client.phone,
        message,
        campaign_id: campaign.id,
        client_id: client.id,
        scheduled_for: sendTime
      });
    }
  },

  // Send promotional SMS to targeted clients
  async sendPromotionalSMS(targets: {
    client_ids?: string[];
    client_tier?: string[];
    last_visit_days?: number; // clients who haven't visited in X days
  }, messageTemplate: string, scheduledFor?: Date) {
    let query = supabase
      .from('profiles')
      .select('id, full_name, phone')
      .not('phone', 'is', null);

    // Apply filters
    if (targets.client_ids?.length) {
      query = query.in('id', targets.client_ids);
    }

    if (targets.client_tier?.length) {
      const { data: analyticsData } = await supabase
        .from('client_analytics')
        .select('client_id')
        .in('client_tier', targets.client_tier);
      
      if (analyticsData?.length) {
        const clientIds = analyticsData.map(a => a.client_id);
        query = query.in('id', clientIds);
      }
    }

    if (targets.last_visit_days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - targets.last_visit_days);
      
      const { data: recentClients } = await supabase
        .from('client_analytics')
        .select('client_id')
        .lt('last_visit_date', cutoffDate.toISOString());
      
      if (recentClients?.length) {
        const clientIds = recentClients.map(c => c.client_id);
        query = query.in('id', clientIds);
      }
    }

    const { data: clients, error } = await query;
    
    if (error) throw error;
    if (!clients?.length) return 0;

    const sendTime = scheduledFor || new Date();
    let queuedCount = 0;

    for (const client of clients) {
      const message = this.replacePlaceholders(messageTemplate, {
        client_name: client.full_name || 'Valued Client'
      });

      try {
        await this.queueSMS({
          phone_number: client.phone,
          message,
          client_id: client.id,
          scheduled_for: sendTime
        });
        queuedCount++;
      } catch (error) {
        console.error(`Failed to queue SMS for client ${client.id}:`, error);
      }
    }

    return queuedCount;
  },

  // Get SMS queue status
  async getSMSQueueStatus() {
    const { data, error } = await supabase
      .from('sms_queue')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    if (error) throw error;

    const stats = data.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: data.length,
      pending: stats.pending || 0,
      sent: stats.sent || 0,
      failed: stats.failed || 0,
      cancelled: stats.cancelled || 0
    };
  },

  // Helper functions
  cleanPhoneNumber(phone: string): string {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle different Ghana phone formats
    if (cleaned.startsWith('233')) {
      return cleaned; // Already in international format
    } else if (cleaned.startsWith('0')) {
      return '233' + cleaned.substring(1); // Convert from national to international
    } else if (cleaned.length === 9) {
      return '233' + cleaned; // Assume it's missing the 233 prefix
    }
    
    return cleaned;
  },

  replacePlaceholders(template: string, data: Record<string, string>): string {
    let message = template;
    
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      message = message.replace(new RegExp(placeholder, 'g'), value || '');
    });
    
    return message;
  },

  // Cancel scheduled SMS
  async cancelSMS(queueItemId: string) {
    const { data, error } = await supabase
      .from('sms_queue')
      .update({ status: 'cancelled' })
      .eq('id', queueItemId)
      .eq('status', 'pending')
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};
