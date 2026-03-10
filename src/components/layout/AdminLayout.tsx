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
  startOfDay,
  endOfDay,
} from "date-fns";
import { useSettings } from "@/context/SettingsContext";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { TopServiceCard } from "@/components/dashboard/TopServiceCard";
import { DateFilter, DateFilterType } from "@/components/dashboard/DateFilter";
import { PaymentMethodChart } from "@/components/dashboard/PaymentMethodChart";
import { TopStaffCard } from "@/components/dashboard/TopStaffCard";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";
import {
  AlertsPanel,
  generateAlerts,
  Alert,
} from "@/components/dashboard/AlertsPanel";
import { SyncStatus } from "@/components/dashboard/SyncStatus";
import { Loader2 } from "lucide-react";

interface DateRange {
  start: Date;
  end: Date;
}

const AdminDashboard = () => {
  const [dateFilter, setDateFilter] = useState<DateFilterType>("today");
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(new Date()),
    end: endOfDay(new Date()),
  });
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const [stats, setStats] = useState({
    todayBookings: 0,
    periodBookings: 0,
    todayRevenue: 0,
    periodRevenue: 0,
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
    pendingRequests: 0,
    pendingRevenue: 0,
  });

  const [revenueData, setRevenueData] = useState<
    { name: string; revenue: number; bookings: number }[]
  >([]);
  const [bookingStatusData, setBookingStatusData] = useState<
    { name: string; value: number; color: string }[]
  >([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<any[]>([]);
  const [topStaff, setTopStaff] = useState<any[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [absentStaff, setAbsentStaff] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const handleFilterChange = (filter: DateFilterType, range: DateRange) => {
    setDateFilter(filter);
    setDateRange(range);
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        0,
        0,
        0,
        0
      ).toISOString();

      const todayEnd = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59,
        999
      ).toISOString();

      console.log("Start of day", todayStart);
      console.log("End of day", todayEnd);
      const periodStart = format(dateRange.start, "yyyy-MM-dd");
      const periodEnd = format(dateRange.end, "yyyy-MM-dd");
      const startOfThisWeek = format(
        startOfWeek(today, { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      );
      const endOfThisWeek = format(
        endOfWeek(today, { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      );
      const startOfThisMonth = format(startOfMonth(today), "yyyy-MM-dd");
      const endOfThisMonth = format(endOfMonth(today), "yyyy-MM-dd");
      const previousMonthStart = format(
        startOfMonth(subMonths(today, 1)),
        "yyyy-MM-dd"
      );
      const previousMonthEnd = format(
        endOfMonth(subMonths(today, 1)),
        "yyyy-MM-dd"
      );

      // Fetch all data in parallel
      const [
        todayBookingsRes,
        periodBookingsRes,
        todayPaymentsRes,
        periodPaymentsRes,
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
        last30DaysPaymentsRes,
        pendingRequestsRes,
        upcomingBookingsRes,
        staffBookingsRes,
        completedBookingsPaymentsRes,
        todayAttendanceRes,
      ] = await Promise.all([
        supabase
          .from("bookings")
          .select("*")
          .eq("appointment_date", todayStart),
        supabase
          .from("bookings")
          .select("*")
          .gte("appointment_date", periodStart)
          .lte("appointment_date", periodEnd),
        // Only consider completed payments when calculating revenue numbers
        // Only consider payments that are completed and are for bookings marked completed
        supabase
          .from("payments")
          .select("amount, payment_method, bookings(status, appointment_date)")
          .eq("payment_status", "completed")
          .gte("payment_date", todayStart)
          .lte("payment_date", todayEnd)
          .eq("bookings.status", "completed"),

        supabase
          .from("payments")
          .select("amount, payment_method, bookings(status, appointment_date)")
          .eq("payment_status", "completed")
          .gte("payment_date", periodStart)
          .lte("payment_date", periodEnd)
          .eq("bookings.status", "completed"),
        supabase
          .from("payments")
          .select("amount, bookings(status, appointment_date)")
          .eq("payment_status", "completed")
          .gte("payment_date", startOfThisWeek)
          .lte("payment_date", endOfThisWeek)
          .eq("bookings.status", "completed"),
        supabase
          .from("payments")
          .select("amount, bookings(status, appointment_date)")
          .eq("payment_status", "completed")
          .gte("payment_date", startOfThisMonth)
          .lte("payment_date", endOfThisMonth)
          .eq("bookings.status", "completed"),
        supabase
          .from("payments")
          .select("amount, bookings(status, appointment_date)")
          .eq("payment_status", "completed")
          .gte("payment_date", previousMonthStart)
          .lte("payment_date", previousMonthEnd)
          .eq("bookings.status", "completed"),
        // @ts-ignore
        supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .or("archived.is.null,archived.eq.false"),
        supabase
          .from("clients")
          .select("*", { count: "exact" })
          .lte("created_at", previousMonthEnd), // @ts-ignore
        supabase.from("staff").select("*").eq("status", "active"),
        supabase
          .from("bookings")
          .select("service_id, services(name)")
          .gte("appointment_date", startOfThisMonth)
          .lte("appointment_date", endOfThisMonth),
        // booking status distribution should reflect appointment dates in the month
        supabase
          .from("bookings")
          .select("status")
          .gte("appointment_date", startOfThisMonth)
          .lte("appointment_date", endOfThisMonth),
        supabase
          .from("bookings")
          .select("*, services(name), clients(full_name)")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("payments")
          .select("*, bookings(services(name))")
          .order("payment_date", { ascending: false })
          .limit(5),
        supabase
          .from("payments")
          .select("amount, payment_date")
          .gte("payment_date", format(subDays(today, 30), "yyyy-MM-dd"))
          .eq("payment_status", "completed"),
        supabase
          .from("booking_requests")
          .select("*", { count: "exact" })
          .eq("status", "pending"),
        supabase
          .from("bookings")
          .select("*, services(name), clients(full_name)")
          .eq("appointment_date", todayStart)
          .in("status", ["scheduled", "confirmed"])
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true })
          .limit(5),
        supabase
          .from("bookings")
          .select(
            "staff_id, staff(full_name, specialization), services(price), payments(amount, payment_status, payment_method)"
          )
          .gte("appointment_date", periodStart)
          .lte("appointment_date", periodEnd)
          .eq("status", "completed"),
        // Fetch completed bookings with nested payments to compute pending revenue (completed but unpaid)
        supabase
          .from("bookings")
          .select(
            "id, staff_id, services(price), payments(amount, payment_status, payment_method)"
          )
          .gte("appointment_date", periodStart)
          .lte("appointment_date", periodEnd)
          .eq("status", "completed"),
        // fetch attendance for today by check_in timestamp range (not created_at equality)
        supabase
          .from("attendance")
          .select("staff_id")
          .gte("check_in", todayStart)
          .lte("check_in", todayEnd),
      ]);

      // Calculate stats
      const todayRevenue =
        todayPaymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) ||
        0;
      const periodRevenue =
        periodPaymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) ||
        0;
      const weeklyRevenue =
        weeklyPaymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) ||
        0;
      const monthlyRevenue =
        monthlyPaymentsRes.data?.reduce(
          (sum, p) => sum + Number(p.amount),
          0
        ) || 0;
      const previousMonthRevenue =
        previousMonthPaymentsRes.data?.reduce(
          (sum, p) => sum + Number(p.amount),
          0
        ) || 0;

      // Pending revenue: bookings that are marked completed but have no completed payment recorded
      const completedBookings = completedBookingsPaymentsRes.data || [];
      const pendingRevenue = completedBookings.reduce((sum: number, b: any) => {
        const payments: any[] = b.payments || [];
        const hasCompletedPayment = payments.some(
          (p) => p && p.payment_status === "completed" && p.payment_method
        );
        if (!hasCompletedPayment) {
          // treat full service price as pending (partial-pay scenarios can be refined later)
          return sum + Number(b.services?.price || 0);
        }
        return sum;
      }, 0);

      // Client growth calculation
      const totalClients = clientsRes.count || 0;
      const previousMonthClients = previousMonthClientsRes.count || 0;
      const clientChangePercentage =
        previousMonthClients > 0
          ? ((totalClients - previousMonthClients) / previousMonthClients) * 100
          : 0;

      // Revenue change percentage
      const monthChangePercentage =
        previousMonthRevenue > 0
          ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) *
            100
          : 0;

      // Top service
      const serviceCounts = thisMonthServicesRes.data?.reduce(
        (acc: any, booking: any) => {
          const serviceName = booking.services?.name || "Unknown";
          acc[serviceName] = (acc[serviceName] || 0) + 1;
          return acc;
        },
        {}
      );
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
            name:
              name.charAt(0).toUpperCase() + name.slice(1).replace("_", " "),
            value: value as number,
            color: statusColors[name] || "hsl(220, 10%, 50%)",
          }))
        : [];

      // Last 30 days revenue chart
      const last30Days = eachDayOfInterval({
        start: subDays(today, 30),
        end: today,
      });

      const revenueByDay = last30DaysPaymentsRes.data?.reduce(
        (acc: any, p: any) => {
          const day = format(new Date(p.payment_date), "yyyy-MM-dd");
          acc[day] = (acc[day] || 0) + Number(p.amount);
          return acc;
        },
        {}
      );

      const revenueChartData = last30Days.map((day) => ({
        name: format(day, "MMM d"),
        revenue: revenueByDay?.[format(day, "yyyy-MM-dd")] || 0,
        bookings: 0,
      }));

      // Payment method breakdown
      const paymentMethods = periodPaymentsRes.data?.reduce(
        (acc: any, p: any) => {
          const method = p.payment_method || "cash";
          if (!acc[method]) {
            acc[method] = { amount: 0, count: 0 };
          }
          acc[method].amount += Number(p.amount);
          acc[method].count += 1;
          return acc;
        },
        {}
      );

      const totalPaymentAmount =
        dateFilter === "today" ? todayRevenue : periodRevenue || 1;

      const enabledMethodIds =
        settings?.payment_methods
          ?.filter((m: any) => m.enabled)
          .map((m: any) => m.id) || [];

      const paymentMethodBreakdown = paymentMethods
        ? Object.entries(paymentMethods)
            .map(([method, data]: [string, any]) => ({
              method,
              amount: data.amount,
              count: data.count,
              percentage: (data.amount / totalPaymentAmount) * 100,
            }))
            // Always include gift_card if present in data, even if not listed in settings
            .filter(
              (p: any) =>
                p.method === "gift_card" || enabledMethodIds.includes(p.method)
            )
        : [];

      console.log("Payment method breakdown", paymentMethodBreakdown);

      // Top performing staff — attribute revenue only from completed payments tied to bookings
      const staffPerformance = staffBookingsRes.data?.reduce(
        (acc: any, booking: any) => {
          if (!booking.staff_id || !booking.staff) return acc;
          const staffId = booking.staff_id;
          if (!acc[staffId]) {
            acc[staffId] = {
              id: staffId,
              name: booking.staff.full_name,
              specialization: booking.staff.specialization,
              bookings: 0,
              revenue: 0,
            };
          }
          acc[staffId].bookings += 1;
          // Sum only completed payments with a payment_method to ensure accurate sales attribution
          const payments: any[] = booking.payments || [];
          const paidAmount = payments.reduce((s, p) => {
            if (p && p.payment_status === "completed" && p.payment_method) {
              return s + Number(p.amount || 0);
            }
            return s;
          }, 0);
          acc[staffId].revenue += paidAmount;
          return acc;
        },
        {}
      );

      const topStaffList = staffPerformance
        ? Object.values(staffPerformance)
            .sort((a: any, b: any) => b.bookings - a.bookings)
            .slice(0, 5)
        : [];

      // Upcoming appointments
      const upcomingList =
        upcomingBookingsRes.data?.map((b: any) => ({
          id: b.id,
          clientName: b.clients?.full_name || "Unknown",
          serviceName: b.services?.name || "Service",
          date: b.appointment_date,
          time: b.appointment_time,
          status: b.status,
        })) || [];

      // Check for absent staff
      const checkedInStaffIds =
        todayAttendanceRes.data?.map((a: any) => a.staff_id) || [];
      const allActiveStaff = staffRes.data || [];
      const absentStaffNames = allActiveStaff
        .filter((s: any) => !checkedInStaffIds.includes(s.id))
        .map((s: any) => s.full_name);

      // Pending bookings count
      const pendingBookings =
        todayBookingsRes.data?.filter(
          (b) => b.status === "scheduled" || b.status === "confirmed"
        ).length || 0;

      // Generate alerts
      const generatedAlerts = generateAlerts({
        todayBookings: todayBookingsRes.data?.length || 0,
        pendingRequests: pendingRequestsRes.count || 0,
        absentStaff: absentStaffNames,
        lowBookingThreshold: 3,
      });

      setStats({
        todayBookings: todayBookingsRes.data?.length || 0,
        periodBookings: periodBookingsRes.data?.length || 0,
        todayRevenue,
        periodRevenue,
        weeklyRevenue,
        monthlyRevenue,
        totalClients,
        activeStaff: allActiveStaff.length,
        topService: (topServiceEntry?.[0] as string) || "N/A",
        topServiceCount: (topServiceEntry?.[1] as number) || 0,
        monthChangePercentage: Number(monthChangePercentage.toFixed(1)),
        clientChangePercentage: Number(clientChangePercentage.toFixed(1)),
        bookingChangePercentage: 0,
        pendingBookings,
        pendingRequests: pendingRequestsRes.count || 0,
        pendingRevenue,
      });

      setRevenueData(revenueChartData);
      setBookingStatusData(bookingStatusData);
      setPaymentMethodData(paymentMethodBreakdown);
      setTopStaff(topStaffList as any[]);
      setUpcomingAppointments(upcomingList);
      setAlerts(generatedAlerts);
      setAbsentStaff(absentStaffNames);

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
          title: (p.bookings as any)?.services?.name || "Payment",
          date: p.payment_date,
          amount: Number(p.amount),
        })) || []
      );

      setLastSync(new Date());
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFilterLabel = () => {
    switch (dateFilter) {
      case "today":
        return "Today";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      case "custom":
        return `${format(dateRange.start, "MMM d")} - ${format(
          dateRange.end,
          "MMM d"
        )}`;
      default:
        return "";
    }
  };

  if (loading && !lastSync) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
            <Loader2 className="w-16 h-16 absolute inset-0 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground font-medium">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <DashboardHeader
          title="Dashboard"
          subtitle="Welcome back! Here's your salon overview"
        />
        <div className="flex flex-col gap-2 md:items-end">
          <DateFilter
            currentFilter={dateFilter}
            onFilterChange={handleFilterChange}
          />
          <SyncStatus
            lastSync={lastSync}
            isLoading={loading}
            onRefresh={fetchStats}
          />
        </div>
      </div>

      {/* Period Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={`${getFilterLabel()}'s Bookings`}
          value={stats.periodBookings}
          icon={<Calendar className="w-6 h-6" />}
          variant="gold"
          delay={0}
        />
        <StatCard
          title={`${getFilterLabel()}'s Revenue`}
          value={`GH₵${
            dateFilter === "today"
              ? stats.todayRevenue.toLocaleString()
              : stats.periodRevenue.toLocaleString()
          }`}
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

      {/* Alerts & Upcoming */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AlertsPanel alerts={alerts} />
        <UpcomingAppointments appointments={upcomingAppointments} />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueChart
            data={revenueData}
            title="Revenue Trend"
            subtitle="Last 30 days performance"
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

      {/* Payment & Staff Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentMethodChart
          data={paymentMethodData}
          title={`Payment Methods (${getFilterLabel()}) — includes redeemed gift cards`}
        />
        <TopStaffCard
          data={topStaff}
          title="Top Performing Staff"
          subtitle={getFilterLabel()}
        />
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
