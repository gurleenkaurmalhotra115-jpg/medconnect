import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";

export default function DigitalHealthCard({ user }) {
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [healthData, setHealthData] = useState({
    bloodGroup: "",
    allergies: "",
    emergencyContact: "",
    dob: "",
  });
  const [tempData, setTempData] = useState({ ...healthData });

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const loadedData = {
            bloodGroup: data.bloodGroup || "",
            allergies: data.allergies || "",
            emergencyContact: data.emergencyContact || "",
            dob: data.dob || "",
          };
          setHealthData(loadedData);
          setTempData(loadedData);
        }
      } catch (err) {
        console.error("Error fetching health data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHealthData();
  }, [user.uid]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, tempData);
      setHealthData(tempData);
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating health data:", err);
    } finally {
      setLoading(false);
    }
  };

  const downloadCardPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [85.6, 53.98], // CR80 standard credit card size (85.6mm x 53.98mm)
    });

    // Draw header
    doc.setFillColor(37, 99, 235); // MedConnect Blue
    doc.rect(0, 0, 85.6, 12, "F");

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("MedConnect DIGITAL HEALTH ID", 6, 8);

    // Draw medical cross in header
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.8);
    doc.line(78, 6, 82, 6);
    doc.line(80, 4, 80, 8);

    // Body styling
    doc.setTextColor(17, 24, 39); // Gray 900
    doc.setFontSize(8);

    // Patient Name
    doc.text("PATIENT NAME:", 6, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(user.name.toUpperCase(), 6, 21);

    // DOB & Blood Group
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DOB:", 6, 27);
    doc.text("BLOOD GROUP:", 36, 27);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(healthData.dob || "NOT REGISTERED", 6, 30);
    doc.text(healthData.bloodGroup || "UNKNOWN", 36, 30);

    // Allergies
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("ALLERGIES / CONDITIONS:", 6, 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const splitAllergies = doc.splitTextToSize(healthData.allergies || "None declared", 45);
    doc.text(splitAllergies, 6, 39);

    // Emergency Contact
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("EMERGENCY CONTACT:", 6, 47);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(healthData.emergencyContact || "NOT REGISTERED", 6, 50);

    // Draw card border
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.rect(0, 0, 85.6, 53.98, "S");

    // Add QR Code image from document if available
    const qrImg = document.getElementById("health-card-qr");
    if (qrImg) {
      try {
        doc.addImage(qrImg, "JPEG", 58, 16, 22, 22);
      } catch (err) {
        console.error("Error adding QR code to PDF:", err);
      }
    } else {
      // Draw placeholder box
      doc.setDrawColor(156, 163, 175);
      doc.rect(58, 16, 22, 22);
      doc.setFontSize(5);
      doc.text("QR ID CODE", 61, 28);
    }

    doc.save(`health-id-${user.name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://medconnect-515f7.web.app/patient-profile/${user.uid}`;

  return (
    <div className="health-card-section">
      <div className="health-card-header">
        <h3>Digital Health Card</h3>
        <div className="health-card-actions">
          <button className="btn-secondary" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? "Cancel" : "Update Info"}
          </button>
          <button className="btn-download-pdf" onClick={downloadCardPDF}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download ID Card
          </button>
        </div>
      </div>

      <div className="health-card-container">
        {/* Physical ID Card Replica */}
        <div className="health-id-card">
          <div className="card-top-bar">
            <div className="card-logo">
              <svg width="16" height="16" viewBox="0 0 36 36" fill="none">
                <rect width="36" height="36" rx="8" fill="#fff" />
                <path d="M18 8v20M8 18h20" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <span>MedConnect Digital ID</span>
            </div>
            <span className="card-status-chip">PATIENT</span>
          </div>

          <div className="card-body">
            <div className="card-info-left">
              <div className="info-item full">
                <span className="item-label">PATIENT NAME</span>
                <span className="item-value">{user.name}</span>
              </div>
              
              <div className="info-row">
                <div className="info-item">
                  <span className="item-label">BLOOD GROUP</span>
                  <span className="item-value highlight">{healthData.bloodGroup || "—"}</span>
                </div>
                <div className="info-item">
                  <span className="item-label">DOB</span>
                  <span className="item-value">{healthData.dob || "—"}</span>
                </div>
              </div>

              <div className="info-item full">
                <span className="item-label">ALLERGIES & MEDICAL CONDITIONS</span>
                <span className="item-value">{healthData.allergies || "No active declarations"}</span>
              </div>

              <div className="info-item full">
                <span className="item-label">EMERGENCY CONTACT</span>
                <span className="item-value">{healthData.emergencyContact || "—"}</span>
              </div>
            </div>

            <div className="card-info-right">
              <div className="qr-wrapper">
                <img
                  id="health-card-qr"
                  src={qrUrl}
                  alt="QR Code ID"
                  crossOrigin="anonymous"
                />
              </div>
              <span className="qr-help">Scan for Medical Profile</span>
            </div>
          </div>
        </div>

        {/* Edit Form Drawer/Box */}
        {isEditing && (
          <form onSubmit={handleSave} className="health-card-form">
            <h4>Update Digital ID Details</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Blood Group</label>
                <select
                  value={tempData.bloodGroup}
                  onChange={(e) => setTempData({ ...tempData, bloodGroup: e.target.value })}
                >
                  <option value="">Select blood group</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input
                  type="date"
                  value={tempData.dob}
                  onChange={(e) => setTempData({ ...tempData, dob: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Emergency Contact Phone</label>
              <input
                type="tel"
                placeholder="e.g. +1 (555) 019-2834"
                value={tempData.emergencyContact}
                onChange={(e) => setTempData({ ...tempData, emergencyContact: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Allergies & Medical Conditions</label>
              <textarea
                rows="2"
                placeholder="e.g. Penicillin allergy, diabetic, asthma..."
                value={tempData.allergies}
                onChange={(e) => setTempData({ ...tempData, allergies: e.target.value })}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Saving..." : "Save Card"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
