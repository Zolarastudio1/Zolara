import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProtectedRoute from "@/components/ProtectedRoute";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Auth from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import PublicBooking from "./pages/PublicBooking";
import BuyGiftCard from "./pages/Public/BuyGiftCard";

import DashboardLayout from "./components/layout/DashboardLayout";
import AdminLayout from "./components/layout/AdminLayout";
import StaffLayout from "./components/layout/StaffLayout";
import ReceptionistLayout from "./components/layout/ReceptionistLayout";
import ClientLayout from "./components/layout/ClientLayout";

import Bookings from "./pages/Admin/Bookings";
import Clients from "./pages/Admin/Clients";
import Staff from "./pages/Admin/Staff";
import Services from "./pages/Admin/Services";
import Sales from "./pages/Admin/Sales";
import Reports from "./pages/Admin/Reports";
import NotFound from "./pages/Admin/NotFound";
import Attendance from "./pages/Admin/Attendance";
import AttendanceReports from "./pages/Admin/AttendanceReports";
import Checkout from "./pages/Admin/Checkout";
import GiftCards from "./pages/Admin/GiftCards";

import StaffBookings from "./pages/Staff/StaffBookings";
import MyAttendance from "./pages/Staff/MyAttendance";

import ClientBookings from "./pages/Client/ClientBookings";
import ViewServices from "./pages/Client/ViewServices";
import SettingsPage from "./pages/Admin/Settings";
import Waitlist from "./pages/Admin/Waitlist";
import Addons from "./pages/Admin/Addons";
import PromoCodes from "./pages/Admin/PromoCodes";
import ClientNotes from "./pages/Admin/ClientNotes";
import SMSCampaigns from "./pages/Admin/SMSCampaigns";
import Analytics from "./pages/Admin/Analytics";
import Products from "./pages/Admin/Products";
import { CatalogProvider } from "./context/CatalogContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CatalogProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          {/* =================== PUBLIC ROUTES =================== */}
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Public Booking Page (no login required) */}
          <Route path="/book" element={<PublicBooking />} />
          <Route path="/buy-gift-card" element={<BuyGiftCard />} />
          
          {/* Staff Login Page */}
          <Route path="/app/auth" element={<Auth />} />

          {/* =================== MANAGEMENT SYSTEM ROUTES =================== */}
          
          {/* OWNER (Manager) - Full Access */}
          <Route element={<ProtectedRoute allowedRoles={["owner", "admin"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/app/admin/dashboard" element={<AdminLayout />} />
              <Route path="/app/admin/bookings" element={<Bookings />} />
              <Route path="/app/admin/checkout" element={<Checkout />} />
              <Route path="/app/admin/services" element={<Services />} />
              <Route path="/app/admin/clients" element={<Clients />} />
              <Route path="/app/admin/staff" element={<Staff />} />
              <Route path="/app/admin/sales" element={<Sales />} />
              <Route path="/app/admin/checkout" element={<Checkout />} />
              <Route path="/app/admin/reports" element={<Reports />} />
              <Route path="/app/admin/attendance" element={<Attendance />} />
              <Route path="/app/admin/attendance-reports" element={<AttendanceReports />} />
              <Route path="/app/admin/gift-cards" element={<GiftCards />} />
              <Route path="/app/admin/settings" element={<SettingsPage />} />
              <Route path="/app/admin/waitlist" element={<Waitlist />} />
              <Route path="/app/admin/addons" element={<Addons />} />
              <Route path="/app/admin/promo-codes" element={<PromoCodes />} />
              <Route path="/app/admin/client-notes" element={<ClientNotes />} />
              <Route path="/app/admin/sms-campaigns" element={<SMSCampaigns />} />
              <Route path="/app/admin/analytics" element={<Analytics />} />
              <Route path="/app/admin/products" element={<Products />} />
            </Route>
          </Route>

          {/* RECEPTIONIST - Limited Access (daily operations) */}
          <Route element={<ProtectedRoute allowedRoles={["receptionist"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/app/receptionist/dashboard" element={<ReceptionistLayout />} />
              <Route path="/app/receptionist/bookings" element={<Bookings />} />
              <Route path="/app/receptionist/clients" element={<Clients />} />
              <Route path="/app/receptionist/gift-cards" element={<GiftCards />} />
              <Route path="/app/receptionist/checkout" element={<Checkout />} />
              <Route path="/app/receptionist/attendance" element={<Attendance />} />
              <Route path="/app/receptionist/services" element={<ViewServices />} />
            </Route>
          </Route>

          {/* STAFF - Minimal Access (their own tasks) */}
          <Route element={<ProtectedRoute allowedRoles={["staff"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/app/staff/dashboard" element={<StaffLayout />} />
              <Route path="/app/staff/bookings" element={<StaffBookings />} />
              <Route path="/app/staff/services" element={<ViewServices />} />
              <Route path="/app/staff/attendance" element={<MyAttendance />} />
            </Route>
          </Route>

          {/* CLIENT - Customer portal */}
          <Route element={<ProtectedRoute allowedRoles={["client"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/app/client/dashboard" element={<ClientLayout />} />
              <Route path="/app/client/bookings" element={<ClientBookings />} />
              <Route path="/app/client/services" element={<ViewServices />} />
            </Route>
          </Route>

          {/* =================== LEGACY REDIRECTS =================== */}
          <Route path="/auth" element={<Navigate to="/app/auth" />} />
          <Route path="/admin/*" element={<Navigate to="/app/admin/dashboard" />} />
          <Route path="/staff/*" element={<Navigate to="/app/staff/dashboard" />} />
          <Route path="/dashboard" element={<Navigate to="/app/client/dashboard" />} />
          <Route path="/app/dashboard" element={<Navigate to="/app/client/dashboard" />} />
          <Route path="/app/bookings" element={<Navigate to="/app/client/bookings" />} />
          <Route path="/app/services" element={<Navigate to="/app/client/services" />} />
          <Route path="/app/staff/staff" element={<Navigate to="/app/admin/staff" />} />
          <Route path="/manage" element={<Navigate to="/app/auth" />} />
          <Route path="/manage/*" element={<Navigate to="/app/auth" />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </CatalogProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
