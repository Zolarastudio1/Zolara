import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format, isToday, parseISO, isAfter, startOfToday } from "date-fns";
import { z } from "zod";
import { useSettings } from "@/context/SettingsContext";
import { normalizeTimeTo24, isTimeWithinRange, timeToMinutes, formatTo12Hour } from "@/lib/time";
import { getOffDays, getWorkingHours } from "@/lib/staff";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { CollapsibleSearchBar } from "@/components/SearchBar";
import { BookingFilters, BookingFilter, ViewMode } from "@/components/bookings/BookingFilters";
import { BulkActions } from "@/components/bookings/BulkActions";
import { BookingCard } from "@/components/bookings/BookingCard";
import { CalendarView } from "@/components/bookings/CalendarView";
import { TodaysBookings } from "@/components/bookings/TodaysBookings";
import { CancelBookingDialog } from "@/components/bookings/CancelBookingDialog";

const bookingSchema = z.object({
  client_id: z.string().uuid("Invalid client selection"),
  service_id: z.string().uuid("Invalid service selection"),
  staff_id: z.string().uuid("Invalid staff selection").optional().or(z.literal("")),
  appointment_date: z.string().min(1, "Date is required"),
  appointment_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format"),
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]).optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
});

const Bookings = () => {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [bookings, setBookings] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [requestPage, setRequestPage] = useState(1);
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const itemsPerPage = 20;
  const totalBookingPages = Math.ceil(totalBookings / itemsPerPage);
  const totalRequestPages = Math.ceil(totalRequests / itemsPerPage);

  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);

  // New state for enhanced features
  const [activeFilter, setActiveFilter] = useState<BookingFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  const [formData, setFormData] = useState<any>({
    client_id: "",
    staff_id: "",
    service_id: "",
    appointment_date: "",
    appointment_time: "",
    status: "scheduled",
    notes: "",
  });
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
    fetchAllBookings();
  }, []);

  // Generate available time slots based on shop hours and selected staff availability
  useEffect(() => {
    const open = (settings as any)?.open_time || "08:30";
    const close = (settings as any)?.close_time || "21:00";
    const step = 15; // minutes

    const generateTimeOptions = (openT: string, closeT: string, stepMins = 15) => {
      const startMin = timeToMinutes(openT);
      const endMin = timeToMinutes(closeT);
      if (isNaN(startMin) || isNaN(endMin) || endMin < startMin) return [];
      const out: string[] = [];
      for (let m = startMin; m <= endMin; m += stepMins) {
        const hh = Math.floor(m / 60).toString().padStart(2, "0");
        const mm = (m % 60).toString().padStart(2, "0");
        out.push(`${hh}:${mm}`);
      }
      return out;
    };

    const baseOptions = generateTimeOptions(open, close, step);

    if (!formData.staff_id) {
      setAvailableTimes(baseOptions);
      return;
    }

    // If staff selected, filter by their working hours for the appointment day
    (async () => {
      try {
        const whRes = await getWorkingHours(formData.staff_id);
        const wh = whRes.data || [];
        if (!wh || wh.length === 0) {
          setAvailableTimes(baseOptions);
          return;
        }

        const apptDay = formData.appointment_date ? new Date(formData.appointment_date).getDay() : null;
        if (apptDay === null) {
          setAvailableTimes(baseOptions);
          return;
        }

        const daySlots = wh.filter((s: any) => Number(s.day_of_week) === apptDay);
        if (!daySlots || daySlots.length === 0) {
          // staff has no slots for that day — fall back to shop hours
          setAvailableTimes(baseOptions);
          return;
        }

        const filtered = baseOptions.filter((t) => daySlots.some((s: any) => isTimeWithinRange(t, s.start_time, s.end_time)));
        setAvailableTimes(filtered);
      } catch (err) {
        setAvailableTimes(baseOptions);
      }
    })();
  }, [settings, formData.staff_id, formData.appointment_date]);

  useEffect(() => {
    fetchBookings(page);
  }, [page]);

  useEffect(() => {
    fetchBookingRequests(requestPage);
  }, [requestPage]);

  const fetchAllBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, clients(*), staff(*), services(*)")
        .order("appointment_date", { ascending: false });

      if (error) throw error;
      setAllBookings(data || []);
    } catch (error) {
      console.error("Error fetching all bookings:", error);
    }
  };

  const fetchBookings = async (pageNumber = page) => {
    try {
      const start = (pageNumber - 1) * itemsPerPage;
      const end = start + itemsPerPage - 1;

      const { data, count, error } = await supabase
        .from("bookings")
        .select("*, clients(*), staff(*), services(*)", { count: "exact" })
        .order("appointment_date", { ascending: false })
        .range(start, end);

      if (error) throw error;

      setBookings(data || []);
      setTotalBookings(count || 0);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingRequests = async (pageNumber = page) => {
    try {
      const start = (pageNumber - 1) * itemsPerPage;
      const end = start + itemsPerPage - 1;

      const { data, count, error } = await supabase
        .from("booking_requests")
        .select("*, clients(*), services(*)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(start, end);

      if (error) throw error;

      setRequests(data || []);
      setTotalRequests(count || 0);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [clientsRes, staffRes, servicesRes] = await Promise.all([
        supabase.from("clients").select("*").order("full_name"),
        supabase.from("staff").select("*").order("full_name"),
        supabase.from("services").select("*").order("name"),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (staffRes.data) setStaff(staffRes.data);
      if (servicesRes.data) setServices(servicesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Filter bookings based on active filter
  const filteredBookings = useMemo(() => {
    const sourceBookings = searchResults !== null ? searchResults : bookings;
    const today = startOfToday();

    return sourceBookings.filter((b) => {
      const bookingDate = parseISO(b.appointment_date);

      switch (activeFilter) {
        case "today":
          return isToday(bookingDate);
        case "upcoming":
          return isAfter(bookingDate, today) && !["completed", "cancelled"].includes(b.status);
        case "completed":
          return b.status === "completed";
        case "cancelled":
          return b.status === "cancelled";
        case "confirmed":
          return b.status === "confirmed";
        case "scheduled":
          return b.status === "scheduled";
        default:
          return true;
      }
    });
  }, [bookings, searchResults, activeFilter]);

  const todayBookingsCount = useMemo(() => {
    return allBookings.filter((b) => isToday(parseISO(b.appointment_date))).length;
  }, [allBookings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Normalize appointment_time to 24h before validation
      const normalized = { ...formData };
      if (normalized.appointment_time) {
        normalized.appointment_time = normalizeTimeTo24(normalized.appointment_time);
      }

      const validated = bookingSchema.parse(normalized);

      // Server-side validation: call RPC to validate booking rules (defensive)
      try {
        const resp: any = await (supabase as any).rpc('rpc_validate_booking', {
          p_staff_id: validated.staff_id || null,
          p_appointment_date: validated.appointment_date,
          p_appointment_time: validated.appointment_time,
        });
        const rpcData: any = resp?.data ?? resp; // supabase typings vary
        if (rpcData) {
          if (typeof rpcData === 'string' && rpcData.length > 0) throw new Error(rpcData);
        }
      } catch (err: any) {
        // If RPC fails (not deployed) or returns error string, bubble up for user to see
        throw err;
      }

      // Enforce operating hours from SettingsContext (if present)
      const openTime = (settings as any)?.open_time || "08:30";
      const closeTime = (settings as any)?.close_time || "21:00";
      if (!isTimeWithinRange(validated.appointment_time, openTime, closeTime)) {
        throw new Error(`Appointment time must be within operating hours (${openTime} — ${closeTime})`);
      }

      // If staff is assigned, enforce staff working hours for that day
      if (validated.staff_id) {
        try {
          const whRes = await getWorkingHours(validated.staff_id);
          const wh = whRes.data || [];
          const apptDay = new Date(validated.appointment_date).getDay(); // 0-6
          // If staff has no configured working hours, allow bookings during shop operating hours (openTime/closeTime already set above)
          if (wh.length === 0) {
            // already enforced shop hours above, so nothing more to do
          } else {
            const daySlots = wh.filter((s: any) => Number(s.day_of_week) === apptDay);
            if (daySlots.length === 0) {
              // No slots for that day; disallow unless shop hours allow it (we already enforced shop hours globally)
              // We'll allow the booking if it fits shop hours (already checked above), otherwise reject earlier.
            } else {
              const withinAny = daySlots.some((s: any) => {
                const start = s.start_time;
                const end = s.end_time;
                return isTimeWithinRange(validated.appointment_time, start, end);
              });
              if (!withinAny) {
                throw new Error("Selected staff is not available at the chosen time");
              }
            }
          }

          // Additionally, check off-days for the staff
          try {
            const odRes = await getOffDays(validated.staff_id);
            const ods = odRes.data || [];
            const hasOff = ods.some((d: any) => d.off_date === validated.appointment_date);
            if (hasOff) throw new Error("Selected staff is off on the chosen date");
          } catch (err) {
            // ignore off-day errors (non-fatal) — if getOffDays failed we don't block here
          }
          // Also ensure staff is active
          const staffMember = staff.find((s: any) => s.id === validated.staff_id);
          if (staffMember && staffMember.status && staffMember.status !== 'active') {
            throw new Error('Selected staff is not active');
          }
        } catch (err: any) {
          throw err;
        }
      }

      const bookingData = {
        client_id: validated.client_id,
        service_id: validated.service_id,
        staff_id: validated.staff_id || null,
        appointment_date: validated.appointment_date,
        appointment_time: validated.appointment_time,
        status: validated.status || "scheduled",
        notes: validated.notes || "",
      };

      if (editingBookingId) {
        const { error } = await supabase
          .from("bookings")
          .update(bookingData)
          .eq("id", editingBookingId);
        if (error) throw error;
        toast.success("Booking updated successfully");
      } else {
        const { error } = await supabase.from("bookings").insert([bookingData]);
        if (error) throw error;
        toast.success("Booking created successfully");
      }

      setDialogOpen(false);
      setEditingBookingId(null);
      resetFormData();
      fetchBookings();
      fetchAllBookings();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to save booking");
      }
    }
  };

  const resetFormData = () => {
    setFormData({
      client_id: "",
      staff_id: "",
      service_id: "",
      appointment_date: "",
      appointment_time: "",
      status: "scheduled",
      notes: "",
    });
  };

  const handleDelete = async () => {
    if (!deleteBookingId) return;

    try {
      const { error } = await supabase.from("bookings").delete().eq("id", deleteBookingId);
      if (error) throw error;

      toast.success("Booking deleted successfully");
      fetchBookings();
      fetchAllBookings();
    } catch (error: any) {
        console.error("Delete error:", error);

      toast.error("Failed to delete booking");
    } finally {
      setDeleteDialogOpen(false);
      setDeleteBookingId(null);
    }
  };

  const handleRequestStatus = async (requestId: string, status: "approved" | "declined") => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    try {
      const { error: updateError } = await supabase
        .from("booking_requests")
        .update({ status })
        .eq("id", requestId);

      if (updateError) throw updateError;

      if (status === "approved") {
        const { error: insertError } = await supabase.from("bookings").insert([
          {
            client_id: request.client_id,
            staff_id: request.staff_id || null,
            service_id: request.service_id,
            appointment_date: request.appointment_date,
            appointment_time: request.appointment_time,
            status: "scheduled",
            notes: request.notes,
          },
        ]);

        if (insertError) throw insertError;
        toast.success("Booking created and request approved!");
        fetchBookingRequests();
        fetchBookings();
        fetchAllBookings();
      } else {
        toast.info("Request declined");
        fetchBookingRequests();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update request or create booking");
    }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
    // If cancelling, show cancel dialog with reason
    if (newStatus === "cancelled") {
      const booking = bookings.find((b) => b.id === bookingId);
      setBookingToCancel(booking);
      setCancelDialogOpen(true);
      return;
    }

    try {
      const { error } = await supabase
        .from("bookings")
        // @ts-ignore
        .update({ status: newStatus })
        .eq("id", bookingId);

      if (error) throw error;

      toast.success("Booking status updated");
      fetchBookings();
      fetchAllBookings();
    } catch (err: any) {
      toast.error(err.message || "Status update failed");
    }
  };

  const handleCancelWithReason = async (reason: string) => {
    if (!bookingToCancel) return;

    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "cancelled",
          notes: bookingToCancel.notes
            ? `${bookingToCancel.notes}\n\nCancellation reason: ${reason}`
            : `Cancellation reason: ${reason}`,
        })
        .eq("id", bookingToCancel.id);

      if (error) throw error;

      toast.success("Booking cancelled");
      setCancelDialogOpen(false);
      setBookingToCancel(null);
      fetchBookings();
      fetchAllBookings();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel booking");
    }
  };

  const handleQuickAssign = async (bookingId: string, staffId: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ staff_id: staffId })
        .eq("id", bookingId);

      if (error) throw error;

      toast.success("Staff assigned");
      fetchBookings();
      fetchAllBookings();
    } catch (err: any) {
      toast.error("Failed to assign staff");
    }
  };

  // Bulk actions
  const handleSelectBooking = (id: string) => {
    setSelectedBookings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedBookings(new Set());
  };

  const handleBulkComplete = async () => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "completed" })
        .in("id", Array.from(selectedBookings));

      if (error) throw error;

      toast.success(`${selectedBookings.size} bookings marked as completed`);
      handleClearSelection();
      fetchBookings();
      fetchAllBookings();
    } catch (err: any) {
      toast.error("Failed to update bookings");
    }
  };

  const handleBulkCancel = async (reason: string) => {
    try {
      // We need to update each booking with the reason appended to notes
      const updates = Array.from(selectedBookings).map(async (id) => {
        const booking = bookings.find((b) => b.id === id);
        return supabase
          .from("bookings")
          .update({
            status: "cancelled",
            notes: booking?.notes
              ? `${booking.notes}\n\nCancellation reason: ${reason}`
              : `Cancellation reason: ${reason}`,
          })
          .eq("id", id);
      });

      await Promise.all(updates);

      toast.success(`${selectedBookings.size} bookings cancelled`);
      handleClearSelection();
      fetchBookings();
      fetchAllBookings();
    } catch (err: any) {
      toast.error("Failed to cancel bookings");
    }
  };

  const handleBulkAssignStaff = async (staffId: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ staff_id: staffId })
        .in("id", Array.from(selectedBookings));

      if (error) throw error;

      const staffMember = staff.find((s) => s.id === staffId);
      toast.success(`${selectedBookings.size} bookings assigned to ${staffMember?.full_name}`);
      handleClearSelection();
      fetchBookings();
      fetchAllBookings();
    } catch (err: any) {
      toast.error("Failed to assign staff");
    }
  };

  const handleEditBooking = (booking: any) => {
    setEditingBookingId(booking.id);
    const timeFormatted = booking.appointment_time?.substring(0, 5) || "00:00";
    setFormData({
      ...booking,
      client_id: booking.client_id,
      staff_id: booking.staff_id || "",
      service_id: booking.service_id,
      appointment_time: timeFormatted,
    });
    setDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "confirmed":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "no_show":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Manage and track all appointments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingBookingId(null); resetFormData(); }}>
              <Plus className="w-4 h-4 mr-2" /> New Booking
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBookingId ? "Update Booking" : "Create New Booking"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Client</Label>
                <Select
                  value={formData.client_id || ""}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Service</Label>
                <Select
                  value={formData.service_id || ""}
                  onValueChange={(value) => setFormData({ ...formData, service_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Staff</Label>
                <Select
                  value={formData.staff_id || ""}
                  onValueChange={(value) => setFormData({ ...formData, staff_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.appointment_date || ""}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Select value={formData.appointment_time || ""} onValueChange={(value) => setFormData({ ...formData, appointment_time: value })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTimes.length === 0 ? (
                        <SelectItem value="">No available times</SelectItem>
                      ) : (
                        availableTimes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {(settings as any)?.use24HourFormat ? t : formatTo12Hour(t)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  placeholder="Optional notes"
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full">
                {editingBookingId ? "Update Booking" : "Create Booking"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Booking</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete this booking? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Today's Bookings Summary */}
      <TodaysBookings bookings={allBookings} onBookingClick={handleEditBooking} />

      {/* Filters and View Toggle */}
      <BookingFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        todayCount={todayBookingsCount}
      />

      {/* Bulk Actions */}
      <BulkActions
        selectedCount={selectedBookings.size}
        onClearSelection={handleClearSelection}
        onBulkComplete={handleBulkComplete}
        onBulkCancel={handleBulkCancel}
        onBulkAssignStaff={handleBulkAssignStaff}
        staff={staff}
      />

      {/* Bookings List */}
      <div className="w-full space-y-4">
        <div className="flex justify-end">
          <CollapsibleSearchBar
            data={bookings}
            placeholder="Search bookings..."
            onSearchResults={(results) => setSearchResults(results.length > 0 ? results : null)}
          />
        </div>

        {viewMode === "card" ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                staff={staff}
                isSelected={selectedBookings.has(b.id)}
                onSelect={handleSelectBooking}
                onEdit={handleEditBooking}
                onDelete={(id) => {
                  setDeleteBookingId(id);
                  setDeleteDialogOpen(true);
                }}
                onStatusUpdate={handleStatusUpdate}
                onQuickAssign={handleQuickAssign}
                paymentStatus={b.payment_status || "pending"}
              />
            ))}
          </div>
        ) : (
          <CalendarView bookings={filteredBookings} onBookingClick={handleEditBooking} />
        )}

        {filteredBookings.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No bookings found for the selected filter.
          </p>
        )}

        {/* Pagination (card view only) */}
        {viewMode === "card" && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <button
              disabled={page === 1}
              onClick={() => setPage((prev) => prev - 1)}
              className="px-4 py-2 rounded-lg bg-muted text-foreground disabled:opacity-50 hover:bg-muted/80 transition"
            >
              Prev
            </button>
            <span className="px-3 py-2 text-sm text-muted-foreground">
              Page {page} of {totalBookingPages}
            </span>
            <button
              disabled={page === totalBookingPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-lg bg-muted text-foreground disabled:opacity-50 hover:bg-muted/80 transition"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Booking Requests Section */}
      <div className="w-full space-y-4">
        <h2 className="text-2xl font-bold">Booking Requests</h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {requests.map((r) => (
            <Card
              key={r.id}
              className="rounded-2xl border shadow-sm hover:shadow-lg transition-all"
            >
              <CardHeader className="flex justify-between items-start pb-2">
                <div>
                  <CardTitle className="text-xl font-semibold">{r.services?.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">Client:</span> {r.clients?.full_name || "Unknown"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(r.preferred_date), "MMM dd, yyyy")} at {r.preferred_time}
                  </p>
                </div>
                <Badge className={`${getStatusColor(r.status)} text-xs px-3 py-1 rounded-full`}>
                  {r.status}
                </Badge>
              </CardHeader>

              {r.status === "pending" && (
                <CardContent className="flex gap-3 pt-2">
                  <Button className="flex-1 rounded-xl" onClick={() => handleRequestStatus(r.id, "approved")}>
                    Approve
                  </Button>
                  <Button
                    className="flex-1 rounded-xl"
                    variant="destructive"
                    onClick={() => handleRequestStatus(r.id, "declined")}
                  >
                    Decline
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}

          {requests.length === 0 && (
            <p className="text-muted-foreground text-center py-4 col-span-full">
              No booking requests at the moment.
            </p>
          )}
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            disabled={requestPage === 1}
            onClick={() => setRequestPage((p) => p - 1)}
            className="px-4 py-2 rounded-lg bg-muted text-foreground disabled:opacity-50 hover:bg-muted/80 transition"
          >
            Prev
          </button>
          <span className="px-3 py-2 text-sm text-muted-foreground">
            Page {requestPage} of {totalRequestPages}
          </span>
          <button
            disabled={requestPage === totalRequestPages}
            onClick={() => setRequestPage((p) => p + 1)}
            className="px-4 py-2 rounded-lg bg-muted text-foreground disabled:opacity-50 hover:bg-muted/80 transition"
          >
            Next
          </button>
        </div>
      </div>

      {/* Cancel Booking Dialog */}
      <CancelBookingDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleCancelWithReason}
        bookingInfo={
          bookingToCancel
            ? {
                clientName: bookingToCancel.clients?.full_name,
                serviceName: bookingToCancel.services?.name,
              }
            : undefined
        }
      />
    </div>
  );
};

export default Bookings;
