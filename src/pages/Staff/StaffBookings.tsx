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
import { format } from "date-fns";
import { Loader2, Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchUserBookings } from "@/lib/utils";

const StaffBookings = () => {
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
  const [notes, setNotes] = useState("");
  const [requesting, setRequesting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bookingsRes, requestsRes, servicesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, clients(*), staff(*), services(*)")
          .order("appointment_date", { ascending: false }),
        supabase //@ts-ignore
          .from("booking_requests")
          .select("*, clients(*), services(*)")
          .order("created_at", { ascending: false }),
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
      await supabase.from("clients").insert({
        id: user.id,
        full_name: user.user_metadata.full_name,
        email: user.email,
        phone: user.user_metadata.phone || "",
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

  console.log(requestBookings)

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground">
            View, manage, or request new appointments
          </p>
        </div>
        <Dialog open={requestDialog} onOpenChange={setRequestDialog}>
          <DialogTrigger asChild>
            <Button>Request New Booking</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Booking</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleRequestBooking} className="space-y-4">
              <div>
                <Label>Service</Label>
                <select
                  className="w-full border rounded-md p-2"
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preferred Date</Label>
                  <Input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Preferred Time</Label>
                  <Input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requests..."
                />
              </div>
              <Button type="submit" className="w-full">
                {!requesting ? "Submit Request" : "Loading..."}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : requestBookings.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No bookings yet. Request your first appointment!
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {requestBookings.map((booking) => (
              <Card
                key={booking.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader className="flex justify-between items-start">
                  <div>
                    <CardTitle>{booking.services?.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {booking.staff?.full_name || "Unassigned"}
                    </p>
                  </div>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(booking.appointment_date), "PPP")}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    {booking.appointment_time}
                  </div>

                  <div className="flex gap-2 mt-4">
                    {booking.status === "scheduled" && (
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
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bookings.map((booking) => (
              <Card
                key={booking.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader className="flex justify-between items-start">
                  <div>
                    <CardTitle>{booking.services?.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {booking.staff?.full_name || "Unassigned"}
                    </p>
                  </div>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(booking.appointment_date), "PPP")}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    {booking.appointment_time}
                  </div>

                  <div className="flex gap-2 mt-4">
                    {booking.status === "scheduled" && (
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
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialog} onOpenChange={setRescheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Booking</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReschedule} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>New Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>New Time</Label>
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Confirm Reschedule
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffBookings;
