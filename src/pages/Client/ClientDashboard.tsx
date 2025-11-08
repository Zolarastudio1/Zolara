import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ClientDashboard = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleDialog, setRescheduleDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    const {
      data,
      error,
    } = await supabase
      .from("bookings")
      .select("*, staff(full_name), services(name)")
      .eq("client_id", (await supabase.auth.getUser()).data.user?.id)
      .order("appointment_date", { ascending: true });

    if (error) {
      toast.error(error.message);
    } else {
      setBookings(data || []);
    }
    setLoading(false);
  };

  const handleCancel = async (id: string) => {
    const confirm = window.confirm("Are you sure you want to cancel this booking?");
    if (!confirm) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) toast.error("Failed to cancel booking");
    else {
      toast.success("Booking cancelled successfully");
      fetchBookings();
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
      fetchBookings();
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
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground">
            View, manage, or reschedule your appointments
          </p>
        </div>
        <Button onClick={() => navigate("/services")}>Book New Service</Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : bookings.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No bookings yet. Book your first appointment!
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bookings.map((booking) => (
            <Card key={booking.id} className="hover:shadow-lg transition-shadow">
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

export default ClientDashboard;
