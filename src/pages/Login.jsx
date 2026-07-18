import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#2563EB" />
              <path d="M18 8v20M8 18h20" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <h1>Welcome back</h1>
          <p className="subtitle">Sign in to your MedConnect account</p>
        </div>

        {showReset ? (
          <>
            {resetSent ? (
              <div className="success-msg" style={{ marginBottom: 16 }}>
                Password reset email sent. Check your inbox.
              </div>
            ) : (
              <form onSubmit={handleResetPassword}>
                <p style={{ fontSize: 14, color: "var(--gray-600)", marginBottom: 16 }}>
                  Enter your email and we'll send you a reset link.
                </p>
                <div className="form-group">
                  <label htmlFor="reset-email">Email Address</label>
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <div className="error-msg">{error}</div>}
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            )}
            <p className="auth-footer">
              <button className="link-btn" onClick={() => { setShowReset(false); setResetSent(false); setError(""); }}>
                Back to Sign In
              </button>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="forgot-password-row">
                <button type="button" className="link-btn" onClick={() => { setShowReset(true); setError(""); }}>
                  Forgot password?
                </button>
              </div>

              {error && <div className="error-msg">{error}</div>}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="auth-footer">
              Don't have an account? <Link to="/signup">Create one</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
