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
} from "date-fns";

const AdminLayout = () => {
  const [stats, setStats] = useState({
    todayBookings: 0,
    todayRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    totalClients: 0,
    activeStaff: 0,
    topService: "N/A",
    cancelledBookings: 0,
    pendingBookings: 0,
    completedBookings: 0,
    topStaff: "N/A",
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

      // Fetch bookings this month
      const { data: bookings } = await supabase
        .from("bookings")
        .select(
          "id,status,staff(full_name),services(name,price),appointment_date"
        )
        .gte("appointment_date", startOfThisMonth)
        .lte("appointment_date", endOfThisMonth);

      // Count bookings by status
      const cancelledBookings =
        bookings?.filter((b) => b.status === "cancelled")?.length || 0;
      const pendingBookings =
        bookings?.filter((b) => b.status === "scheduled")?.length || 0;
      const completedBookings =
        bookings?.filter((b) => b.status === "completed")?.length || 0;

      // Top staff by completed bookings
      const staffCounts: Record<string, number> = {};
      bookings?.forEach((b) => {
        if (b.status === "completed" && b.staff?.full_name) {
          staffCounts[b.staff.full_name] =
            (staffCounts[b.staff.full_name] || 0) + 1;
        }
      });
      const topStaff =
        Object.entries(staffCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "N/A";

      // Monthly revenue
      const { data: monthlyPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("payment_status", "completed")
        .gte("payment_date", startOfThisMonth)
        .lte("payment_date", endOfThisMonth);

      // Total clients
      const { count: clientCount } = await supabase
        .from("clients")
        .select("*", { count: "exact" });

      // Active staff
      const { count: staffCount } = await supabase
        .from("staff")
        .select("*", { count: "exact" })
        .eq("is_active", true);

      // Top service this month
      const serviceCounts = bookings?.reduce((acc: any, booking: any) => {
        const serviceName = booking.services?.name || "Unknown";
        acc[serviceName] = (acc[serviceName] || 0) + 1;
        return acc;
      }, {});
      const topService = serviceCounts
        ? Object.entries(serviceCounts).sort(
            (a: any, b: any) => b[1] - a[1]
          )[0]?.[0] || "N/A"
        : "N/A";

      // Today's bookings & revenue
      const todayBookings =
        bookings?.filter((b) => b.appointment_date === startOfToday)?.length ||
        0;

      setStats({
        todayBookings,
        todayRevenue: 0, // can keep your previous todayRevenue calculation if needed
        weeklyRevenue: 0, // keep previous weeklyRevenue calculation
        monthlyRevenue:
          monthlyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
        totalClients: clientCount || 0,
        activeStaff: staffCount || 0,
        topService,
        cancelledBookings,
        pendingBookings,
        completedBookings,
        topStaff,
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
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Monthly Revenue",
      value: `GH₵${stats.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Cancelled Bookings",
      value: stats.cancelledBookings,
      icon: Scissors,
      color: "text-red-500",
      bgColor: "bg-red-100",
    },
    {
      title: "Pending Bookings",
      value: stats.pendingBookings,
      icon: Calendar,
      color: "text-yellow-500",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Completed Bookings",
      value: stats.completedBookings,
      icon: TrendingUp,
      color: "text-green-500",
      bgColor: "bg-green-100",
    },
    {
      title: "Active Staff",
      value: stats.activeStaff,
      icon: Users,
      color: "text-secondary-foreground",
      bgColor: "bg-secondary",
    },
    {
      title: "Top Staff",
      value: stats.topStaff,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Total Clients",
      value: stats.totalClients,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
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
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.bgColor} p-2 rounded-full`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
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

export default AdminLayout;
