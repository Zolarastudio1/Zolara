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

/*****  Staff *********/
export const fetchStaffBookings = async (staffId: string) => {
  try {
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, clients(*), services(name, price)")
      .eq("staff_id", staffId)
      .order("appointment_date", { ascending: false });

    if (error) throw error;

    return bookings || [];
  } catch (err: any) {
    console.error("Error fetching staff bookings:", err);
    return [];
  }
};

export const fetchStaffPayments = async (staffId: string) => {
  try {
    // 1. Get all bookings for this staff
    const { data: staffBookings = [], error: staffBookingsError } =
      await supabase
        .from("bookings")
        .select(
          "id, status, appointment_date, appointment_time, services(name)"
        )
        .eq("staff_id", staffId);

    if (staffBookingsError) throw staffBookingsError;

    const bookingIds = staffBookings.map((b) => b.id);

    // If no bookings, return empty stats
    if (bookingIds.length === 0) {
      return {
        paymentsWithBooking: [],
        stats: {
          total: 0,
          completed: 0,
          cancelled: 0,
          upcoming: 0,
          totalEarned: 0,
        },
        error: null,
      };
    }

    // 2. Fetch payments linked to staff bookings
    const { data: paymentsList = [], error: paymentsError } = await supabase
      .from("payments")
      .select(
        "id, amount, payment_method, payment_status, payment_date, booking_id"
      )
      .in("booking_id", bookingIds)
      .order("payment_date", { ascending: false });

    if (paymentsError) throw paymentsError;

    // 3. Create booking map
    const bookingMap = Object.fromEntries(staffBookings.map((b) => [b.id, b]));

    // 4. Merge payments with bookings
    const paymentsWithBooking = paymentsList.map((p) => ({
      ...p,
      booking: bookingMap[p.booking_id] || null,
    }));

    // 5. Stats
    const total = staffBookings.length;
    const completed = staffBookings.filter(
      (b) => b.status === "completed"
    ).length;
    const cancelled = staffBookings.filter(
      (b) => b.status === "cancelled"
    ).length;
    const upcoming = staffBookings.filter((b) =>
      ["scheduled", "confirmed"].includes(b.status)
    ).length;

    // Staff earnings = successful payments for completed bookings
    const totalEarned = paymentsWithBooking
      .filter((p) => p.booking?.status === "completed")
      .reduce((acc, p) => acc + Number(p.amount || 0), 0);

    // Final stats
    const stats = {
      total,
      completed,
      cancelled,
      upcoming,
      totalEarned,
    };

    return {
      paymentsWithBooking,
      stats,
      error: null,
    };
  } catch (error) {
    console.error("Error fetching staff payments:", error);
    return {
      paymentsWithBooking: [],
      stats: {
        total: 0,
        completed: 0,
        cancelled: 0,
        upcoming: 0,
        totalEarned: 0,
      },
      error,
    };
  }
};

/*****  Clients *********/
export const fetchClientBookings = async (clientId: string) => {
  try {
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, staff(*), services(name, price)")
      .eq("client_id", clientId)
      .order("appointment_date", { ascending: false });

    if (error) throw error;

    return bookings || [];
  } catch (err: any) {
    console.error("Error fetching client bookings:", err);
    return [];
  }
};

export const fetchClientPayments = async (clientId: string) => {
  try {
    // 1. Fetch all bookings for this client
    const { data: clientBookings = [], error: clientBookingsError } =
      await supabase
        .from("bookings")
        .select(
          "id, status, appointment_date, appointment_time, services(name)"
        )
        .eq("client_id", clientId);

    if (clientBookingsError) throw clientBookingsError;

    const bookingIds = clientBookings.map((b) => b.id);
    if (bookingIds.length === 0) {
      return {
        paymentsWithBooking: [],
        stats: {
          total: 0,
          completed: 0,
          cancelled: 0,
          upcoming: 0,
          totalSpent: 0,
        },
        error: null,
      };
    }

    // 2. Fetch payments linked to these bookings
    const { data: paymentsList = [], error: paymentsError } = await supabase
      .from("payments")
      .select(
        "id, amount, payment_method, payment_status, payment_date, booking_id"
      )
      .in("booking_id", bookingIds)
      .order("payment_date", { ascending: false });

    if (paymentsError) throw paymentsError;

    // 3. Merge bookings with payments
    const bookingMap = Object.fromEntries(clientBookings.map((b) => [b.id, b]));
    const paymentsWithBooking = paymentsList.map((p) => ({
      ...p,
      booking: bookingMap[p.booking_id] || null,
    }));

    // 4. Compute stats
    const stats = {
      total: clientBookings.length,
      completed: clientBookings.filter((b) => b.status === "completed").length,
      cancelled: clientBookings.filter((b) => b.status === "cancelled").length,
      upcoming: clientBookings.filter((b) =>
        ["scheduled", "confirmed"].includes(b.status)
      ).length,
      totalSpent: paymentsWithBooking
        .filter((p) => p.booking?.status === "completed")
        .reduce((acc, p) => acc + Number(p.amount || 0), 0),
    };

    return { paymentsWithBooking, stats, error: null };
  } catch (error) {
    console.error("Error fetching client payments:", error);
    return {
      paymentsWithBooking: [],
      stats: {
        total: 0,
        completed: 0,
        cancelled: 0,
        upcoming: 0,
        totalSpent: 0,
      },
      error,
    };
  }
};
