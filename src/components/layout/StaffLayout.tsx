import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Loader2,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  History,
} from "lucide-react";
import { fetchStaffBookings, fetchStaffPayments } from "@/lib/utils";

const StaffLayout = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    cancelled: 0,
    upcoming: 0,
    totalEarned: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const user = (await supabase.auth.getUser()).data.user;

    if (!user) return;

    const bookings = await fetchStaffBookings(user.id);
    setBookings(bookings);

    const { paymentsWithBooking, stats } = await fetchStaffPayments(user.id);

    setPayments(paymentsWithBooking);
    setStats(stats);

    setLoading(false);
  };

  console.log("Stats", stats, "Bookings", bookings)
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
    <div className="space-y-8 p-6">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <p className="text-muted-foreground">
          Track your bookings, payments, and performance
        </p>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <TrendingUp className="text-primary w-6 h-6" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-2xl font-bold">{stats.upcoming}</p>
            </div>
            <Calendar className="text-blue-600 w-6 h-6" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{stats.completed}</p>
            </div>
            <TrendingUp className="text-green-600 w-6 h-6" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Cancelled</p>
              <p className="text-2xl font-bold">{stats.cancelled}</p>
            </div>
            <TrendingDown className="text-red-600 w-6 h-6" />
          </CardContent>
        </Card>
      </div>

      {/* TOTAL EARNINGS */}
      <Card className="bg-primary/5 border border-primary/20">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Total Earnings</span>
            <DollarSign className="w-6 h-6 text-primary" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary">
            GH₵{stats.totalEarned.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* RECENT BOOKINGS */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Recent Bookings</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No assigned bookings for now.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bookings.slice(0, 6).map((booking) => (
              <Card key={booking.id} className="hover:shadow-md">
                <CardHeader className="flex justify-between items-start">
                  <div>
                    <CardTitle>{booking.services?.name}</CardTitle>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* PAYMENT LOGS */}
      <div>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <History className="w-5 h-5" /> Payment Logs
        </h2>

        {payments.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No payments recorded yet.
          </Card>
        ) : (
          <div className="space-y-2">
            {payments.slice(0, 5).map((p) => (
              <Card
                key={p.id}
                className="flex items-center justify-between p-4"
              >
                <div>
                  <p className="font-medium">
                    {p.booking?.services?.name || "Service Payment"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(p.payment_date), "PPP")}
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-800">
                  GH₵{Number(p.amount).toLocaleString()}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffLayout;
