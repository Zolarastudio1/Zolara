import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchUserBookings } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PaymentDialog from "@/components/PaymentDialog";

const ClientBookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [requestBookings, setRequestBookings] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleDialog, setRescheduleDialog] = useState(false);
  const [requestDialog, setRequestDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        toast.error("Please sign in first");
        return;
      }

      const [bookingsRes, requestsRes, servicesRes] = await Promise.all([
        // Fetch bookings for this user only
        supabase
          .from("bookings")
          .select("*, clients(*), staff(*), services(*)")
          .eq("client_id", user.id)
          .order("appointment_date", { ascending: false }),

        // Fetch booking requests for this user only
        supabase
          .from("booking_requests")
          .select("*, clients(*), services(*)")
          .eq("client_id", user.id)
          .order("created_at", { ascending: false }),

        // Fetch all services
        supabase.from("services").select("*").order("name"),
      ]);

      if (bookingsRes.data) setBookings(bookingsRes.data);
      if (requestsRes.data) setRequestBookings(requestsRes.data);
      if (servicesRes.data) setServices(servicesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    const confirm = window.confirm(
      "Are you sure you want to cancel this booking?"
    );
    if (!confirm) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) toast.error("Failed to cancel booking");
    else {
      toast.success("Booking cancelled successfully");
      fetchUserBookings({
        table: "bookings",
        setState: setBookings,
        setLoading,
        role: "client",
      });
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBooking) return;

    const { error } = await supabase
      .from("bookings")
      .update({
        appointment_date: newDate,
        appointment_time: newTime,
        status: "scheduled",
      })
      .eq("id", selectedBooking.id);

    if (error) toast.error("Failed to reschedule");
    else {
      toast.success("Booking rescheduled successfully");
      setRescheduleDialog(false);

      fetchUserBookings({
        table: "booking_requests",
        setState: setRequestBookings,
        setLoading,
        role: "client",
      });

      fetchUserBookings({
        table: "booking",
        setState: setBookings,
        setLoading,
        role: "client",
      });
    }
  };

  const handleRequestBooking = async (e: React.FormEvent) => {
    setRequesting(true);
    e.preventDefault();
    const user = (await supabase.auth.getUser()).data.user;

    if (!user) {
      toast.error("Please sign in first");
      return;
    }

    if (!selectedService || !preferredDate || !preferredTime) {
      toast.error("Please fill in all fields");
      return;
    }

    const { data: existingClient } = await supabase
      .from("clients")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!existingClient) {
      const clientData = {
        id: user.id,
        full_name: user.user_metadata.full_name,
        email: user.email,
        phone: user.user_metadata.phone || "",
      };

      const { data, error } = await supabase.functions.invoke("invite-user", {
        method: "POST",
        body: JSON.stringify(clientData),
      });
    }

    // @ts-ignore
    const { error } = await supabase.from("booking_requests").insert([
      {
        client_id: user.id,
        service_id: selectedService,
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        notes,
        status: "pending",
      },
    ]);

    if (error) {
      toast.error(error.message || "Failed to request booking");
      setRequesting(false);
    } else {
      toast.success("Booking request submitted successfully!");

      fetchUserBookings({
        table: "booking_requests",
        setState: setRequestBookings,
        setLoading,
        role: "client",
      });

      setRequestDialog(false);
      setSelectedService("");
      setPreferredDate("");
      setPreferredTime("");
      setNotes("");
      setRequesting(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      scheduled: "bg-blue-100 text-blue-800",
      confirmed: "bg-green-100 text-green-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
      no_show: "bg-yellow-100 text-yellow-800",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-sm text-gray-500 mt-1">
            View, manage, or request new appointments
          </p>
        </div>

        <Dialog open={requestDialog} onOpenChange={setRequestDialog}>
          <DialogTrigger asChild>
            <Button className="whitespace-nowrap">Request New Booking</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Booking</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleRequestBooking} className="space-y-4">
              <div>
                <Label>Service</Label>
                <select
                  className="w-full border rounded-md p-2 mt-1"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  required
                >
                  <option value="">Select a service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Preferred Date</Label>
                  <Input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Preferred Time</Label>
                  <Input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) =>
                    setPaymentMethod(
                      value as "cash" | "card" | "momo" | "bank_transfer"
                    )
                  }
                >
                  <SelectTrigger id="payment-method">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card (Paystack)</SelectItem>
                    <SelectItem value="momo">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requests..."
                  className="mt-1"
                />
              </div>

              <Button type="submit" className="w-full">
                {!requesting ? "Submit Request" : "Loading..."}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loader */}
      {loading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : requestBookings.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No bookings yet. Request your first appointment!
        </Card>
      ) : (
        <>
          {/* Confirmed Bookings */}
          <section className="space-y-4 mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">
                Confirmed Bookings
              </h2>
              <p className="text-sm text-gray-500">
                Confirmed and upcoming appointments
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {bookings.map((booking) => (
                <Card
                  key={booking.id}
                  className="hover:shadow-lg transition-shadow border border-gray-200 rounded-2xl overflow-hidden"
                >
                  <CardHeader className="flex justify-between items-start">
                    <div>
                      <CardTitle>{booking.services?.name}</CardTitle>
                      <p className="text-sm text-gray-500">
                        {booking.staff?.full_name || "Unassigned"}
                      </p>
                    </div>
                    <Badge className={getStatusColor(booking.status)}>
                      {booking.status}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(booking.appointment_date), "PPP")}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4" />
                      {booking.appointment_time}
                    </div>

                    <div className="flex gap-2 mt-4 flex-wrap">
                      {/* {booking.status === "scheduled" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setRescheduleDialog(true);
                            }}
                          >
                            Reschedule
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancel(booking.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      )} */}

                      {/* Make Payment button - visible for pending or scheduled bookings */}
                      {["scheduled", "pending_payment"].includes(
                        booking.status
                      ) && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setPaymentDialogOpen(true); // open your PaymentDialog
                          }}
                        >
                          Make Payment
                        </Button>
                      )}
                    </div>

                    {/* Optional: show price */}
                    <div className="mt-2 text-sm font-medium text-gray-700">
                      Amount: GH₵ {booking.services?.price.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Booking Requests */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">
                Booking Requests
              </h2>
              <p className="text-sm text-gray-500">
                Pending appointments you’ve requested
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {requestBookings.map((booking) => (
                <Card
                  key={booking.id}
                  className="hover:shadow-xl transition-shadow border border-gray-200 rounded-2xl overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 gap-4">
                    {/* Left: Service & Staff */}
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900">
                        {booking.services?.name || "Service"}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {booking.staff?.full_name || "Unassigned"}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Preferred payment method:{" "}
                        {booking.payment_method || "none"}
                      </p>

                      <div className="flex flex-wrap gap-4 mt-3 text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-5 h-5 text-blue-500" />
                          <span className="text-sm font-medium">
                            {booking.appointment_date
                              ? isValid(parseISO(booking.appointment_date))
                                ? format(
                                    parseISO(booking.appointment_date),
                                    "PPP"
                                  )
                                : "Invalid Date"
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-5 h-5 text-green-500" />
                          <span className="text-sm font-medium">
                            {booking.appointment_time || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status & Actions */}
                    <div className="flex flex-col items-end gap-3 mt-4 md:mt-0">
                      <Badge
                        className={`${getStatusColor(
                          booking.status
                        )} px-4 py-1 rounded-full uppercase text-xs font-semibold`}
                      >
                        {booking.status}
                      </Badge>

                      {booking.status === "scheduled" && (
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="px-4 py-2"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setRescheduleDialog(true);
                            }}
                          >
                            Reschedule
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="px-4 py-2"
                            onClick={() => handleCancel(booking.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialog} onOpenChange={setRescheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Booking</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReschedule} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>New Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label>New Time</Label>
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Confirm Reschedule
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      {selectedBooking && (
        <PaymentDialog
          admin={false}
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          booking={selectedBooking}
          onPaymentComplete={fetchData}
        />
      )}
    </div>
  );
};

export default ClientBookings;
