import { useState, useEffect, useCallback, useRef } from "react";
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
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { medicines } from "../data/medicines";
import AdherenceHistory from "../components/AdherenceHistory";
import ReportList from "../components/ReportList";
import UploadReport from "../components/UploadReport";
import { useToast } from "../components/Toast";
import { useDarkMode } from "../hooks/useDarkMode";

const SpeechRecognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export default function DoctorDashboard({ user }) {
  const showToast = useToast();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [refillRequests, setRefillRequests] = useState([]);
  const [loadingRefills, setLoadingRefills] = useState(false);
  const [pendingRefillCount, setPendingRefillCount] = useState(0);
  const [denialReasons, setDenialReasons] = useState({});
  const [reportsKey, setReportsKey] = useState(0);

  const [medicineName, setMedicineName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Once daily");
  const [durationDays, setDurationDays] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [medicineSuggestions, setMedicineSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [listeningField, setListeningField] = useState(null);
  const suggestionsRef = useRef(null);
  const recognitionRef = useRef(null);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const searchPatients = useCallback(async (term) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const lowerTerm = term.toLowerCase();
      const q = query(collection(db, "users"), where("role", "==", "patient"));
      const snapshot = await getDocs(q);
      const results = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const nameMatch = data.name?.toLowerCase().includes(lowerTerm);
        const emailMatch = data.email?.toLowerCase().includes(lowerTerm);
        if (nameMatch || emailMatch) {
          results.push({ id: d.id, ...data });
        }
      });
      setSearchResults(results);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchPatients(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, searchPatients]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPendingRefillCount = useCallback(async () => {
    try {
      const q = query(
        collection(db, "refill_requests"),
        where("doctor_id", "==", user.uid),
        where("status", "==", "pending")
      );
      const snap = await getDocs(q);
      setPendingRefillCount(snap.size);
    } catch (err) {
      console.error("Fetch pending count error:", err);
    }
  }, [user.uid]);

  useEffect(() => {
    fetchPendingRefillCount();
  }, [fetchPendingRefillCount]);

  const fetchPrescriptions = async (patientId) => {
    setLoadingPrescriptions(true);
    try {
      const q = query(
        collection(db, "prescriptions"),
        where("patient_id", "==", patientId)
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
      setPrescriptions([]);
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  const fetchRefillRequests = async (patientId) => {
    setLoadingRefills(true);
    try {
      const q = query(
        collection(db, "refill_requests"),
        where("patient_id", "==", patientId),
        where("doctor_id", "==", user.uid),
        where("status", "==", "pending")
      );
      const snapshot = await getDocs(q);
      const requests = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        let rxData = null;
        if (data.prescription_id) {
          const rxSnap = await getDocs(
            query(
              collection(db, "prescriptions"),
              where("__name__", "==", data.prescription_id)
            )
          );
          if (!rxSnap.empty) {
            rxData = rxSnap.docs[0].data();
          }
        }
        requests.push({ id: d.id, ...data, prescription: rxData });
      }
      requests.sort((a, b) => {
        const aTime = a.requested_at?.seconds || 0;
        const bTime = b.requested_at?.seconds || 0;
        return bTime - aTime;
      });
      setRefillRequests(requests);
    } catch (err) {
      console.error("Fetch refills error:", err);
    } finally {
      setLoadingRefills(false);
    }
  };

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    setSearchTerm("");
    setSuccessMsg("");
    setDenialReasons({});
    fetchPrescriptions(patient.uid);
    fetchRefillRequests(patient.uid);
  };

  const switchPatient = () => {
    setSelectedPatient(null);
    setPrescriptions([]);
    setRefillRequests([]);
    setSearchTerm("");
    setSearchResults([]);
    setSuccessMsg("");
    setDenialReasons({});
    resetForm();
  };

  const resetForm = () => {
    setMedicineName("");
    setDosage("");
    setFrequency("Once daily");
    setDurationDays("");
    setNotes("");
  };

  const handleMedicineChange = (value) => {
    setMedicineName(value);
    if (value.trim().length > 0) {
      const filtered = medicines.filter((m) =>
        m.name.toLowerCase().includes(value.toLowerCase())
      );
      setMedicineSuggestions(filtered.slice(0, 8));
      setShowSuggestions(true);
    } else {
      setMedicineSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectMedicine = (med) => {
    setMedicineName(med.name);
    setDosage(med.defaultDosage);
    setShowSuggestions(false);
  };

  const startListening = (field) => {
    if (!SpeechRecognition) return;
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (field === "medicine") {
        setMedicineName((prev) => (prev ? prev + " " + transcript : transcript));
      } else {
        setNotes((prev) => (prev ? prev + " " + transcript : transcript));
      }
      setListeningField(null);
    };

    recognition.onerror = () => {
      setListeningField(null);
    };

    recognition.onend = () => {
      setListeningField(null);
    };

    recognitionRef.current = recognition;
    setListeningField(field);
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    setListeningField(null);
  };

  const handleSubmitPrescription = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg("");

    try {
      await addDoc(collection(db, "prescriptions"), {
        doctor_id: user.uid,
        patient_id: selectedPatient.uid,
        medicine_name: medicineName,
        dosage,
        frequency,
        duration_days: parseInt(durationDays, 10),
        notes,
        created_at: serverTimestamp(),
        status: "active",
      });

      setSuccessMsg("Prescription added successfully.");
      resetForm();
      fetchPrescriptions(selectedPatient.uid);
    } catch (err) {
      console.error("Add prescription error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const updatePrescriptionStatus = async (rxId, newStatus) => {
    try {
      await updateDoc(doc(db, "prescriptions", rxId), { status: newStatus });

      if (newStatus === "paused" || newStatus === "stopped") {
        const doseQuery = query(
          collection(db, "dose_logs"),
          where("prescription_id", "==", rxId)
        );
        const doseSnap = await getDocs(doseQuery);
        const updates = [];
        doseSnap.forEach((d) => {
          const data = d.data();
          if (data.status === "pending") {
            updates.push(updateDoc(doc(db, "dose_logs", d.id), { status: "cancelled" }));
          }
        });
        await Promise.all(updates);
      }

      setPrescriptions((prev) =>
        prev.map((rx) => (rx.id === rxId ? { ...rx, status: newStatus } : rx))
      );
    } catch (err) {
      console.error("Update status error:", err);
    }
  };

  const approveRefill = async (request) => {
    try {
      await updateDoc(doc(db, "refill_requests", request.id), {
        status: "approved",
      });

      if (request.prescription) {
        const rx = request.prescription;
        await addDoc(collection(db, "prescriptions"), {
          doctor_id: user.uid,
          patient_id: selectedPatient.uid,
          medicine_name: rx.medicine_name,
          dosage: rx.dosage,
          frequency: rx.frequency,
          duration_days: rx.duration_days,
          notes: rx.notes || "",
          created_at: serverTimestamp(),
          status: "active",
        });
      }

      setRefillRequests((prev) => prev.filter((r) => r.id !== request.id));
      setPendingRefillCount((prev) => Math.max(0, prev - 1));
      fetchPrescriptions(selectedPatient.uid);
    } catch (err) {
      console.error("Approve refill error:", err);
    }
  };

  const denyRefill = async (request) => {
    try {
      const reason = denialReasons[request.id] || "";
      await updateDoc(doc(db, "refill_requests", request.id), {
        status: "denied",
        denial_reason: reason,
      });

      setRefillRequests((prev) => prev.filter((r) => r.id !== request.id));
      setPendingRefillCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Deny refill error:", err);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.seconds) return "—";
    return new Date(timestamp.seconds * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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
          {pendingRefillCount > 0 && (
            <span className="refill-badge">{pendingRefillCount}</span>
          )}
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
          <span className="nav-role doctor-badge">Doctor</span>
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
            <span className="nav-role doctor-badge" style={{ width: "fit-content" }}>Doctor</span>
          </div>
          <button className="mobile-nav-close" onClick={() => setMenuOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mobile-nav-items">
          {pendingRefillCount > 0 && (
            <button className="mobile-nav-item active" onClick={() => { setMenuOpen(false); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
              Refill Requests ({pendingRefillCount})
            </button>
          )}
          <button className="mobile-nav-item" onClick={toggleDark}>
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
          <button className="mobile-nav-item logout" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>

      <main className="dashboard-main">
        {!selectedPatient ? (
          <>
            <div className="dashboard-welcome">
              <h1>Welcome, Dr. {user.name}</h1>
              <p>Search for a patient to view their records and add prescriptions.</p>
            </div>

            <div className="search-section">
              <div className="search-container">
                <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by patient name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
                {searching && <div className="search-spinner" />}
              </div>

              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((patient) => (
                    <button
                      key={patient.uid}
                      className="search-result-item"
                      onClick={() => selectPatient(patient)}
                    >
                      <div className="result-avatar">
                        {patient.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="result-info">
                        <span className="result-name">{patient.name}</span>
                        <span className="result-email">{patient.email}</span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}

              {searchTerm && !searching && searchResults.length === 0 && (
                <div className="search-empty">No patients found matching "{searchTerm}"</div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="patient-header">
              <button className="btn-back" onClick={switchPatient}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Switch Patient
              </button>
              <div className="patient-info-card">
                <div className="patient-avatar">
                  {selectedPatient.name?.charAt(0).toUpperCase()}
                </div>
                <div className="patient-details">
                  <h2>{selectedPatient.name}</h2>
                  <p>{selectedPatient.email}</p>
                  {selectedPatient.date_of_birth && (
                    <p className="patient-dob">DOB: {selectedPatient.date_of_birth}</p>
                  )}
                </div>
              </div>
            </div>

            {refillRequests.length > 0 && (
              <div className="refill-section">
                <h3>Pending Refill Requests</h3>
                {loadingRefills ? (
                  <div className="section-loading"><div className="spinner" /></div>
                ) : (
                  <div className="refill-list">
                    {refillRequests.map((req) => (
                      <div key={req.id} className="refill-card">
                        <div className="refill-info">
                          {req.prescription ? (
                            <>
                              <span className="refill-medicine">{req.prescription.medicine_name}</span>
                              <div className="refill-meta">
                                <span>{req.prescription.dosage}</span>
                                <span className="rx-dot">·</span>
                                <span>{req.prescription.frequency}</span>
                              </div>
                            </>
                          ) : (
                            <span className="refill-medicine">Prescription not found</span>
                          )}
                          <span className="refill-date">Requested {formatDate(req.requested_at)}</span>
                        </div>
                        <div className="refill-actions">
                          <div className="refill-deny-area">
                            <textarea
                              className="denial-input"
                              placeholder="Reason (optional)"
                              rows="2"
                              value={denialReasons[req.id] || ""}
                              onChange={(e) =>
                                setDenialReasons((prev) => ({
                                  ...prev,
                                  [req.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              className="btn-refill-deny"
                              onClick={() => denyRefill(req)}
                            >
                              Deny
                            </button>
                          </div>
                          <button
                            className="btn-refill-approve"
                            onClick={() => approveRefill(req)}
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="prescriptions-section">
              <h3>Prescription History</h3>
              {loadingPrescriptions ? (
                <div className="section-loading">
                  <div className="spinner" />
                </div>
              ) : prescriptions.length === 0 ? (
                <div className="empty-state">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <p>No prescriptions yet for this patient.</p>
                </div>
              ) : (
                <div className="prescription-list">
                  {prescriptions.map((rx) => (
                    <div key={rx.id} className={`prescription-item ${rx.status}`}>
                      <div className="rx-header">
                        <span className="rx-medicine">{rx.medicine_name}</span>
                        <div className="rx-header-right">
                          <span className={`rx-status ${rx.status}`}>{rx.status}</span>
                          <div className="status-dropdown">
                            <button className="status-dropdown-btn">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="12" cy="5" r="1" />
                                <circle cx="12" cy="19" r="1" />
                              </svg>
                            </button>
                            <div className="status-dropdown-menu">
                              {["active", "paused", "stopped", "completed"].map((s) => (
                                <button
                                  key={s}
                                  className={`status-option ${s} ${rx.status === s ? "current" : ""}`}
                                  onClick={() => updatePrescriptionStatus(rx.id, s)}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="rx-details">
                        <span>{rx.dosage}</span>
                        <span className="rx-dot">·</span>
                        <span>{rx.frequency}</span>
                        <span className="rx-dot">·</span>
                        <span>{rx.duration_days} days</span>
                      </div>
                      {rx.notes && <p className="rx-notes">{rx.notes}</p>}
                      <span className="rx-date">{formatDate(rx.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <AdherenceHistory
              patientUid={selectedPatient.uid}
              patientName={selectedPatient.name}
            />

            <UploadReport
              patientUid={selectedPatient.uid}
              patientName={selectedPatient.name}
              uploaderUid={user.uid}
              uploaderName={user.name}
              onUploaded={() => setReportsKey((k) => k + 1)}
            />

            <div className="reports-section">
              <h3>Patient Reports</h3>
              <ReportList key={reportsKey} patientUid={selectedPatient.uid} />
            </div>

            <div className="new-prescription-section">
              <h3>New Prescription</h3>
              {successMsg && <div className="success-msg">{successMsg}</div>}
              <form onSubmit={handleSubmitPrescription} className="rx-form">
                <div className="form-row">
                  <div className="form-group" ref={suggestionsRef}>
                    <label htmlFor="medicine">Medicine Name</label>
                    <div className="input-with-mic">
                      <input
                        id="medicine"
                        type="text"
                        placeholder="e.g. Amoxicillin"
                        value={medicineName}
                        onChange={(e) => handleMedicineChange(e.target.value)}
                        onFocus={() => {
                          if (medicineName.trim().length > 0) {
                            const filtered = medicines.filter((m) =>
                              m.name.toLowerCase().includes(medicineName.toLowerCase())
                            );
                            setMedicineSuggestions(filtered.slice(0, 8));
                            setShowSuggestions(true);
                          }
                        }}
                        required
                      />
                      {SpeechRecognition && (
                        <button
                          type="button"
                          className={`mic-btn ${listeningField === "medicine" ? "listening" : ""}`}
                          onClick={() =>
                            listeningField === "medicine"
                              ? stopListening()
                              : startListening("medicine")
                          }
                        >
                          {listeningField === "medicine" ? (
                            <div className="audio-wave">
                              <span className="bar"></span>
                              <span className="bar"></span>
                              <span className="bar"></span>
                              <span className="bar"></span>
                            </div>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                              <line x1="12" y1="19" x2="12" y2="23" />
                              <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                    {showSuggestions && medicineSuggestions.length > 0 && (
                      <div className="medicine-suggestions">
                        {medicineSuggestions.map((med) => (
                          <button
                            key={med.name}
                            type="button"
                            className="suggestion-item"
                            onClick={() => selectMedicine(med)}
                          >
                            <span className="suggestion-name">{med.name}</span>
                            <span className="suggestion-dosage">{med.defaultDosage}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="dosage">Dosage</label>
                    <input
                      id="dosage"
                      type="text"
                      placeholder="e.g. 500mg"
                      value={dosage}
                      onChange={(e) => setDosage(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="frequency">Frequency</label>
                    <select
                      id="frequency"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      required
                    >
                      <option value="Once daily">Once daily</option>
                      <option value="Twice daily">Twice daily</option>
                      <option value="Three times daily">Three times daily</option>
                      <option value="As needed">As needed</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="duration">Duration (days)</label>
                    <input
                      id="duration"
                      type="number"
                      min="1"
                      placeholder="e.g. 7"
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="notes">Notes (optional)</label>
                  <div className="input-with-mic textarea-mic">
                    <textarea
                      id="notes"
                      rows="3"
                      placeholder="Any additional instructions..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    {SpeechRecognition && (
                      <button
                        type="button"
                        className={`mic-btn ${listeningField === "notes" ? "listening" : ""}`}
                        onClick={() =>
                          listeningField === "notes"
                            ? stopListening()
                            : startListening("notes")
                        }
                      >
                        {listeningField === "notes" ? (
                          <div className="audio-wave">
                            <span className="bar"></span>
                            <span className="bar"></span>
                            <span className="bar"></span>
                            <span className="bar"></span>
                          </div>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : "Add Prescription"}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
