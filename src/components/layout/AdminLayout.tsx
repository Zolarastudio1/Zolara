import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Briefcase,
  Clock,
  History,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
  subDays,
  eachDayOfInterval,
} from "date-fns";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { TopServiceCard } from "@/components/dashboard/TopServiceCard";
import { Loader2 } from "lucide-react";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    todayBookings: 0,
    todayRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    totalClients: 0,
    activeStaff: 0,
    topService: "N/A",
    topServiceCount: 0,
    monthChangePercentage: 0,
    clientChangePercentage: 0,
    bookingChangePercentage: 0,
    pendingBookings: 0,
  });

  const [revenueData, setRevenueData] = useState<{ name: string; revenue: number; bookings: number }[]>([]);
  const [bookingStatusData, setBookingStatusData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date();
      const startOfToday = format(today, "yyyy-MM-dd");
      const startOfThisWeek = format(startOfWeek(today), "yyyy-MM-dd");
      const endOfThisWeek = format(endOfWeek(today), "yyyy-MM-dd");
      const startOfThisMonth = format(startOfMonth(today), "yyyy-MM-dd");
      const endOfThisMonth = format(endOfMonth(today), "yyyy-MM-dd");
      const previousMonthStart = format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd");
      const previousMonthEnd = format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd");

      // Fetch all data in parallel
      const [
        todayBookingsRes,
        todayPaymentsRes,
        weeklyPaymentsRes,
        monthlyPaymentsRes,
        previousMonthPaymentsRes,
        clientsRes,
        previousMonthClientsRes,
        staffRes,
        thisMonthServicesRes,
        allBookingsRes,
        recentBookingsRes,
        recentPaymentsRes,
        last7DaysPaymentsRes,
      ] = await Promise.all([
        supabase.from("bookings").select("*").eq("appointment_date", startOfToday),
        supabase.from("payments").select("amount").gte("payment_date", startOfToday),
        supabase.from("payments").select("amount").gte("payment_date", startOfThisWeek).lte("payment_date", endOfThisWeek),
        supabase.from("payments").select("amount").eq("payment_status", "completed").gte("payment_date", startOfThisMonth).lte("payment_date", endOfThisMonth),
        supabase.from("payments").select("amount").gte("payment_date", previousMonthStart).lte("payment_date", previousMonthEnd),
        supabase.from("clients").select("*", { count: "exact" }),
        supabase.from("clients").select("*", { count: "exact" }).lte("created_at", previousMonthEnd),
        supabase.from("staff").select("*", { count: "exact" }).eq("is_active", true),
        supabase.from("bookings").select("service_id, services(name)").gte("appointment_date", startOfThisMonth).lte("appointment_date", endOfThisMonth),
        supabase.from("bookings").select("status").gte("created_at", startOfThisMonth),
        supabase.from("bookings").select("*, services(name), clients(full_name)").order("created_at", { ascending: false }).limit(5),
        supabase.from("payments").select("*, bookings(services(name))").order("payment_date", { ascending: false }).limit(5),
        supabase.from("payments").select("amount, payment_date").gte("payment_date", format(subDays(today, 6), "yyyy-MM-dd")).eq("payment_status", "completed"),
      ]);

      // Calculate stats
      const todayRevenue = todayPaymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const weeklyRevenue = weeklyPaymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const monthlyRevenue = monthlyPaymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const previousMonthRevenue = previousMonthPaymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Client growth calculation
      const totalClients = clientsRes.count || 0;
      const previousMonthClients = previousMonthClientsRes.count || 0;
      const clientChangePercentage = previousMonthClients > 0 
        ? ((totalClients - previousMonthClients) / previousMonthClients * 100) 
        : 0;

      // Revenue change percentage
      const monthChangePercentage = previousMonthRevenue > 0
        ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue * 100)
        : 0;

      // Top service
      const serviceCounts = thisMonthServicesRes.data?.reduce((acc: any, booking: any) => {
        const serviceName = booking.services?.name || "Unknown";
        acc[serviceName] = (acc[serviceName] || 0) + 1;
        return acc;
      }, {});
      const topServiceEntry = serviceCounts
        ? Object.entries(serviceCounts).sort((a: any, b: any) => b[1] - a[1])[0]
        : null;

      // Booking status distribution
      const statusCounts = allBookingsRes.data?.reduce((acc: any, b: any) => {
        acc[b.status] = (acc[b.status] || 0) + 1;
        return acc;
      }, {});
      
      const statusColors: Record<string, string> = {
        scheduled: "hsl(210, 80%, 52%)",
        confirmed: "hsl(152, 60%, 42%)",
        completed: "hsl(220, 10%, 50%)",
        cancelled: "hsl(0, 72%, 55%)",
        no_show: "hsl(38, 92%, 50%)",
      };

      const bookingStatusData = statusCounts
        ? Object.entries(statusCounts).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1).replace("_", " "),
            value: value as number,
            color: statusColors[name] || "hsl(220, 10%, 50%)",
          }))
        : [];

      // Last 7 days revenue chart
      const last7Days = eachDayOfInterval({
        start: subDays(today, 6),
        end: today,
      });

      const revenueByDay = last7DaysPaymentsRes.data?.reduce((acc: any, p: any) => {
        const day = format(new Date(p.payment_date), "yyyy-MM-dd");
        acc[day] = (acc[day] || 0) + Number(p.amount);
        return acc;
      }, {});

      const revenueChartData = last7Days.map((day) => ({
        name: format(day, "EEE"),
        revenue: revenueByDay?.[format(day, "yyyy-MM-dd")] || 0,
        bookings: 0,
      }));

      // Pending bookings count
      const pendingBookings = todayBookingsRes.data?.filter(
        (b) => b.status === "scheduled" || b.status === "confirmed"
      ).length || 0;

      setStats({
        todayBookings: todayBookingsRes.data?.length || 0,
        todayRevenue,
        weeklyRevenue,
        monthlyRevenue,
        totalClients,
        activeStaff: staffRes.count || 0,
        topService: topServiceEntry?.[0] as string || "N/A",
        topServiceCount: topServiceEntry?.[1] as number || 0,
        monthChangePercentage: Number(monthChangePercentage.toFixed(1)),
        clientChangePercentage: Number(clientChangePercentage.toFixed(1)),
        bookingChangePercentage: 0,
        pendingBookings,
      });

      setRevenueData(revenueChartData);
      setBookingStatusData(bookingStatusData);

      // Format recent bookings
      setRecentBookings(
        recentBookingsRes.data?.map((b) => ({
          id: b.id,
          title: b.services?.name || "Service",
          subtitle: b.clients?.full_name || "Client",
          date: b.created_at,
          status: b.status,
        })) || []
      );

      // Format recent payments
      setRecentPayments(
        recentPaymentsRes.data?.map((p) => ({
          id: p.id,
          title: p.bookings?.services?.name || "Payment",
          date: p.payment_date,
          amount: Number(p.amount),
        })) || []
      );

    } catch (error) {
      console.error("Error fetching stats:", error);
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

  return (
    <div className="space-y-8 p-6">
      <DashboardHeader
        title="Dashboard"
        subtitle="Welcome back! Here's your salon overview"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Bookings"
          value={stats.todayBookings}
          icon={<Calendar className="w-6 h-6" />}
          variant="gold"
          delay={0}
        />
        <StatCard
          title="Today's Revenue"
          value={`GH₵${stats.todayRevenue.toLocaleString()}`}
          icon={<DollarSign className="w-6 h-6" />}
          variant="green"
          delay={0.1}
        />
        <StatCard
          title="Weekly Revenue"
          value={`GH₵${stats.weeklyRevenue.toLocaleString()}`}
          icon={<TrendingUp className="w-6 h-6" />}
          variant="blue"
          delay={0.2}
        />
        <StatCard
          title="Monthly Revenue"
          value={`GH₵${stats.monthlyRevenue.toLocaleString()}`}
          icon={<TrendingUp className="w-6 h-6" />}
          trend={stats.monthChangePercentage}
          variant="purple"
          delay={0.3}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Clients"
          value={stats.totalClients.toLocaleString()}
          icon={<Users className="w-6 h-6" />}
          trend={stats.clientChangePercentage}
          variant="default"
          delay={0.4}
        />
        <StatCard
          title="Active Staff"
          value={stats.activeStaff}
          icon={<Briefcase className="w-6 h-6" />}
          variant="default"
          delay={0.5}
        />
        <StatCard
          title="Pending Today"
          value={stats.pendingBookings}
          icon={<Clock className="w-6 h-6" />}
          variant="default"
          delay={0.6}
        />
        <TopServiceCard
          serviceName={stats.topService}
          bookingCount={stats.topServiceCount}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueChart
            data={revenueData}
            title="Revenue Trend"
            subtitle="Last 7 days performance"
          />
        </div>
        <div className="lg:col-span-2">
          <DonutChart
            data={bookingStatusData}
            title="Booking Status"
            subtitle="This month's distribution"
            centerValue={stats.todayBookings}
            centerLabel="Today"
          />
        </div>
      </div>

      {/* Activity Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityList
          title="Recent Bookings"
          subtitle="Latest appointments"
          items={recentBookings}
          icon={<Calendar className="w-5 h-5 text-primary" />}
          emptyMessage="No recent bookings"
        />
        <ActivityList
          title="Recent Payments"
          subtitle="Latest transactions"
          items={recentPayments}
          showAmount
          icon={<History className="w-5 h-5 text-success" />}
          emptyMessage="No recent payments"
        />
      </div>
    </div>
  );
};

export default AdminDashboard;