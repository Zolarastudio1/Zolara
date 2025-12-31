import { supabase } from '@/integrations/supabase/client';

export type Staff = {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  specialization_id?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Specialization = { id: string; name: string };

export async function fetchSpecializations() {
  try {
    const { data, error } = await (supabase as any).from('specializations').select('*').order('name');
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error: any) {
    return { data: [], error };
  }
}

export async function addSpecialization(name: string) {
  try {
    const { data, error } = await (supabase as any).from('specializations').insert([{ name }]);
    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function deleteSpecialization(id: string) {
  try {
    const { error } = await (supabase as any).from('specializations').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error };
  }
}

export async function fetchStaffWithDetails() {
  try {
    // Fetch staff and join specialization and assigned services (services array)
    const { data, error } = await (supabase as any)
      .from('staff')
      .select(`*, specializations(name), staff_services(service_id)`);
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error: any) {
    return { data: [], error };
  }
}

export async function assignServicesToStaff(staffId: string, serviceIds: string[]) {
  try {
    // Replace assignments: delete existing then insert new
    const { error: delErr } = await (supabase as any).from('staff_services').delete().eq('staff_id', staffId);
    if (delErr) throw delErr;
    if (serviceIds.length === 0) return { success: true };
    const rows = serviceIds.map((s) => ({ staff_id: staffId, service_id: s }));
    const { error } = await (supabase as any).from('staff_services').insert(rows);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error };
  }
}

export async function getServicesForStaff(staffId: string) {
  try {
    const { data, error } = await (supabase as any).from('staff_services').select('service_id').eq('staff_id', staffId);
    if (error) throw error;
    return { data: (data || []).map((r: any) => r.service_id), error: null };
  } catch (error: any) {
    return { data: [], error };
  }
}

export async function setStaffStatus(staffId: string, status: 'active'|'inactive'|'on_leave'|'suspended') {
  try {
    const { error } = await (supabase as any).from('staff').update({ status }).eq('id', staffId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error };
  }
}

export async function addWorkingHours(staffId: string, dayOfWeek: number, startTime: string, endTime: string) {
  try {
    const { data, error } = await (supabase as any).from('staff_working_hours').insert([{ staff_id: staffId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime }]);
    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function getWorkingHours(staffId: string) {
  try {
    const { data, error } = await (supabase as any).from('staff_working_hours').select('*').eq('staff_id', staffId).order('day_of_week');
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error: any) {
    return { data: [], error };
  }
}

export async function addOffDay(staffId: string, offDate: string, reason?: string) {
  try {
    const { data, error } = await (supabase as any).from('staff_off_days').insert([{ staff_id: staffId, off_date: offDate, reason }]);
    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function getOffDays(staffId: string) {
  try {
    const { data, error } = await (supabase as any).from('staff_off_days').select('*').eq('staff_id', staffId).order('off_date');
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error: any) {
    return { data: [], error };
  }
}

export async function getAttendanceForStaff(staffId: string, fromDate?: string, toDate?: string) {
  try {
    let q: any = (supabase as any).from('attendance').select('*').eq('staff_id', staffId).order('check_in', { ascending: false });
    if (fromDate && toDate) q = q.gte('check_in', fromDate).lte('check_in', toDate);
    const { data, error } = await q;
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error: any) {
    return { data: [], error };
  }
}
