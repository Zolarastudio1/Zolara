import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Calendar, 
  Users, 
  DollarSign, 
  TrendingUp,
  Scissors
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";

const Dashboard = () => {
  const [stats, setStats] = useState({
    todayBookings: 0,
    todayRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    totalClients: 0,
    activeStaff: 0,
    topService: "N/A"
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

      // Monthly revenue
      const { data: monthlyPayments } = await supabase
        .from("payments")
        .select("amount")
        .gte("payment_date", startOfThisMonth)
        .lte("payment_date", endOfThisMonth);

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
        ? Object.entries(serviceCounts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "N/A"
        : "N/A";

      setStats({
        todayBookings: todayBookings?.length || 0,
        todayRevenue: todayPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
        weeklyRevenue: weeklyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
        monthlyRevenue: monthlyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
        totalClients: clientCount || 0,
        activeStaff: staffCount || 0,
        topService
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
      bgColor: "bg-primary/10"
    },
    {
      title: "Today's Revenue",
      value: `₦${stats.todayRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      title: "Weekly Revenue",
      value: `₦${stats.weeklyRevenue.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-info",
      bgColor: "bg-info/10"
    },
    {
      title: "Monthly Revenue",
      value: `₦${stats.monthlyRevenue.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      title: "Total Clients",
      value: stats.totalClients,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Active Staff",
      value: stats.activeStaff,
      icon: Users,
      color: "text-secondary-foreground",
      bgColor: "bg-secondary"
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your salon overview</p>
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
          <p className="text-2xl font-semibold text-primary">{stats.topService}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
