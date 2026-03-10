import { useState, useEffect } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  CheckIcon,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSettings } from "@/context/SettingsContext";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) navigate("/app/auth");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user && event !== "INITIAL_SESSION") navigate("/app/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    // fetch role for the current user to ensure nav reflects latest permissions
    const syncRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
        const metaDataRole = (user as any).user_metadata?.role || "";
        const role = roleData?.role || metaDataRole || "";
        setCurrentRole(role);
        // store in localStorage for legacy parts that read it
        localStorage.setItem("user", JSON.stringify({ id: user.id, email: user.email, role }));
      } catch (err) {
        console.error("Failed to sync user role", err);
      }
    };

    syncRole();
    // re-sync role when window gains focus (helps reflect admin changes)
    window.addEventListener("focus", syncRole);
    return () => window.removeEventListener("focus", syncRole);
  }, []);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      navigate("/app/auth");
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
    { icon: Gift, label: "Gift Cards", path: "gift-cards" },
    { icon: CheckIcon, label: "Checkout", path: "checkout" },
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
      case "admin":
        return baseNavItems.map((item) => ({
          ...item,
          path: `/app/admin/${item.path}`,
        }))
      // ------------------------------------------------------
      // OWNER: FULL ACCESS
      // ------------------------------------------------------
      case "owner":
        return baseNavItems.map((item) => ({
          ...item,
          path: `/app/admin/${item.path}`,
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
              ![
                "Sales",
                "Reports",
                "Attendance Reports",
                "Staff",
                "Settings",
              ].includes(item.label)
          )
          .map((item) => ({
            ...item,
            path: `/app/receptionist/${item.path}`,
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
                "Checkout",
                "Gift Cards",
                "Settings",
              ].includes(item.label)
          )
          .map((item) => ({
            ...item,
            path: `/app/staff/${item.path}`,
          }));

      // ------------------------------------------------------
      // CLIENT
      // ------------------------------------------------------
      case "client":
        return baseNavItems
          .filter((item) =>
            ["Dashboard", "Bookings", "Services"].includes(item.label)
          )
          .map((item) => ({
            ...item,
            path: `/app/client/${item.path}`,
          }));

      default:
        return [];
    }
  };

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const navItems = getNavItemsForRole(currentRole || storedUser.role || "");

  const roleLabels: Record<string, string> = {
    owner: "Owner Access",
    admin: "Admin Access",
    receptionist: "Reception Access",
    staff: "Staff Access",
  };

  return (
    <div className="min-h-screen bg-background text-sm">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-deep-navy/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-deep-navy text-white z-50 transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden">
                <img
                  src={
                    settings.logo_url !== null
                      ? settings.logo_url
                      : "/assets/zolara-logo.jpg"
                  }
                  className="w-full h-full object-cover"
                  onClick={()=> navigate("/")}
                />
              </div>
              <div>
                <h1 className="font-bold text-base">Zolara</h1>
                <p className="text-[11px] opacity-60">Beauty Studio</p>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/80">
                  {roleLabels[storedUser.role]}
                </div>
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
          <nav
            className="flex-1 overflow-auto p-4 space-y-1"
            style={{
              scrollbarWidth: "none", // Firefox
              msOverflowStyle: "none", // IE 10+
            }}
          >
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
              onClick={() => setOpen(true)}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Log out?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will be signed out of your account.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setOpen(false);
                      handleLogout();
                    }}
                  >
                    Logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
          <h1 className="font-semibold text-base">Zolara Beauty Studio</h1>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
