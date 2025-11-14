import { useEffect, useState } from "react";
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
import { format } from "date-fns";
import { z } from "zod";
import {
  Plus,
  Pencil,
  Trash2,
  CalendarClock,
  CreditCard,
  AlertTriangle,
} from "lucide-react";

const bookingSchema = z.object({
  client_id: z.string().uuid("Invalid client selection"),
  service_id: z.string().uuid("Invalid service selection"),
  staff_id: z
    .string()
    .uuid("Invalid staff selection")
    .optional()
    .or(z.literal("")),
  appointment_date: z.string().min(1, "Date is required"),
  appointment_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format"),
  status: z
    .enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"])
    .optional(),
  payment_mode: z.enum(["cash", "card", "transfer"]).optional(),
  payment_status: z.enum(["paid", "unpaid", "partial"]).optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
});

const Bookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);

  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({
    client_id: "",
    staff_id: "",
    service_id: "",
    appointment_date: "",
    appointment_time: "",
    status: "scheduled",
    // payment_mode: "cash",
    payment_status: "unpaid",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bookingsRes, requestsRes, clientsRes, staffRes, servicesRes] =
        await Promise.all([
          supabase
            .from("bookings")
            .select("*, clients(*), staff(*), services(*)")
            .order("appointment_date", { ascending: false }),
          supabase //@ts-ignore
            .from("booking_requests")
            .select("*, clients(*), services(*)")
            .order("created_at", { ascending: false }),
          supabase.from("clients").select("*").order("full_name"),
          supabase.from("staff").select("*").order("full_name"),
          supabase.from("services").select("*").order("name"),
        ]);

      if (bookingsRes.data) setBookings(bookingsRes.data);
      if (requestsRes.data) setRequests(requestsRes.data);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = bookingSchema.parse(formData);

      const bookingData = {
        client_id: validated.client_id,
        service_id: validated.service_id,
        staff_id: validated.staff_id || null,
        appointment_date: validated.appointment_date,
        appointment_time: validated.appointment_time,
        status: validated.status || "scheduled",
        // payment_mode: validated.payment_mode || "cash",
        // payment_status: validated.payment_status || "unpaid",
        notes: validated.notes || "",
      };

      if (editingBookingId) {
        // Update
        const { error } = await supabase
          .from("bookings")
          .update(bookingData)
          .eq("id", editingBookingId);
        if (error) throw error;
        toast.success("Booking updated successfully");
      } else {
        // Create new
        const { error } = await supabase.from("bookings").insert([bookingData]);
        if (error) throw error;
        toast.success("Booking created successfully");
      }

      setDialogOpen(false);
      setEditingBookingId(null);
      setFormData({
        client_id: "",
        staff_id: "",
        service_id: "",
        appointment_date: "",
        appointment_time: "",
        status: "scheduled",
        // payment_mode: "cash",
        // payment_status: "unpaid",
        notes: "",
      });
      fetchData();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to save booking");
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this booking?")) return;
    try {
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
      toast.success("Booking deleted successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete booking");
    }
  };

  // Handle admin approval or decline of requests
  const handleRequestStatus = async (
    requestId: string,
    status: "approved" | "declined"
  ) => {
    // Find the request
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    try {
      // Update booking request status
      const { error: updateError } = await supabase
        .from("booking_requests")
        .update({ status })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // If approved, create a new booking automatically
      if (status === "approved") {
        const { data: bookingData, error: insertError } = await supabase
          .from("bookings")
          .insert([
            {
              client_id: request.client_id,
              staff_id: request.staff_id,
              service_id: request.service_id,
              appointment_date: request.preferred_date,
              appointment_time: request.preferred_time,
              status: "scheduled",
              notes: request.notes,
            },
          ]);

        if (insertError) throw insertError;
        toast.success("Booking created and request approved!");
        fetchData(); // refresh bookings list
      } else {
        toast.info("Request declined");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update request or create booking");
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      scheduled: "bg-blue-100 text-blue-800",
      confirmed: "bg-indigo-100 text-indigo-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      no_show: "bg-yellow-100 text-yellow-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
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
          <p className="text-muted-foreground">
            Manage and track all appointments
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />{" "}
              {editingBookingId ? "Edit Booking" : "New Booking"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBookingId ? "Update Booking" : "Create New Booking"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Client */}
              <div>
                <Label>Client</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, client_id: value })
                  }
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

              {/* Service */}
              <div>
                <Label>Service</Label>
                <Select
                  value={formData.service_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, service_id: value })
                  }
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

              {/* Staff */}
              <div>
                <Label>Staff</Label>
                <Select
                  value={formData.staff_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, staff_id: value })
                  }
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

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.appointment_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        appointment_date: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={formData.appointment_time}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        appointment_time: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Payment */}
              {/* <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Mode</Label>
                  <Select
                    value={formData.payment_mode}
                    onValueChange={(value) =>
                      setFormData({ ...formData, payment_mode: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Payment Status</Label>
                  <Select
                    value={formData.payment_status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, payment_status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div> */}

              {/* Notes */}
              <div>
                <Label>Notes</Label>
                <Input
                  placeholder="Optional notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>

              <Button type="submit" className="w-full">
                {editingBookingId ? "Update Booking" : "Create Booking"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bookings List */}
      <div className="w-full px-4 space-y-10">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bookings.map((b) => (
            <Card
              key={b.id}
              className="rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-lg bg-white/70 backdrop-blur-sm transition-all"
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {b.clients?.full_name}
                    </CardTitle>
                    <p className="text-sm text-gray-500">{b.services?.name}</p>
                  </div>

                  <Badge
                    className={`${getStatusColor(
                      b.status
                    )} text-xs px-3 py-1 rounded-full`}
                  >
                    {b.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 text-xs">Staff</p>
                    <p className="font-medium">
                      {b.staff?.full_name || "Unassigned"}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500 text-xs">Date & Time</p>
                    <p className="font-medium">
                      {format(new Date(b.appointment_date), "MMM dd, yyyy")} at{" "}
                      {b.appointment_time}
                    </p>
                  </div>
                </div>

                <p className="text-gray-500 italic border-l-4 border-gray-300 pl-3">
                    {b.notes || "no note"}
                  </p>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      setEditingBookingId(b.id);
                      setFormData({
                        ...b,
                        client_id: b.client_id,
                        staff_id: b.staff_id || "",
                        service_id: b.service_id,
                      });
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-red-500 border-red-300"
                    onClick={() => handleDelete(b.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Booking Requests Section */}
      <div className="w-full px-4 space-y-10">
        <h1 className="text-3xl font-bold mb-4">Booking Requests</h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {requests.map((r) => (
            <Card
              key={r.id}
              className="rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-lg transition-all bg-white/70 backdrop-blur-sm"
            >
              <CardHeader className="flex justify-between items-start pb-2">
                <div>
                  <CardTitle className="text-xl font-semibold">
                    {r.services?.name}
                  </CardTitle>

                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-medium">Client:</span>{" "}
                    {r.profiles?.full_name || "Unknown"}
                  </p>

                  <p className="text-sm text-gray-500">
                    {format(new Date(r.preferred_date), "MMM dd, yyyy")} at{" "}
                    {r.preferred_time}
                  </p>
                </div>

                <Badge
                  className={`${getStatusColor(
                    r.status
                  )} text-xs px-3 py-1 rounded-full`}
                >
                  {r.status}
                </Badge>
              </CardHeader>

              {r.status === "pending" && (
                <CardContent className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 rounded-xl"
                    onClick={() => handleRequestStatus(r.id, "approved")}
                  >
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
            <p className="text-gray-500 text-center py-4 col-span-full">
              No booking requests at the moment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Bookings;
