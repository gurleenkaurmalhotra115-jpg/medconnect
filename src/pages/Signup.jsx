import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Signup() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = () => {
    if (password.length === 0) return null;
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 2) return { label: "Weak", color: "var(--red-500)" };
    if (score <= 3) return { label: "Fair", color: "#f59e0b" };
    return { label: "Strong", color: "var(--green-600)" };
  };

  const strength = getPasswordStrength();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!role) {
      setError("Please select a role.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const uid = user.uid;

      const userData = {
        uid,
        name,
        email,
        role,
        createdAt: serverTimestamp(),
      };

      if (role === "doctor") {
        userData.license_number = licenseNumber;
        userData.specialization = specialization;
      } else {
        userData.date_of_birth = dateOfBirth;
      }

      await setDoc(doc(db, "users", uid), userData);

      try {
        await sendEmailVerification(user);
      } catch (_) {
        // silently fail — verification email is best-effort
      }

      navigate("/dashboard");
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
          <h1>Create your account</h1>
          <p className="subtitle">Join MedConnect as a doctor or patient</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="role-selector">
            <button
              type="button"
              className={`role-btn ${role === "doctor" ? "active" : ""}`}
              onClick={() => setRole("doctor")}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Doctor
            </button>
            <button
              type="button"
              className={`role-btn ${role === "patient" ? "active" : ""}`}
              onClick={() => setRole("patient")}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Patient
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            {strength && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div
                    className="strength-fill"
                    style={{
                      width: `${((password.length >= 6 ? 1 : 0) + (password.length >= 8 ? 1 : 0) + (/[A-Z]/.test(password) ? 1 : 0) + (/[0-9]/.test(password) ? 1 : 0) + (/[^A-Za-z0-9]/.test(password) ? 1 : 0)) * 20}%`,
                      background: strength.color,
                    }}
                  />
                </div>
                <span style={{ color: strength.color, fontSize: 12, fontWeight: 500 }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {role === "doctor" && (
            <>
              <div className="form-group">
                <label htmlFor="license">License Number</label>
                <input
                  id="license"
                  type="text"
                  placeholder="Enter your medical license number"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="specialization">Specialization</label>
                <input
                  id="specialization"
                  type="text"
                  placeholder="e.g. Cardiology, Neurology"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          {role === "patient" && (
            <div className="form-group">
              <label htmlFor="dob">Date of Birth</label>
              <input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
