import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Fetches bookings or booking requests for any user role.
 *
 * @param {Object} options
 * @param {"bookings"|"booking_requests"} options.table - The Supabase table to fetch from.
 * @param {Function} options.setState - React state setter for storing results.
 * @param {Function} options.setLoading - React state setter for loading state.
 * @param {"client"|"staff"|"admin"} [options.role="client"] - The role of the user (controls filtering).
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetchUserBookings = async ({
  table,
  setState,
  setLoading,
  role = "client",
}) => {
  try {
    setLoading(true);

    // Get the authenticated user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const userId = userData?.user?.id;
    if (!userId) {
      toast.error("No user found. Please log in again.");
      return;
    }

    // Determine filter field based on role
    let filterField = "client_id";
    if (role === "staff") filterField = "staff_id";
    if (role === "admin") filterField = null;

    // Conditional SELECT and ORDER
    let selectQuery =
      table === "bookings"
        ? "*, staff(full_name), services(name)"
        : "*, services(name)";

    let orderField = table === "bookings" ? "appointment_date" : "created_at";

    // Build query
    let query = supabase
      .from(table)
      .select(selectQuery)
      .order(orderField, { ascending: true });

    if (filterField) query = query.eq(filterField, userId);

    // Execute query
    const { data, error } = await query;
    if (error) throw error;

    setState(data || []);
  } catch (err) {
    toast.error(err.message);
  } finally {
    setLoading(false);
  }
};
