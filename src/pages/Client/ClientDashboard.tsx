import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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

const ClientDashboard = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    cancelled: 0,
    upcoming: 0,
    pending: 0,
    totalSpent: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
  setLoading(true);

  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    // --- Fetch this user's booking IDs for filtering payments ---
    const bookingIdsRes = await supabase
      .from("bookings")
      .select("id")
      .eq("client_id", user.id);

    const bookingIds = bookingIdsRes.data?.map(b => b.id) || [];

    const [bookingsRes, pendingRes, paymentsRes] = await Promise.all([
      // 1. Fetch user's bookings
      supabase
        .from("bookings")
        .select("*, staff(full_name), services(name, price)")
        .eq("client_id", user.id)
        .order("appointment_date", { ascending: false }),

      // 2. Fetch user's pending booking requests
      supabase
        .from("booking_requests")
        .select("*")
        .eq("client_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),

      // 3. Fetch user's payments by limiting to their booking IDs
      supabase
        .from("payments")
        .select(`
          *,
          bookings:booking_id(
            appointment_date,
            services(name)
          )
        `)
        .in("booking_id", bookingIds) // ← FIXED
        .order("payment_date", { ascending: false }),
    ]);

    if (bookingsRes.error) throw bookingsRes.error;
    if (pendingRes.error) throw pendingRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const bookingsData = bookingsRes.data || [];
    const pendingRequestsData = pendingRes.data || [];
    const paymentsData = paymentsRes.data || [];

    // --- Compute stats ---
    const computedStats = bookingsData.reduce(
      (acc, b) => {
        acc.total += 1;
        if (b.status === "completed") acc.completed += 1;
        if (b.status === "pending") acc.pending += 1;
        if (b.status === "cancelled") acc.cancelled += 1;
        if (["scheduled", "confirmed"].includes(b.status)) acc.upcoming += 1;
        return acc;
      },
      {
        total: 0,
        completed: 0,
        cancelled: 0,
        upcoming: 0,
        pending: pendingRequestsData.length,
        totalSpent: 0,
      }
    );

    computedStats.totalSpent =
      paymentsData.reduce((acc, p) => acc + Number(p.amount || 0), 0) || 0;

    // --- Update UI state ---
    setBookings(bookingsData);
    setPayments(paymentsData);
    setStats(computedStats);

  } catch (error: any) {
    console.error("Error fetching dashboard data:", error);
    toast.error(error.message || "Failed to load dashboard data");
  } finally {
    setLoading(false);
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
    <div className="space-y-8 p-6">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <p className="text-muted-foreground">
          Track your activity, spending, and appointment history
        </p>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          title="Total Bookings"
          value={stats.total}
          icon={<TrendingUp className="w-6 h-6 text-primary" />}
        />
        <StatCard
          title="Upcoming"
          value={stats.upcoming}
          icon={<Calendar className="w-6 h-6 text-blue-600" />}
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={<TrendingUp className="w-6 h-6 text-green-600" />}
        />
        <StatCard
          title="Cancelled"
          value={stats.cancelled}
          icon={<TrendingDown className="w-6 h-6 text-red-600" />}
        />
        <StatCard
          title="Pending Requests"
          value={stats.pending}
          icon={<Clock className="w-6 h-6 text-yellow-500" />}
        />
      </div>

      {/* Optional: Mobile-friendly horizontal scroll */}
      <div className="md:hidden overflow-x-auto">
        <div className="flex gap-4 w-max">
          {["Total", "Upcoming", "Completed", "Cancelled", "Pending"].map(
            (label, i) => (
              <Card
                key={i}
                className="rounded-2xl shadow-sm border border-gray-100 w-40 flex-shrink-0"
              >
                <CardContent className="flex flex-col items-start p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    {label}
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    {Object.values(stats)[i]}
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>

      {/* TOTAL EXPENSES */}
      <Card className="bg-primary/5 border border-primary/20">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Total Expenses</span>
            <DollarSign className="w-6 h-6 text-primary" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary">
            GH₵{stats.totalSpent.toLocaleString()}
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
            No bookings yet.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bookings.slice(0, 6).map((booking) => (
              <Card key={booking.id} className="hover:shadow-md">
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
                    {p.bookings?.services?.name || "Service Payment"}
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

export default ClientDashboard;

// Reusable Stat Card
const StatCard = ({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) => (
  <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
    <CardContent className="flex items-center justify-between p-5">
      <div>
        <p className="text-sm text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      {icon}
    </CardContent>
  </Card>
);
