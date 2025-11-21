import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ProtectedRoute = ({ allowedRoles }) => {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setLoading(false);

      // Fetch role from user_roles table
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setUserRole(roleData?.role || null);
      setLoading(false);
    };

    fetchUserRole();
  }, []);

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );

  return allowedRoles.includes(userRole) ? (
    <Outlet /> // Render nested routes
  ) : (
    <Navigate to="/auth" replace />
  );
};

export default ProtectedRoute;
