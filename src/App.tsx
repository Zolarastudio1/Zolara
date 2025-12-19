import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProtectedRoute from "@/components/ProtectedRoute";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Auth from "./pages/Auth";
import LandingPage from "./pages/LandingPage";

import DashboardLayout from "./components/layout/DashboardLayout";
import AdminLayout from "./components/layout/AdminLayout";
import StaffLayout from "./components/layout/StaffLayout";
import ClientLayout from "./components/layout/ClientLayout";

import Dashboard from "./pages/Admin/Dashboard";
import Bookings from "./pages/Admin/Bookings";
import Clients from "./pages/Admin/Clients";
import Staff from "./pages/Admin/Staff";
import Services from "./pages/Admin/Services";
import Sales from "./pages/Admin/Sales";
import Reports from "./pages/Admin/Reports";
import NotFound from "./pages/Admin/NotFound";
import Attendance from "./pages/Admin/Attendance";
import AttendanceReports from "./pages/Admin/AttendanceReports";

import StaffBookings from "./pages/Staff/StaffBookings";
import MyAttendance from "./pages/Staff/MyAttendance";

import ClientBookings from "./pages/Client/ClientBookings";
import ViewServices from "./pages/Client/ViewServices";
import SettingsPage from "./pages/Admin/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Auth Page */}
          <Route path="/app/auth" element={<Auth />} />

          {/* ------------------- ADMIN ROUTES ------------------- */}
          <Route element={<ProtectedRoute allowedRoles={["owner"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/app/admin/dashboard" element={<AdminLayout />} />
              <Route path="/app/admin/bookings" element={<Bookings />} />
              <Route path="/app/admin/services" element={<Services />} />
              <Route path="/app/admin/clients" element={<Clients />} />
              <Route path="/app/admin/staff" element={<Staff />} />
              <Route path="/app/admin/sales" element={<Sales />} />
              <Route path="/app/admin/reports" element={<Reports />} />
              <Route path="/app/admin/attendance" element={<Attendance />} />
              <Route path="/app/admin/attendance-reports" element={<AttendanceReports />} />
              <Route path="/app/admin/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* --------------RECEPTIONIST ROUTES ------------------- */}
          <Route element={<ProtectedRoute allowedRoles={["receptionist"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/app/staff/dashboard" element={<AdminLayout />} />
              <Route path="/app/staff/bookings" element={<Bookings />} />
              <Route path="/app/staff/services" element={<Services />} />
              <Route path="/app/staff/clients" element={<Clients />} />
              <Route path="/app/staff/staff" element={<Staff />} />
              <Route path="/app/staff/attendance" element={<Attendance />} />
            </Route>
          </Route>

          {/* ------------------- STAFF ROUTES ------------------- */}
          <Route element={<ProtectedRoute allowedRoles={["staff"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/app/staff/dashboard" element={<StaffLayout />} />
              <Route path="/app/staff/bookings" element={<StaffBookings />} />
              <Route path="/app/staff/services" element={<ViewServices />} />
              <Route path="/app/staff/attendance" element={<MyAttendance />} />
            </Route>
          </Route>

          {/* ------------------- CLIENT ROUTES ------------------- */}
          <Route element={<ProtectedRoute allowedRoles={["client"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/app/dashboard" element={<ClientLayout />} />
              <Route path="/app/bookings" element={<ClientBookings />} />
              <Route path="/app/services" element={<ViewServices />} />
            </Route>
          </Route>

          {/* Legacy redirects */}
          <Route path="/auth" element={<Navigate to="/app/auth" />} />
          <Route path="/admin/*" element={<Navigate to="/app/admin/dashboard" />} />
          <Route path="/staff/*" element={<Navigate to="/app/staff/dashboard" />} />
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
