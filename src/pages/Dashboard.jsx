import { Navigate } from "react-router-dom";

export default function Dashboard({ user }) {
  if (!user || !user.role) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "doctor") {
    return <Navigate to="/doctor-dashboard" replace />;
  }

  if (user.role === "patient") {
    return <Navigate to="/patient-dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}
