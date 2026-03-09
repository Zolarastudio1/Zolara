import { supabase } from '../integrations/supabase/client';

export interface WaitlistEntry {
  id: string;
  client_id: string;
  service_id: string;
  staff_id?: string;
  preferred_date: string;
  preferred_time: string;
  alternative_dates: string[];
  priority: number;
  status: 'waiting' | 'notified' | 'booked' | 'expired' | 'cancelled';
  notification_sent_at?: string;
  expires_at?: string;
  client_phone?: string;
  client_name?: string;
  client_email?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const waitlistService = {
  // Add client to waitlist
  async addToWaitlist(entry: Partial<WaitlistEntry>) {
    const { data, error } = await supabase
      .from('waitlist')
      .insert([entry])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get waitlist entries
  async getWaitlistEntries(filters: {
    service_id?: string;
    date?: string;
    status?: string;
  } = {}) {
    let query = supabase
      .from('waitlist')
      .select(`
        *,
        services(name),
        profiles(full_name)
      `)
      .order('created_at', { ascending: false });

    if (filters.service_id) {
      query = query.eq('service_id', filters.service_id);
    }
    if (filters.date) {
      query = query.eq('preferred_date', filters.date);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Update waitlist status
  async updateWaitlistStatus(id: string, status: string, notification_sent_at?: string) {
    const updateData: any = { status };
    if (notification_sent_at) {
      updateData.notification_sent_at = notification_sent_at;
    }

    const { data, error } = await supabase
      .from('waitlist')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Check for available slots and notify waitlist
  async checkAndNotifyWaitlist(service_id: string, date: string, time: string) {
    // Get waiting entries for this service and date
    const { data: waitingEntries, error } = await supabase
      .from('waitlist')
      .select('*')
      .eq('service_id', service_id)
      .eq('preferred_date', date)
      .eq('status', 'waiting')
      .order('priority', { ascending: false }) // Higher priority first
      .order('created_at', { ascending: true }); // Earlier entries first for same priority

    if (error) throw error;

    // Notify the first person on the waitlist
    if (waitingEntries && waitingEntries.length > 0) {
      const firstEntry = waitingEntries[0];
      
      // Update status to notified
      await this.updateWaitlistStatus(firstEntry.id, 'notified', new Date().toISOString());
      
      // Send SMS notification
      await this.sendWaitlistNotification(firstEntry);
      
      return firstEntry;
    }

    return null;
  },

  // Send waitlist notification
  async sendWaitlistNotification(entry: WaitlistEntry) {
    if (!entry.client_phone) return;

    const message = `Good news! A slot opened up at Zolara Beauty Studio on ${entry.preferred_date} at ${entry.preferred_time}. You have 2 hours to book. Call 0594 365 314 now!`;
    
    // Add to SMS queue
    const { error } = await supabase
      .from('sms_queue')
      .insert([{
        phone_number: entry.client_phone,
        message,
        campaign_id: null, // Direct waitlist notification
        booking_id: null,
        client_id: entry.client_id,
        scheduled_for: new Date().toISOString()
      }]);

    if (error) {
      console.error('Failed to queue waitlist SMS:', error);
      throw error;
    }

    // Set expiry time (2 hours from now)
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 2);
    
    await supabase
      .from('waitlist')
      .update({ expires_at: expiryTime.toISOString() })
      .eq('id', entry.id);
  },

  // Remove expired entries
  async cleanupExpiredEntries() {
    const { data, error } = await supabase
      .from('waitlist')
      .update({ status: 'expired' })
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'notified');

    if (error) throw error;
    return data;
  },

  // Cancel waitlist entry
  async cancelWaitlistEntry(id: string) {
    const { data, error } = await supabase
      .from('waitlist')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};
