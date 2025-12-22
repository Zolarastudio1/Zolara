import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Bell,
  CreditCard,
  UserCheck,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TodayBooking {
  id: string;
  appointment_time: string;
  status: string;
  clients: { full_name: string; phone: string } | null;
  services: { name: string; duration_minutes: number } | null;
  staff: { full_name: string } | null;
}

const ReceptionistDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [todayBookings, setTodayBookings] = useState<TodayBooking[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayTotal: 0,
    checkedIn: 0,
    pending: 0,
    completed: 0,
    totalClients: 0,
    pendingPayments: 0,
  });
  const [bookingStatusData, setBookingStatusData] = useState<{ name: string; value: number; color: string }[]>([]);

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

      const today = new Date();
      const todayStart = format(startOfDay(today), "yyyy-MM-dd");

      // Fetch today's bookings
      const { data: bookings = [] } = await supabase
        .from("bookings")
        .select("*, clients(full_name, phone), services(name, duration_minutes), staff(full_name)")
        .eq("appointment_date", todayStart)
        .order("appointment_time", { ascending: true });

      setTodayBookings(bookings);

      // Fetch pending booking requests
      const { data: requests = [] } = await supabase
        .from("booking_requests")
        .select("*, clients(full_name), services(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);

      setPendingRequests(requests);

      // Fetch total clients
      const { count: clientCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });

      // Calculate stats
      const checkedIn = bookings.filter((b) => b.status === "confirmed").length;
      const completed = bookings.filter((b) => b.status === "completed").length;
      const pendingBookings = bookings.filter((b) => b.status === "scheduled").length;

      // Status distribution
      const statusCounts: Record<string, number> = {
        scheduled: pendingBookings,
        confirmed: checkedIn,
        completed: completed,
      };

      const statusColors: Record<string, string> = {
        scheduled: "hsl(38, 92%, 50%)",
        confirmed: "hsl(210, 80%, 52%)",
        completed: "hsl(152, 60%, 42%)",
      };

      const statusData = Object.entries(statusCounts)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          color: statusColors[name] || "hsl(220, 10%, 50%)",
        }));

      setBookingStatusData(statusData);

      setStats({
        todayTotal: bookings.length,
        checkedIn,
        pending: pendingBookings,
        completed,
        totalClients: clientCount || 0,
        pendingPayments: requests.length,
      });

    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      toast.error(error.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", bookingId);

      if (error) throw error;

      toast.success("Client checked in successfully!");
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message || "Failed to check in client");
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

  // Format pending requests for activity list
  const pendingRequestItems = pendingRequests.map((r) => ({
    id: r.id,
    title: r.services?.name || "Service Request",
    subtitle: r.clients?.full_name || "Client",
    date: r.created_at,
    status: "pending",
  }));

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: "bg-warning-light text-warning",
      confirmed: "bg-info-light text-info",
      completed: "bg-success-light text-success",
      cancelled: "bg-destructive-light text-destructive",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-8 p-6">
      <DashboardHeader
        title="Reception Dashboard"
        userName={userName}
        subtitle="Manage today's appointments and client check-ins"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Appointments"
          value={stats.todayTotal}
          icon={<Calendar className="w-6 h-6" />}
          variant="gold"
          delay={0}
        />
        <StatCard
          title="Checked In"
          value={stats.checkedIn}
          icon={<UserCheck className="w-6 h-6" />}
          variant="blue"
          delay={0.1}
        />
        <StatCard
          title="Waiting"
          value={stats.pending}
          icon={<Clock className="w-6 h-6" />}
          variant="purple"
          delay={0.2}
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={<CheckCircle2 className="w-6 h-6" />}
          variant="green"
          delay={0.3}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Clients"
          value={stats.totalClients.toLocaleString()}
          icon={<Users className="w-6 h-6" />}
          variant="default"
          delay={0.4}
        />
        <StatCard
          title="Pending Requests"
          value={stats.pendingPayments}
          icon={<Bell className="w-6 h-6" />}
          variant="default"
          delay={0.5}
        />
        <DonutChart
          data={bookingStatusData}
          title="Today's Status"
          subtitle="Appointment distribution"
          centerValue={stats.todayTotal}
          centerLabel="Total"
        />
      </div>

      {/* Today's Schedule */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <CardTitle className="text-xl font-display">Today's Schedule</CardTitle>
              </div>
              <Badge variant="secondary" className="text-sm">
                {format(new Date(), "EEEE, MMMM d")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {todayBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No appointments scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayBookings.map((booking, index) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 * index }}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-bold">{booking.appointment_time}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.services?.duration_minutes || 30} min
                        </p>
                      </div>
                      <div className="h-12 w-px bg-border" />
                      <div>
                        <p className="font-medium">{booking.clients?.full_name || "Unknown Client"}</p>
                        <p className="text-sm text-muted-foreground">
                          {booking.services?.name || "Service"} • {booking.staff?.full_name || "Unassigned"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={cn("capitalize", getStatusBadge(booking.status))}>
                        {booking.status}
                      </Badge>
                      {booking.status === "scheduled" && (
                        <Button
                          size="sm"
                          onClick={() => handleCheckIn(booking.id)}
                          className="bg-success hover:bg-success/90"
                        >
                          <UserCheck className="w-4 h-4 mr-1" />
                          Check In
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Pending Requests */}
      <ActivityList
        title="Pending Booking Requests"
        subtitle="Awaiting approval"
        items={pendingRequestItems}
        icon={<AlertCircle className="w-5 h-5 text-warning" />}
        emptyMessage="No pending requests"
      />
    </div>
  );
};

export default ReceptionistDashboard;