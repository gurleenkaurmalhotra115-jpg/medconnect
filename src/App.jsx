import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import PatientDashboard from "./pages/PatientDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import { ToastProvider } from "./components/Toast";
import { useSessionTimeout } from "./hooks/useSessionTimeout";

function SessionExpiredModal() {
  return (
    <div className="session-expired-overlay">
      <div className="session-expired-card">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <h2>Session Expired</h2>
        <p>Your session has timed out for security. Please sign in again.</p>
        <a href="/login" className="btn-primary" style={{ textAlign: "center", textDecoration: "none", display: "block", marginTop: 16 }}>
          Sign In
        </a>
      </div>
    </div>
  );
}

function AppRoutes() {
  const isExpired = useSessionTimeout();
  if (isExpired) return <SessionExpiredModal />;

  return (
    <Routes>
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute>{(user) => <Dashboard user={user} />}</ProtectedRoute>} />
      <Route path="/doctor-dashboard" element={<ProtectedRoute>{(user) => <DoctorDashboard user={user} />}</ProtectedRoute>} />
      <Route path="/patient-dashboard" element={<ProtectedRoute>{(user) => <PatientDashboard user={user} />}</ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppRoutes />
    </ToastProvider>
  );
}
