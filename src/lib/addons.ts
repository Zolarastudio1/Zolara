import { supabase } from '../integrations/supabase/client';

export interface ServiceAddon {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  category: 'nails' | 'hair' | 'beauty' | 'general';
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface BookingAddon {
  id: string;
  booking_id: string;
  addon_id: string;
  quantity: number;
  price_paid: number;
  created_at: string;
}

export const addonsService = {
  // Get all active add-ons
  async getActiveAddons() {
    const { data, error } = await supabase
      .from('service_addons')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data as ServiceAddon[];
  },

  // Get compatible add-ons for a service
  async getCompatibleAddons(serviceId: string) {
    const { data, error } = await supabase
      .from('service_addon_compatibility')
      .select(`
        *,
        service_addons!inner (*)
      `)
      .eq('service_id', serviceId)
      .eq('service_addons.is_active', true);
    
    if (error) throw error;
    return data.map(item => item.service_addons).flat() as ServiceAddon[];
  },

  // Get all add-ons (for admin management)
  async getAllAddons() {
    const { data, error } = await supabase
      .from('service_addons')
      .select('*')
      .order('category', { ascending: true })
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    return data as ServiceAddon[];
  },

  // Create new add-on
  async createAddon(addon: Omit<ServiceAddon, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('service_addons')
      .insert([addon])
      .select()
      .single();
    
    if (error) throw error;
    return data as ServiceAddon;
  },

  // Update add-on
  async updateAddon(id: string, updates: Partial<ServiceAddon>) {
    const { data, error } = await supabase
      .from('service_addons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as ServiceAddon;
  },

  // Delete add-on
  async deleteAddon(id: string) {
    const { data, error } = await supabase
      .from('service_addons')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return data;
  },

  // Add add-ons to booking
  async addAddonsToBooking(bookingId: string, addons: Array<{addon_id: string, quantity: number, price_paid: number}>) {
    const bookingAddons = addons.map(addon => ({
      booking_id: bookingId,
      ...addon
    }));

    const { data, error } = await supabase
      .from('booking_addons')
      .insert(bookingAddons)
      .select();
    
    if (error) throw error;
    return data as BookingAddon[];
  },

  // Get add-ons for a booking
  async getBookingAddons(bookingId: string) {
    const { data, error } = await supabase
      .from('booking_addons')
      .select(`
        *,
        service_addons (*)
      `)
      .eq('booking_id', bookingId);
    
    if (error) throw error;
    return data;
  },

  // Remove add-on from booking
  async removeAddonFromBooking(bookingAddonId: string) {
    const { data, error } = await supabase
      .from('booking_addons')
      .delete()
      .eq('id', bookingAddonId);
    
    if (error) throw error;
    return data;
  },

  // Calculate total add-ons price for booking
  async calculateAddonsTotal(bookingId: string) {
    const { data, error } = await supabase
      .from('booking_addons')
      .select('price_paid, quantity')
      .eq('booking_id', bookingId);
    
    if (error) throw error;
    
    return data.reduce((total, addon) => {
      return total + (addon.price_paid * addon.quantity);
    }, 0);
  },

  // Set add-on compatibility for service
  async setServiceAddonCompatibility(serviceId: string, addonIds: string[]) {
    // First, remove all existing compatibility
    await supabase
      .from('service_addon_compatibility')
      .delete()
      .eq('service_id', serviceId);

    // Then add new compatibility
    if (addonIds.length > 0) {
      const compatibilities = addonIds.map(addonId => ({
        service_id: serviceId,
        addon_id: addonId
      }));

      const { data, error } = await supabase
        .from('service_addon_compatibility')
        .insert(compatibilities);
      
      if (error) throw error;
      return data;
    }
  },

  // Get addon categories for filtering
  getAddonCategories() {
    return [
      { value: 'general', label: 'General' },
      { value: 'hair', label: 'Hair Care' },
      { value: 'nails', label: 'Nail Care' },
      { value: 'beauty', label: 'Beauty' }
    ];
  }
};
