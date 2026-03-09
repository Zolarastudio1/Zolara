import { supabase } from '../integrations/supabase/client';

export interface WhatsAppContact {
  id: string;
  client_id: string;
  whatsapp_number: string;
  contact_name?: string;
  is_verified: boolean;
  last_message_at?: string;
  opt_in_marketing: boolean;
  created_at: string;
}

export interface WhatsAppMessage {
  id: string;
  contact_id: string;
  booking_id?: string;
  message_type: 'text' | 'template' | 'image' | 'document';
  content: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  whatsapp_message_id?: string;
  sent_at?: string;
  created_at: string;
}

// This would normally use WhatsApp Business API
// For now, we'll create the structure and use a placeholder service
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0'; // Facebook Graph API
const WHATSAPP_ACCESS_TOKEN = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;

export const whatsAppService = {
  // Get all WhatsApp contacts
  async getAllContacts() {
    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as WhatsAppContact[];
  },

  // Get contact by client ID
  async getContactByClientId(clientId: string) {
    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('client_id', clientId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // Ignore not found
    return data as WhatsAppContact | null;
  },

  // Add or update WhatsApp contact
  async upsertContact(contact: Omit<WhatsAppContact, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .upsert([{
        ...contact,
        whatsapp_number: this.cleanWhatsAppNumber(contact.whatsapp_number)
      }], {
        onConflict: 'client_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as WhatsAppContact;
  },

  // Send WhatsApp message
  async sendMessage(contactId: string, message: string, messageType: 'text' | 'template' = 'text', bookingId?: string) {
    try {
      // Get contact details
      const { data: contact } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (!contact) throw new Error('Contact not found');

      // Store message in database first
      const { data: messageRecord, error: dbError } = await supabase
        .from('whatsapp_messages')
        .insert([{
          contact_id: contactId,
          booking_id: bookingId,
          message_type: messageType,
          content: message,
          direction: 'outbound',
          status: 'pending'
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      try {
        // Send via WhatsApp API
        const response = await this.sendViaWhatsAppAPI(contact.whatsapp_number, message, messageType);
        
        // Update message status
        await supabase
          .from('whatsapp_messages')
          .update({
            status: 'sent',
            whatsapp_message_id: response.messages?.[0]?.id,
            sent_at: new Date().toISOString()
          })
          .eq('id', messageRecord.id);

        // Update contact last message time
        await supabase
          .from('whatsapp_contacts')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', contactId);

        return { success: true, messageId: messageRecord.id, whatsappMessageId: response.messages?.[0]?.id };

      } catch (apiError) {
        // Update message status to failed
        await supabase
          .from('whatsapp_messages')
          .update({
            status: 'failed'
          })
          .eq('id', messageRecord.id);

        throw apiError;
      }

    } catch (error) {
      console.error('WhatsApp send failed:', error);
      throw error;
    }
  },

  // Send via WhatsApp Business API
  async sendViaWhatsAppAPI(phoneNumber: string, message: string, messageType: 'text' | 'template') {
    if (!WHATSAPP_ACCESS_TOKEN || !PHONE_NUMBER_ID) {
      // For development, simulate success
      console.log('WhatsApp API not configured, simulating send:', { phoneNumber, message });
      return { 
        messages: [{ 
          id: 'sim_' + Date.now(),
          message_status: 'sent'
        }] 
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: this.cleanWhatsAppNumber(phoneNumber),
      type: messageType
    };

    if (messageType === 'text') {
      payload.text = { body: message };
    } else if (messageType === 'template') {
      // Template messages require pre-approved templates
      payload.template = {
        name: 'booking_reminder', // This would be a pre-approved template
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: message }]
          }
        ]
      };
    }

    const response = await fetch(`${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error?.message || 'WhatsApp API error');
    }

    return result;
  },

  // Get message history for contact
  async getMessageHistory(contactId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data as WhatsAppMessage[];
  },

  // Send booking confirmation via WhatsApp
  async sendBookingConfirmation(booking: any) {
    try {
      const contact = await this.getContactByClientId(booking.client_id);
      if (!contact || !contact.whatsapp_number) return null;

      const message = `✅ *Booking Confirmed*

Hello ${booking.client_name}!

Your appointment at Zolara Beauty Studio has been confirmed.

📅 *Date:* ${new Date(booking.appointment_date).toLocaleDateString()}
⏰ *Time:* ${booking.appointment_time}
💅 *Service:* ${booking.service_name}
👩‍💼 *Staff:* ${booking.staff_name || 'Our team'}
💰 *Price:* GHS ${booking.final_price}

📍 *Location:* Sakasaka, Opposite CalBank, Tamale

Need to reschedule? Call us at 0594 365 314

Thank you for choosing Zolara Beauty Studio! ✨`;

      return await this.sendMessage(contact.id, message, 'text', booking.id);

    } catch (error) {
      console.error('Failed to send WhatsApp booking confirmation:', error);
      return null;
    }
  },

  // Send booking reminder via WhatsApp
  async sendBookingReminder(booking: any, hoursBeefore: number) {
    try {
      const contact = await this.getContactByClientId(booking.client_id);
      if (!contact || !contact.whatsapp_number) return null;

      const reminderTime = hoursBefor === 24 ? 'tomorrow' : `in ${hoursBeefore} hours`;
      
      const message = `🔔 *Appointment Reminder*

Hi ${booking.client_name}!

This is a friendly reminder that you have an appointment at Zolara Beauty Studio ${reminderTime}.

📅 *Date:* ${new Date(booking.appointment_date).toLocaleDateString()}
⏰ *Time:* ${booking.appointment_time}
💅 *Service:* ${booking.service_name}

📍 *Location:* Sakasaka, Opposite CalBank, Tamale

We can't wait to pamper you! ✨

Need to reschedule? Call 0594 365 314`;

      return await this.sendMessage(contact.id, message, 'text', booking.id);

    } catch (error) {
      console.error('Failed to send WhatsApp booking reminder:', error);
      return null;
    }
  },

  // Send promotional message
  async sendPromotionalMessage(clientIds: string[], message: string) {
    const results = [];

    for (const clientId of clientIds) {
      try {
        const contact = await this.getContactByClientId(clientId);
        if (contact && contact.opt_in_marketing && contact.whatsapp_number) {
          const result = await this.sendMessage(contact.id, message, 'text');
          results.push({ clientId, success: true, messageId: result.messageId });
        } else {
          results.push({ clientId, success: false, reason: 'No WhatsApp or not opted in' });
        }
      } catch (error) {
        results.push({ clientId, success: false, reason: error.message });
      }
    }

    return results;
  },

  // Handle incoming WhatsApp webhook
  async handleIncomingMessage(webhookData: any) {
    // This would be called by a webhook endpoint
    // Parse the incoming message and store it
    
    for (const entry of webhookData.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'messages') {
          for (const message of change.value.messages || []) {
            await this.processIncomingMessage(message, change.value.contacts?.[0]);
          }
        }
      }
    }
  },

  // Process incoming message
  async processIncomingMessage(message: any, contactInfo: any) {
    const whatsappNumber = this.cleanWhatsAppNumber(message.from);
    
    // Find or create contact
    let contact = await this.getContactByWhatsAppNumber(whatsappNumber);
    
    if (!contact && contactInfo) {
      // Try to match with existing client by phone number
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .or(`phone.eq.${whatsappNumber},phone.eq.0${whatsappNumber.substring(3)}`)
        .single();

      if (profile) {
        contact = await this.upsertContact({
          client_id: profile.id,
          whatsapp_number: whatsappNumber,
          contact_name: contactInfo.profile?.name || profile.full_name,
          is_verified: true,
          opt_in_marketing: false // They need to explicitly opt in
        });
      }
    }

    if (contact) {
      // Store the incoming message
      await supabase
        .from('whatsapp_messages')
        .insert([{
          contact_id: contact.id,
          message_type: message.type || 'text',
          content: message.text?.body || message.caption || '[Media]',
          direction: 'inbound',
          status: 'read',
          whatsapp_message_id: message.id
        }]);

      // Update last message time
      await supabase
        .from('whatsapp_contacts')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', contact.id);

      // Auto-respond to common queries
      await this.handleAutoResponse(contact.id, message.text?.body || '');
    }
  },

  // Handle auto-responses
  async handleAutoResponse(contactId: string, messageContent: string) {
    const content = messageContent.toLowerCase().trim();
    
    if (content.includes('book') || content.includes('appointment')) {
      const response = `📱 To book an appointment at Zolara Beauty Studio:

1. Visit: zolarasalon.com/book
2. Call: 0594 365 314 or 020 884 8707
3. Hours: Mon-Sat 8:30 AM - 9:00 PM

We'll be happy to help you! ✨`;
      
      await this.sendMessage(contactId, response);
    
    } else if (content.includes('price') || content.includes('cost')) {
      const response = `💰 Our services range from:

• Washing: GHS 40-70
• Cornrows: GHS 30-50  
• Braids: GHS 160-500+
• Pedicure: GHS 100-250
• Manicure: GHS 60-100
• Acrylic Nails: GHS 120-300
• Lashes: GHS 50-330

Visit zolarasalon.com for full pricing! 💅`;
      
      await this.sendMessage(contactId, response);
    
    } else if (content.includes('location') || content.includes('address')) {
      const response = `📍 *Zolara Beauty Studio Location:*

Sakasaka, Opposite CalBank
Tamale, Northern Region
Ghana

🚗 Easy to find - look for our beautiful gold signage!

Need directions? Call 0594 365 314`;
      
      await this.sendMessage(contactId, response);
    }
  },

  // Get contact by WhatsApp number
  async getContactByWhatsAppNumber(whatsappNumber: string) {
    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('whatsapp_number', this.cleanWhatsAppNumber(whatsappNumber))
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as WhatsAppContact | null;
  },

  // Update marketing opt-in status
  async updateMarketingOptIn(contactId: string, optIn: boolean) {
    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .update({ opt_in_marketing: optIn })
      .eq('id', contactId)
      .select()
      .single();
    
    if (error) throw error;
    return data as WhatsAppContact;
  },

  // Get WhatsApp statistics
  async getWhatsAppStats() {
    const { data: contacts } = await supabase
      .from('whatsapp_contacts')
      .select('opt_in_marketing, is_verified');

    const { data: messages } = await supabase
      .from('whatsapp_messages')
      .select('direction, status')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

    const stats = {
      totalContacts: contacts?.length || 0,
      verifiedContacts: contacts?.filter(c => c.is_verified).length || 0,
      marketingOptIns: contacts?.filter(c => c.opt_in_marketing).length || 0,
      messagesLast7Days: messages?.length || 0,
      outboundMessages: messages?.filter(m => m.direction === 'outbound').length || 0,
      inboundMessages: messages?.filter(m => m.direction === 'inbound').length || 0,
      deliveryRate: 0
    };

    if (stats.outboundMessages > 0) {
      const delivered = messages?.filter(m => 
        m.direction === 'outbound' && ['sent', 'delivered', 'read'].includes(m.status)
      ).length || 0;
      stats.deliveryRate = (delivered / stats.outboundMessages) * 100;
    }

    return stats;
  },

  // Helper functions
  cleanWhatsAppNumber(number: string): string {
    // Remove all non-digits
    let cleaned = number.replace(/\D/g, '');
    
    // Handle different Ghana phone formats for WhatsApp
    if (cleaned.startsWith('233')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '233' + cleaned.substring(1);
    } else if (cleaned.length === 9) {
      return '233' + cleaned;
    }
    
    return cleaned;
  }
};
