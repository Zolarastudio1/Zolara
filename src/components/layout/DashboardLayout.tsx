import { useState, useEffect } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  Scissors,
  CreditCard,
  FileText,
  LogOut,
  Menu,
  X,
  Clock,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) navigate("/auth");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user && event !== "INITIAL_SESSION") navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      toast.error("Try again");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // BASE NAV ITEMS (DO NOT CHANGE)
  // ==========================================================
  const baseNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "dashboard" },
    { icon: Calendar, label: "Bookings", path: "bookings" },
    { icon: Users, label: "Clients", path: "clients" },
    { icon: UserCog, label: "Staff", path: "staff" },
    { icon: Scissors, label: "Services", path: "services" },
    { icon: CreditCard, label: "Sales", path: "sales" },
    { icon: FileText, label: "Reports", path: "reports" },
    { icon: Clock, label: "Attendance", path: "attendance" },
    { icon: FileText, label: "Attendance Reports", path: "attendance-reports" },
    { icon: Settings, label: "Settings", path: "settings" },
  ];

  // ==========================================================
  // ROLE-BASED NAV ITEMS
  // ==========================================================
  const getNavItemsForRole = (role: string) => {
    switch (role) {
      // ------------------------------------------------------
      // OWNER: FULL ACCESS
      // ------------------------------------------------------
      case "owner":
        return baseNavItems.map((item) => ({
          ...item,
          path: `/admin/${item.path}`,
        }));

      // ------------------------------------------------------
      // RECEPTIONIST: LIMITED ACCESS
      // Staff List → Allowed
      // Sales / Reports → Hidden
      // Attendance Reports → Admin only
      // ------------------------------------------------------
      case "receptionist":
        return baseNavItems
          .filter(
            (item) =>
              !["Sales", "Reports", "Attendance Reports", "Settings"].includes(item.label)
          )
          .map((item) => ({
            ...item,
            path: `/staff/${item.path}`,
          }));

      // ------------------------------------------------------
      // STAFF: MOST LIMITED
      // REMOVE: Staff, Clients, Sales, Reports, Attendance Reports
      // They ONLY see their own attendance (NOT other users)
      // ------------------------------------------------------
      case "staff":
        return baseNavItems
          .filter(
            (item) =>
              ![
                "Clients",
                "Sales",
                "Staff",
                "Reports",
                "Attendance Reports",
              ].includes(item.label)
          )
          .map((item) => ({
            ...item,
            path: `/staff/${item.path}`,
          }));

      // ------------------------------------------------------
      // CLIENT
      // ------------------------------------------------------
      default:
        return baseNavItems
          .filter((item) =>
            ["Dashboard", "Bookings", "Services"].includes(item.label)
          )
          .map((item) => ({
            ...item,
            path: `/${item.path}`,
          }));
    }
  };

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const navItems = getNavItemsForRole(storedUser.role);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-black text-white z-50 transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden">
                <img
                  src="/assets/zolara-logo.jpg"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="font-bold text-lg">Zolara</h1>
                <p className="text-xs opacity-60">Beauty Studio</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5 text-white" />
            </Button>
          </div>

          {/* NAV */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* USER FOOTER */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-3 px-4 py-2">
              <div className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center">
                {user?.email?.[0]?.toUpperCase()}
              </div>
              <p className="text-sm truncate">{user?.email}</p>
            </div>

            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-white/20"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="lg:ml-64">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-card border-b border-border p-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-lg">Zolara Beauty Studio</h1>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
