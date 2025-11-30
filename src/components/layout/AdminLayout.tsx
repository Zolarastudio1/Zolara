import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Scissors,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
} from "date-fns";

const Dashboard = () => {
  const [stats, setStats] = useState({
    todayBookings: 0,
    todayRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    totalClients: 0,
    activeStaff: 0,
    topService: "N/A",
    monthChangePercentage: 0,
  });

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

      // Previous month
      const previousMonthStart = format(
        startOfMonth(subMonths(today, 1)),
        "yyyy-MM-dd"
      );
      const previousMonthEnd = format(
        endOfMonth(subMonths(today, 1)),
        "yyyy-MM-dd"
      );
      // Today's bookings
      const { data: todayBookings } = await supabase
        .from("bookings")
        .select("*", { count: "exact" })
        .eq("appointment_date", startOfToday);

      // Today's revenue
      const { data: todayPayments } = await supabase
        .from("payments")
        .select("amount")
        .gte("payment_date", startOfToday);

      // Weekly revenue
      const { data: weeklyPayments } = await supabase
        .from("payments")
        .select("amount")
        .gte("payment_date", startOfThisWeek)
        .lte("payment_date", endOfThisWeek);

      // Monthly revenue (only completed)
      const { data: monthlyPayments, error } = await supabase
        .from("payments")
        .select("amount")
        .eq("payment_status", "completed") // <-- filter only completed
        .gte("payment_date", startOfThisMonth)
        .lte("payment_date", endOfThisMonth);

      // Previous month revenue
      const { data: previousMonthPayments } = await supabase
        .from("payments")
        .select("amount")
        .gte("payment_date", previousMonthStart)
        .lte("payment_date", previousMonthEnd);

      // Total clients
      const { data: clients, count: clientCount } = await supabase
        .from("clients")
        .select("*", { count: "exact" });

      // Active staff
      const { data: staff, count: staffCount } = await supabase
        .from("staff")
        .select("*", { count: "exact" })
        .eq("is_active", true);

      // Top service
      const { data: services } = await supabase
        .from("bookings")
        .select("service_id, services(name)")
        .gte("appointment_date", startOfThisMonth)
        .lte("appointment_date", endOfThisMonth);

      const serviceCounts = services?.reduce((acc: any, booking: any) => {
        const serviceName = booking.services?.name || "Unknown";
        acc[serviceName] = (acc[serviceName] || 0) + 1;
        return acc;
      }, {});

      const topService = serviceCounts
        ? Object.entries(serviceCounts).sort(
            (a: any, b: any) => b[1] - a[1]
          )[0]?.[0] || "N/A"
        : "N/A";

      const todayRevenue =
        todayPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const weeklyRevenue =
        weeklyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const monthlyRevenue =
        monthlyPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const totalClients = clientCount || 0;
      const activeStaff = staffCount || 0;

      const previousMonthRevenue =
        previousMonthPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

      // Percentage change calculation
      let percentageChange = 0;
      if (previousMonthRevenue > 0) {
        percentageChange =
          ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) *
          100;
      }

      setStats({
        todayBookings: todayBookings?.length || 0,
        todayRevenue,
        weeklyRevenue,
        monthlyRevenue,
        totalClients,
        activeStaff,
        topService,
        monthChangePercentage: Number(percentageChange.toFixed(1)),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Today's Bookings",
      value: stats.todayBookings,
      icon: Calendar,
      percent: "",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Today's Revenue",
      value: `GH₵${stats.todayRevenue.toLocaleString()}`,
      icon: DollarSign,
      percent: "",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Weekly Revenue",
      value: `GH₵${stats.weeklyRevenue.toLocaleString()}`,
      icon: TrendingUp,
      percent: "",
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Monthly Revenue",
      value: `GH₵${stats.monthlyRevenue.toLocaleString()}`,
      icon: TrendingUp,
      percent: stats.monthChangePercentage,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Total Clients",
      value: stats.totalClients,
      icon: Users,
      percent: "",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Active Staff",
      value: stats.activeStaff,
      icon: Users,
      percent: "",
      color: "text-secondary-foreground",
      bgColor: "bg-secondary",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's your salon overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className="transition-all hover:shadow-xl hover:scale-[1.02] bg-gradient-to-br from-white/70 to-white/40 dark:from-gray-900/60 dark:to-gray-800/40 backdrop-blur-xl border border-gray-200/40 dark:border-gray-700/40 rounded-2xl"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                {/* Title */}
                <div>
                  <CardTitle className="text-sm font-semibold text-gray-600 dark:text-gray-300 tracking-wide">
                    {stat.title}
                  </CardTitle>
                </div>

                {/* Icon Bubble */}
                <div
                  className={`${stat.bgColor} p-3 rounded-xl shadow-sm flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardHeader>

              <CardContent className="pt-1 flex items-center justify-between">
                {/* Main Value */}
                <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {stat.value}
                </div>

                {/* Percentage Change with Trend Icon */}
                {stat.percent !== "" && stat.percent !== null && (
                  <div className="flex items-center gap-2 text-lg font-bold">
                    {/* Trend Icon */}
                    {Number(stat.percent) > 0 ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    ) : Number(stat.percent) < 0 ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    ) : (
                      // Neutral dot
                      <span className="inline-block w-3 h-3 bg-gray-400 rounded-full"></span>
                    )}

                    {/* Percentage Value */}
                    <span
                      className={`${
                        Number(stat.percent) > 0
                          ? "text-green-600"
                          : Number(stat.percent) < 0
                          ? "text-red-600"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {Number(stat.percent) > 0 && "+"}
                      {Number(stat.percent)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Top Service This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-primary">
            {stats.topService}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
