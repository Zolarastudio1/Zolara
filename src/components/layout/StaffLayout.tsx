import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, eachDayOfInterval } from "date-fns";
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Star,
  Target,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { fetchStaffBookings, fetchStaffPayments } from "@/lib/utils";

const StaffDashboard = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    cancelled: 0,
    upcoming: 0,
    totalEarned: 0,
  });
  const [performanceData, setPerformanceData] = useState<{ name: string; revenue: number }[]>([]);
  const [bookingStatusData, setBookingStatusData] = useState<{ name: string; value: number; color: string }[]>([]);

  useEffect(() => {
    fetchDashboardData();
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      const metaDataRole = (user as any).user_metadata?.role;
      setUserRole(roleData?.role || metaDataRole || "");
    } catch (err) {
      console.error("Failed to fetch user role", err);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    const user = (await supabase.auth.getUser()).data.user;

    if (!user) return;

    // Get user profile name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    
    if (profile) setUserName(profile.full_name);

    const bookings = await fetchStaffBookings(user.id);
    setBookings(bookings);

    const { paymentsWithBooking, stats } = await fetchStaffPayments(user.id);
    setPayments(paymentsWithBooking);
    setStats(stats);

    // Calculate status distribution
    const statusCounts: Record<string, number> = {
      completed: stats.completed,
      cancelled: stats.cancelled,
      upcoming: stats.upcoming,
    };

    const statusColors: Record<string, string> = {
      completed: "hsl(152, 60%, 42%)",
      cancelled: "hsl(0, 72%, 55%)",
      upcoming: "hsl(210, 80%, 52%)",
    };

    const statusData = Object.entries(statusCounts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: statusColors[name] || "hsl(220, 10%, 50%)",
      }));
    
    setBookingStatusData(statusData);

    // Calculate last 7 days performance
    const today = new Date();
    const last7Days = eachDayOfInterval({
      start: subDays(today, 6),
      end: today,
    });

    const revenueByDay = (paymentsWithBooking || []).reduce((acc: any, p: any) => {
      if (p?.booking?.status === "completed" && p?.payment_date) {
        const day = format(new Date(p.payment_date), "yyyy-MM-dd");
        acc[day] = (acc[day] || 0) + Number(p.amount || 0);
      }
      return acc;
    }, {});

    const performanceChartData = last7Days.map((day) => ({
      name: format(day, "EEE"),
      revenue: revenueByDay[format(day, "yyyy-MM-dd")] || 0,
    }));

    setPerformanceData(performanceChartData);
    setLoading(false);
  };

  // Calculate completion rate
  const completionRate = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

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
  const recentPaymentItems = payments.slice(0, 5).map((p) => ({
    id: p.id,
    title: p.booking?.services?.name || "Service Payment",
    date: p.payment_date,
    amount: Number(p.amount),
  }));

  return (
    <div className="space-y-8 p-6">
      <DashboardHeader
        title="Staff Dashboard"
        userName={userName}
        subtitle="Track your bookings, performance, and earnings"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Bookings"
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
      </div>

      {/* Earnings & Performance (financial widgets hidden for non-admin roles) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Total Earnings Card */}
        {(userRole === "owner" || userRole === "admin") && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="gradient-gold text-primary-foreground h-full overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="relative z-10">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                <CardTitle className="text-lg font-display">Total Earnings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <p className="text-4xl font-bold font-display">
                GH₵{stats.totalEarned.toLocaleString()}
              </p>
              <p className="text-sm opacity-80 mt-2">From completed services</p>
            </CardContent>
          </Card>
        </motion.div>
        )}

        {/* Completion Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="glass-card h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-success" />
                <CardTitle className="text-lg font-display">Completion Rate</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold font-display">{completionRate}%</p>
                <div className="flex items-center gap-1 text-sm text-success mb-1">
                  <Star className="w-4 h-4 fill-success" />
                  <span>Excellent</span>
                </div>
              </div>
              <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 1, delay: 0.6 }}
                  className="h-full bg-success rounded-full"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Booking Distribution */}
        <DonutChart
          data={bookingStatusData}
          title="Booking Status"
          subtitle="Your distribution"
          centerValue={stats.total}
          centerLabel="Total"
        />
      </div>

      {/* Performance Chart (financial) */}
      {(userRole === "owner" || userRole === "admin") ? (
        <RevenueChart
          data={performanceData}
          title="Your Earnings"
          subtitle="Last 7 days performance"
        />
      ) : null}

      {/* Activity Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityList
          title="Recent Bookings"
          subtitle="Your latest appointments"
          items={recentBookingItems}
          icon={<Calendar className="w-5 h-5 text-primary" />}
          emptyMessage="No assigned bookings yet"
        />
        {(userRole === "owner" || userRole === "admin") ? (
          <ActivityList
            title="Payment History"
            subtitle="Your earnings log"
            items={recentPaymentItems}
            showAmount
            icon={<DollarSign className="w-5 h-5 text-success" />}
            emptyMessage="No payments recorded yet"
          />
        ) : (
          <ActivityList
            title="Recent Activity"
            subtitle="Your recent bookings"
            items={recentBookingItems}
            icon={<Calendar className="w-5 h-5 text-primary" />}
            emptyMessage="No recent activity"
          />
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;