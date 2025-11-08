import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = ({ user }) => {
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect based on role
  if (user.role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  } else if (user.role === "client") {
    return <Navigate to="/dashboard" replace />;
  } else {
    return <Navigate to="/auth" replace />;
  }
};

export default ProtectedRoute;
