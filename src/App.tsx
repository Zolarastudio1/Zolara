import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProtectedRoute from "@/components/ProtectedRoute";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Auth from "./pages/Auth";
import DashboardLayout from "./components/layout/DashboardLayout";
import Dashboard from "./pages/Admin/Dashboard";
import Bookings from "./pages/Admin/Bookings";
import Clients from "./pages/Admin/Clients";
import Staff from "./pages/Admin/Staff";
import Services from "./pages/Admin/Services";
import Sales from "./pages/Admin/Sales";
import Reports from "./pages/Admin/Reports";
import NotFound from "./pages/Admin/NotFound";
import ClientDashboard from "./pages/Client/ClientDashboard";
import ClientBookings from "./pages/Client/ClientBookings";
import ViewServices from "./pages/Client/ViewServices";
import AdminLayout from "./components/layout/AdminLayout";
import StaffLayout from "./components/layout/StaffLayout";
import ClientLayout from "./components/layout/ClientLayout";
import StaffDashboard from "./pages/Staff/StaffDashboard";

const queryClient = new QueryClient();

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/auth" element={<Auth />} />

      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="bookings" element={<Bookings />} />
        </Route>
      </Route>

      {/* Staff Routes */}
      <Route element={<ProtectedRoute allowedRoles={["staff"]} />}>
        <Route path="/staff" element={<StaffLayout />}>
          <Route path="/staff/dashboard" element={<StaffDashboard />} />
        </Route>
      </Route>

      {/* Client Routes */}
      <Route element={<ProtectedRoute allowedRoles={["client"]} />}>
        <Route path="/" element={<ClientLayout />}>
          <Route path="/dashboard" element={<ClientDashboard />} />
          {/* <Route path="/dashboard/profile" element={<ClientProfile />} /> */}
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/auth" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
