import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProtectedRoute from "@/components/ProtectedRoute";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Auth from "./pages/Auth";

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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Auth Page */}
          <Route path="/auth" element={<Auth />} />

          {/* ------------------- ADMIN ROUTES ------------------- */}
          <Route element={<ProtectedRoute allowedRoles={["owner"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/admin/dashboard" element={<AdminLayout />} />
              <Route path="/admin/bookings" element={<Bookings />} />
              <Route path="/admin/services" element={<Services />} />
              <Route path="/admin/clients" element={<Clients />} />
              <Route path="/admin/staff" element={<Staff />} />
              <Route path="/admin/sales" element={<Sales />} />
              <Route path="/admin/reports" element={<Reports />} />
              <Route path="/admin/attendance" element={<Attendance />} />
              <Route
                path="/admin/attendance-reports"
                element={<AttendanceReports />}
              />
            </Route>
          </Route>

          {/* ------------------- STAFF ROUTES ------------------- */}
          <Route element={<ProtectedRoute allowedRoles={["staff"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/staff/dashboard" element={<StaffLayout />} />
              <Route path="/staff/bookings" element={<StaffBookings />} />
              <Route path="/staff/services" element={<ViewServices />} />
              <Route path="/staff/attendance" element={<MyAttendance />} />
            </Route>
          </Route>

          {/* ------------------- CLIENT ROUTES ------------------- */}
          <Route element={<ProtectedRoute allowedRoles={["client"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<ClientLayout />} />
              <Route path="/bookings" element={<ClientBookings />} />
              <Route path="/services" element={<ViewServices />} />
            </Route>
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/auth" />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
