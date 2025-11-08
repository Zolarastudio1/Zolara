import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />

            {/* Protected Routes */}
            <Route element={<DashboardLayout />}>
              <Route
                path="/"
                element={<ProtectedRoute user={user} />}
              />
              <Route path="/dashboard" element={<ClientDashboard />} />
              <Route path="admin/dashboard" element={<Dashboard />} />
              <Route path="admin/bookings" element={<Bookings />} />
              <Route path="admin/clients" element={<Clients />} />
              <Route path="admin/staff" element={<Staff />} />
              <Route path="admin/services" element={<Services />} />
              <Route path="admin/sales" element={<Sales />} />
              <Route path="admin/reports" element={<Reports />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
