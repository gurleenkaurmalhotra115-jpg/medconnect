import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import AdherenceHistory from "../components/AdherenceHistory";
import ReportList from "../components/ReportList";
import UploadReport from "../components/UploadReport";
import { useToast } from "../components/Toast";
import DigitalHealthCard from "../components/DigitalHealthCard";
import { useDarkMode } from "../hooks/useDarkMode";

export default function PatientDashboard({ user }) {
  const showToast = useToast();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayDoses, setTodayDoses] = useState([]);
  const [loadingDoses, setLoadingDoses] = useState(true);
  const [pendingRefills, setPendingRefills] = useState(new Set());
  const [reportsKey, setReportsKey] = useState(0);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.seconds) return "—";
    return new Date(timestamp.seconds * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.seconds) return "—";
    return new Date(timestamp.seconds * 1000).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getTodayRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return {
      start: Timestamp.fromDate(start),
      end: Timestamp.fromDate(end),
    };
  };

  const fetchPrescriptions = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "prescriptions"),
        where("patient_id", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => {
        const aTime = a.created_at?.seconds || 0;
        const bTime = b.created_at?.seconds || 0;
        return bTime - aTime;
      });
      setPrescriptions(list);
    } catch (err) {
      console.error("Fetch prescriptions error:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateDoseSchedule = async (rx) => {
    if (rx.frequency === "As needed") return;

    const existingQuery = query(
      collection(db, "dose_logs"),
      where("prescription_id", "==", rx.id)
    );
    const existingSnap = await getDocs(existingQuery);
    if (!existingSnap.empty) return;

    const slots =
      rx.frequency === "Once daily"
        ? ["09:00"]
        : rx.frequency === "Twice daily"
        ? ["09:00", "21:00"]
        : ["09:00", "14:00", "21:00"];

    const createdDate = rx.created_at?.seconds
      ? new Date(rx.created_at.seconds * 1000)
      : new Date();

    const batch = [];
    for (let day = 0; day < (rx.duration_days || 1); day++) {
      for (const slot of slots) {
        const [h, m] = slot.split(":").map(Number);
        const scheduled = new Date(createdDate);
        scheduled.setDate(scheduled.getDate() + day);
        scheduled.setHours(h, m, 0, 0);

        batch.push(
          addDoc(collection(db, "dose_logs"), {
            prescription_id: rx.id,
            patient_id: user.uid,
            medicine_name: rx.medicine_name,
            dosage: rx.dosage,
            scheduled_time: Timestamp.fromDate(scheduled),
            status: "pending",
          })
        );
      }
    }
    await Promise.all(batch);
  };

  const fetchTodayDoses = async () => {
    setLoadingDoses(true);
    try {
      const { start, end } = getTodayRange();
      const q = query(
        collection(db, "dose_logs"),
        where("patient_id", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const st = data.scheduled_time?.seconds || 0;
        if (st >= start.seconds && st <= end.seconds && data.status !== "cancelled") {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => {
        const aTime = a.scheduled_time?.seconds || 0;
        const bTime = b.scheduled_time?.seconds || 0;
        return aTime - bTime;
      });
      setTodayDoses(list);
    } catch (err) {
      console.error("Fetch today doses error:", err);
    } finally {
      setLoadingDoses(false);
    }
  };

  const updateDoseStatus = async (doseId, status) => {
    try {
      await updateDoc(doc(db, "dose_logs", doseId), { status });
      setTodayDoses((prev) =>
        prev.map((d) => (d.id === doseId ? { ...d, status } : d))
      );
    } catch (err) {
      console.error("Update dose error:", err);
    }
  };

  const snoozeDose = async (doseId, currentScheduledTime) => {
    try {
      const newTime = new Date(currentScheduledTime.seconds * 1000 + 30 * 60 * 1000);
      await updateDoc(doc(db, "dose_logs", doseId), {
        scheduled_time: Timestamp.fromDate(newTime),
      });
      setTodayDoses((prev) => prev.filter((d) => d.id !== doseId));
      showToast("Dose snoozed for 30 minutes.");
    } catch (err) {
      console.error("Snooze dose error:", err);
    }
  };

  const requestRefill = async (rx) => {
    try {
      await addDoc(collection(db, "refill_requests"), {
        prescription_id: rx.id,
        patient_id: user.uid,
        doctor_id: rx.doctor_id,
        requested_at: serverTimestamp(),
        status: "pending",
      });
      setPendingRefills((prev) => new Set([...prev, rx.id]));
      showToast("Refill request sent to your doctor.");
    } catch (err) {
      console.error("Refill request error:", err);
    }
  };

  const fetchPendingRefills = async () => {
    try {
      const q = query(
        collection(db, "refill_requests"),
        where("patient_id", "==", user.uid),
        where("status", "==", "pending")
      );
      const snapshot = await getDocs(q);
      const rxIds = new Set();
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.prescription_id) {
          rxIds.add(data.prescription_id);
        }
      });
      setPendingRefills(rxIds);
    } catch (err) {
      console.error("Fetch pending refills error:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchPrescriptions();
      await fetchPendingRefills();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (prescriptions.length === 0 && !loading) return;
    const generateAll = async () => {
      for (const rx of prescriptions) {
        if (rx.status === "active") {
          await generateDoseSchedule(rx);
        }
      }
      await fetchTodayDoses();
    };
    if (prescriptions.length > 0) {
      generateAll();
    }
  }, [prescriptions, loading]);

  const pendingDoses = todayDoses.filter((d) => d.status === "pending");
  const completedDoses = todayDoses.filter((d) => d.status !== "pending");

  return (
    <div className="dashboard-page">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="#2563EB" />
            <path d="M18 8v20M8 18h20" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span>MedConnect</span>
        </div>
        <div className="nav-user">
          <button onClick={toggleDark} className="mic-btn" title={isDark ? "Light mode" : "Dark mode"}>
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <span className="nav-name">{user.name}</span>
          <span className="nav-role patient-badge">Patient</span>
          <button onClick={handleSignOut} className="btn-secondary">Sign Out</button>
        </div>
        <button className="hamburger-btn" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </nav>

      <div className={`mobile-menu-overlay ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} />
      <div className={`mobile-nav ${menuOpen ? "open" : ""}`}>
        <div className="mobile-nav-header">
          <div className="mobile-nav-user">
            <span className="mobile-nav-name">{user.name}</span>
            <span className="nav-role patient-badge" style={{ width: "fit-content" }}>Patient</span>
          </div>
          <button className="mobile-nav-close" onClick={() => setMenuOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mobile-nav-items">
          <button className="mobile-nav-item" onClick={toggleDark}>
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
          <button className="mobile-nav-item logout" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>

      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <h1>Welcome, {user.name}</h1>
          <p>Track your medications and manage your health.</p>
        </div>

        <div className="doses-section">
          <h3>Today's Doses</h3>
          {loadingDoses ? (
            <div className="section-loading">
              <div className="spinner" />
            </div>
          ) : todayDoses.length === 0 ? (
            <div className="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p>No doses scheduled for today.</p>
            </div>
          ) : (
            <>
              {pendingDoses.length > 0 && (
                <div className="dose-list">
                  {pendingDoses.map((dose) => (
                    <div key={dose.id} className="dose-item pending">
                      <div className="dose-info">
                        <span className="dose-medicine">{dose.medicine_name}</span>
                        <span className="dose-meta">
                          {dose.dosage} · {formatTime(dose.scheduled_time)}
                        </span>
                      </div>
                      <div className="dose-actions">
                        <button
                          className="dose-btn taken"
                          onClick={() => updateDoseStatus(dose.id, "taken")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Taken
                        </button>
                        <button
                          className="dose-btn skipped"
                          onClick={() => updateDoseStatus(dose.id, "skipped")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          Skip
                        </button>
                        <button
                          className="dose-btn snooze"
                          onClick={() => snoozeDose(dose.id, dose.scheduled_time)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          Snooze
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {completedDoses.length > 0 && (
                <div className="dose-history">
                  <span className="dose-history-label">Earlier today</span>
                  {completedDoses.map((dose) => (
                    <div key={dose.id} className={`dose-item ${dose.status}`}>
                      <div className="dose-info">
                        <span className="dose-medicine">{dose.medicine_name}</span>
                        <span className="dose-meta">
                          {dose.dosage} · {formatTime(dose.scheduled_time)}
                        </span>
                      </div>
                      <span className={`dose-status-badge ${dose.status}`}>
                        {dose.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="prescriptions-section">
          <h3>My Prescriptions</h3>
          {loading ? (
            <div className="section-loading">
              <div className="spinner" />
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>No prescriptions yet.</p>
            </div>
          ) : (
            <div className="prescription-list">
              {prescriptions.map((rx) => (
                <div key={rx.id} className={`prescription-item ${rx.status}`}>
                  <div className="rx-header">
                    <span className="rx-medicine">{rx.medicine_name}</span>
                    <span className={`rx-status ${rx.status}`}>{rx.status}</span>
                  </div>
                  <div className="rx-details">
                    <span>{rx.dosage}</span>
                    <span className="rx-dot">·</span>
                    <span>{rx.frequency}</span>
                    <span className="rx-dot">·</span>
                    <span>{rx.duration_days} days</span>
                  </div>
                  {rx.notes && <p className="rx-notes">{rx.notes}</p>}
                  <div className="rx-footer">
                    <span className="rx-date">{formatDate(rx.created_at)}</span>
                    {rx.status === "active" && (
                      pendingRefills.has(rx.id) ? (
                        <span className="refill-pending-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          Refill requested — pending approval
                        </span>
                      ) : (
                        <button
                          className="btn-refill"
                          onClick={() => requestRefill(rx)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                          </svg>
                          Request Refill
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DigitalHealthCard user={user} />

        <AdherenceHistory patientUid={user.uid} patientName={user.name} showDownload />

        <UploadReport
          patientUid={user.uid}
          patientName={user.name}
          uploaderUid={user.uid}
          uploaderName={user.name}
          onUploaded={() => setReportsKey((k) => k + 1)}
        />

        <div className="reports-section">
          <h3>My Reports</h3>
          <ReportList key={reportsKey} patientUid={user.uid} />
        </div>
      </main>
    </div>
  );
}
