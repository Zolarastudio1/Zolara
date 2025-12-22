import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, eachDayOfInterval } from "date-fns";
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Heart,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fetchClientBookings, fetchClientPayments } from "@/lib/utils";

const ClientDashboard = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    cancelled: 0,
    upcoming: 0,
    pending: 0,
    totalSpent: 0,
  });
  const [spendingData, setSpendingData] = useState<{ name: string; revenue: number }[]>([]);
  const [bookingStatusData, setBookingStatusData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [favoriteService, setFavoriteService] = useState("N/A");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // Get user profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      
      if (profile) setUserName(profile.full_name);

      // Fetch client bookings
      const bookings = await fetchClientBookings(user.id);
      setBookings(bookings);

      // Fetch client payments + stats
      const { paymentsWithBooking, stats } = await fetchClientPayments(user.id);
      setPayments(paymentsWithBooking);

      // Fetch pending booking requests for this client
      const { data: pendingRequests = [], error: pendingError } = await supabase
        .from("booking_requests")
        .select("*, services(*)")
        .eq("client_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (pendingError) throw pendingError;

      // Calculate status distribution
      const statusCounts: Record<string, number> = {
        completed: stats.completed,
        cancelled: stats.cancelled,
        upcoming: stats.upcoming,
        pending: pendingRequests.length,
      };

      const statusColors: Record<string, string> = {
        completed: "hsl(152, 60%, 42%)",
        cancelled: "hsl(0, 72%, 55%)",
        upcoming: "hsl(210, 80%, 52%)",
        pending: "hsl(38, 92%, 50%)",
      };

      const statusData = Object.entries(statusCounts)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          color: statusColors[name] || "hsl(220, 10%, 50%)",
        }));
      
      setBookingStatusData(statusData);

      // Find favorite service
      const serviceCounts = bookings.reduce((acc: any, b: any) => {
        const serviceName = b.services?.name || "Unknown";
        acc[serviceName] = (acc[serviceName] || 0) + 1;
        return acc;
      }, {});
      const topService = Object.entries(serviceCounts).sort(
        (a: any, b: any) => b[1] - a[1]
      )[0]?.[0] || "N/A";
      setFavoriteService(topService);

      // Calculate last 6 months spending
      const today = new Date();
      const months = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return { date, name: format(date, "MMM") };
      }).reverse();

      const spendingByMonth = (paymentsWithBooking || []).reduce((acc: any, p: any) => {
        if (p?.payment_date) {
          const month = format(new Date(p.payment_date), "MMM");
          acc[month] = (acc[month] || 0) + Number(p.amount || 0);
        }
        return acc;
      }, {});

      const spendingChartData = months.map((m) => ({
        name: m.name,
        revenue: spendingByMonth[m.name] || 0,
      }));

      setSpendingData(spendingChartData);

      // Update stats including pending requests
      setStats({
        ...stats,
        pending: pendingRequests.length,
      });
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      toast.error(error.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
            <Loader2 className="w-16 h-16 absolute inset-0 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Format recent bookings for activity list
  const recentBookingItems = bookings.slice(0, 5).map((b) => ({
    id: b.id,
    title: b.services?.name || "Service",
    subtitle: format(new Date(b.appointment_date), "MMM d") + " at " + b.appointment_time,
    date: b.appointment_date,
    status: b.status,
  }));

  // Format recent payments for activity list
  const recentPaymentItems = payments.slice(0, 5).map((p: any) => ({
    id: p.id,
    title: p.booking?.services?.name || "Service Payment",
    date: p.payment_date,
    amount: Number(p.amount),
  }));

  return (
    <div className="space-y-8 p-6">
      <DashboardHeader
        title="My Dashboard"
        userName={userName}
        subtitle="Track your beauty journey and appointments"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Visits"
          value={stats.total}
          icon={<Calendar className="w-6 h-6" />}
          variant="gold"
          delay={0}
        />
        <StatCard
          title="Upcoming"
          value={stats.upcoming}
          icon={<Clock className="w-6 h-6" />}
          variant="blue"
          delay={0.1}
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={<TrendingUp className="w-6 h-6" />}
          variant="green"
          delay={0.2}
        />
        <StatCard
          title="Cancelled"
          value={stats.cancelled}
          icon={<TrendingDown className="w-6 h-6" />}
          variant="default"
          delay={0.3}
        />
        <StatCard
          title="Pending Requests"
          value={stats.pending}
          icon={<Clock className="w-6 h-6" />}
          variant="purple"
          delay={0.4}
        />
      </div>

      {/* Spending & Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Total Spent Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="gradient-purple text-primary-foreground h-full overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="relative z-10">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                <CardTitle className="text-lg font-display">Total Spent</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <p className="text-4xl font-bold font-display">
                GH₵{stats.totalSpent.toLocaleString()}
              </p>
              <p className="text-sm opacity-80 mt-2">On beauty services</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Favorite Service */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Card className="glass-card h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-destructive fill-destructive" />
                <CardTitle className="text-lg font-display">Your Favorite</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-display">{favoriteService}</p>
                  <p className="text-sm text-muted-foreground">Most booked service</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Booking Distribution */}
        <DonutChart
          data={bookingStatusData}
          title="Booking Status"
          subtitle="Your appointment history"
          centerValue={stats.total}
          centerLabel="Total"
        />
      </div>

      {/* Spending Chart */}
      <RevenueChart
        data={spendingData}
        title="Your Spending"
        subtitle="Last 6 months"
      />

      {/* Activity Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityList
          title="Recent Appointments"
          subtitle="Your latest visits"
          items={recentBookingItems}
          icon={<Calendar className="w-5 h-5 text-primary" />}
          emptyMessage="No appointments yet"
        />
        <ActivityList
          title="Payment History"
          subtitle="Your transactions"
          items={recentPaymentItems}
          showAmount
          icon={<DollarSign className="w-5 h-5 text-success" />}
          emptyMessage="No payments recorded yet"
        />
      </div>
    </div>
  );
};

export default ClientDashboard;