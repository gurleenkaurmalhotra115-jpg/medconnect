import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";

function getDisplayStatus(dose) {
  if (dose.status === "taken" || dose.status === "skipped") return dose.status;
  if (dose.status === "cancelled") return "cancelled";
  const now = Date.now();
  const scheduledMs = (dose.scheduled_time?.seconds || 0) * 1000;
  if (now - scheduledMs > 2 * 60 * 60 * 1000) return "missed";
  return "pending";
}

function getDateKey(seconds) {
  const d = new Date(seconds * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(dateKey) {
  const [y, m, d] = dateKey.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdherenceHistory({ patientUid, patientName, showDownload = false }) {
  const [adherenceData, setAdherenceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState(null);

  useEffect(() => {
    const fetchAdherence = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startTimestamp = Timestamp.fromDate(thirtyDaysAgo);

        const q = query(
          collection(db, "dose_logs"),
          where("patient_id", "==", patientUid)
        );
        const snapshot = await getDocs(q);

        const grouped = {};
        snapshot.forEach((d) => {
          const data = d.data();
          const st = data.scheduled_time?.seconds || 0;
          if (st < startTimestamp.seconds) return;
          if (data.status === "cancelled") return;

          const dateKey = getDateKey(st);
          if (!grouped[dateKey]) grouped[dateKey] = [];

          const displayStatus = getDisplayStatus(data);
          grouped[dateKey].push({
            id: d.id,
            ...data,
            displayStatus,
          });
        });

        const sorted = Object.keys(grouped)
          .sort((a, b) => b.localeCompare(a))
          .map((dateKey) => {
            const doses = grouped[dateKey];
            const taken = doses.filter((d) => d.displayStatus === "taken").length;
            const missed = doses.filter((d) => d.displayStatus === "missed").length;
            const skipped = doses.filter((d) => d.displayStatus === "skipped").length;
            const pending = doses.filter((d) => d.displayStatus === "pending").length;
            const total = doses.length;
            return { dateKey, doses, taken, missed, skipped, pending, total };
          });

        setAdherenceData(sorted);
      } catch (err) {
        console.error("Fetch adherence error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (patientUid) fetchAdherence();
  }, [patientUid]);

  const getDayColor = (day) => {
    if (day.taken === day.total) return "adherence-green";
    if (day.missed >= day.total / 2) return "adherence-red";
    return "adherence-yellow";
  };

  const totals = adherenceData.reduce(
    (acc, day) => ({
      taken: acc.taken + day.taken,
      missed: acc.missed + day.missed,
      skipped: acc.skipped + day.skipped,
      pending: acc.pending + day.pending,
      total: acc.total + day.total,
    }),
    { taken: 0, missed: 0, skipped: 0, pending: 0, total: 0 }
  );

  const adherencePercent = totals.total > 0 ? Math.round((totals.taken / totals.total) * 100) : 0;
  const weeklyData = [...adherenceData].slice(0, 7).reverse();

  const getDayName = (dateKey) => {
    const [y, m, d] = dateKey.split("-");
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (adherencePercent / 100) * circumference;

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Medication Adherence Report", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Patient: ${patientName}`, 14, 32);
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    doc.text(`Period: ${from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, 14, 39);
    doc.text(`Generated: ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, 14, 46);

    let y = 56;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const summaryData = [
      ["Total Scheduled Doses", String(totals.total)],
      ["Doses Taken", String(totals.taken)],
      ["Doses Missed", String(totals.missed)],
      ["Doses Skipped", String(totals.skipped)],
      ["Adherence Rate", `${adherencePercent}%`],
    ];

    summaryData.forEach(([label, value]) => {
      doc.text(label, 14, y);
      doc.setFont("helvetica", "bold");
      doc.text(value, 90, y);
      doc.setFont("helvetica", "normal");
      y += 7;
    });

    y += 6;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Day-by-Day Breakdown", 14, y);
    y += 8;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 4, pageWidth - 28, 7, "F");
    doc.text("Date", 16, y);
    doc.text("Medicine", 50, y);
    doc.text("Scheduled", 110, y);
    doc.text("Status", 145, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    for (const day of adherenceData) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      for (const dose of day.doses.slice(0, 6)) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const schedTime = dose.scheduled_time?.seconds
          ? new Date(dose.scheduled_time.seconds * 1000).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
          : "—";

        doc.text(day.dateKey, 16, y);
        doc.text((dose.medicine_name || "—").substring(0, 30), 50, y);
        doc.text(schedTime, 110, y);
        const statusLabel = dose.displayStatus.charAt(0).toUpperCase() + dose.displayStatus.slice(1);
        doc.text(statusLabel, 145, y);
        y += 5;
      }
      if (day.doses.length > 6) {
        doc.text(`... and ${day.doses.length - 6} more`, 50, y);
        y += 5;
      }
      y += 1;
    }

    doc.save(`adherence-report-${now.toISOString().split("T")[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="section-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (adherenceData.length === 0) {
    return (
      <div className="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <p>No dose history in the last 30 days.</p>
      </div>
    );
  }

  return (
    <div className="adherence-section">
      <div className="adherence-header">
        <h3>Adherence History</h3>
        {showDownload && (
          <button className="btn-download-pdf" onClick={generatePDF}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Report (PDF)
          </button>
        )}
      </div>

      <div className="adherence-summary-cards">
        <div className="summary-card">
          <span className="summary-value">{totals.total}</span>
          <span className="summary-label">Total Doses</span>
        </div>
        <div className="summary-card green">
          <span className="summary-value">{totals.taken}</span>
          <span className="summary-label">Taken</span>
        </div>
        <div className="summary-card red">
          <span className="summary-value">{totals.missed}</span>
          <span className="summary-label">Missed</span>
        </div>
        <div className="summary-card gray">
          <span className="summary-value">{totals.skipped}</span>
          <span className="summary-label">Skipped</span>
        </div>
        <div className="summary-card blue">
          <span className="summary-value">{adherencePercent}%</span>
          <span className="summary-label">Adherence</span>
        </div>
      </div>

      <div className="adherence-charts">
        <div className="chart-container circular">
          <h4>Overall Adherence</h4>
          <div className="circular-progress-wrapper">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="circle-bg"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="circle-progress"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: strokeDashoffset,
                }}
              />
            </svg>
            <div className="circle-text">
              <span className="percent">{adherencePercent}%</span>
              <span className="label">Taken</span>
            </div>
          </div>
        </div>

        <div className="chart-container bar">
          <h4>Weekly Adherence Trend</h4>
          {weeklyData.length === 0 ? (
            <div className="no-chart-data">No history available</div>
          ) : (
            <div className="bar-chart-wrapper">
              <svg viewBox="0 0 320 150" width="100%" height="100%">
                <line x1="30" y1="20" x2="300" y2="20" stroke="var(--gray-200)" strokeDasharray="3,3" />
                <line x1="30" y1="65" x2="300" y2="65" stroke="var(--gray-200)" strokeDasharray="3,3" />
                <line x1="30" y1="110" x2="300" y2="110" stroke="var(--gray-300)" />
                
                <text x="25" y="23" textAnchor="end" fontSize="9" fill="var(--gray-500)">100%</text>
                <text x="25" y="68" textAnchor="end" fontSize="9" fill="var(--gray-500)">50%</text>
                <text x="25" y="113" textAnchor="end" fontSize="9" fill="var(--gray-500)">0%</text>

                {weeklyData.map((day, idx) => {
                  const xPos = 40 + idx * 36;
                  const total = day.total || 1;
                  const takenHeight = (day.taken / total) * 90;
                  const missedHeight = (day.missed / total) * 90;
                  const skippedHeight = (day.skipped / total) * 90;
                  const pendingHeight = (day.pending / total) * 90;

                  let currentY = 110;
                  
                  const takenY = currentY - takenHeight;
                  currentY = takenY;
                  
                  const skippedY = currentY - skippedHeight;
                  currentY = skippedY;
                  
                  const missedY = currentY - missedHeight;
                  currentY = missedY;

                  const pendingY = currentY - pendingHeight;

                  return (
                    <g key={day.dateKey}>
                      <rect x={xPos} y="20" width="16" height="90" fill="var(--gray-100)" rx="2" />
                      
                      {day.taken > 0 && (
                        <rect x={xPos} y={takenY} width="16" height={takenHeight} fill="var(--green-600)" rx={day.taken === day.total ? "2" : "0"} />
                      )}
                      {day.skipped > 0 && (
                        <rect x={xPos} y={skippedY} width="16" height={skippedHeight} fill="var(--gray-500)" rx={day.skipped === day.total ? "2" : "0"} />
                      )}
                      {day.missed > 0 && (
                        <rect x={xPos} y={missedY} width="16" height={missedHeight} fill="var(--red-500)" rx={day.missed === day.total ? "2" : "0"} />
                      )}
                      {day.pending > 0 && (
                        <rect x={xPos} y={pendingY} width="16" height={pendingHeight} fill="var(--blue-500)" rx={day.pending === day.total ? "2" : "0"} />
                      )}

                      <text x={xPos + 8} y="125" textAnchor="middle" fontSize="9" fontWeight="500" fill="var(--gray-600)">
                        {getDayName(day.dateKey)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className="adherence-list">
        {adherenceData.map((day) => (
          <div key={day.dateKey} className={`adherence-day ${getDayColor(day)}`}>
            <button
              className="adherence-day-header"
              onClick={() => setExpandedDate(expandedDate === day.dateKey ? null : day.dateKey)}
            >
              <div className="day-left">
                <span className="day-date">{formatDateDisplay(day.dateKey)}</span>
                <span className="day-counts">
                  {day.taken > 0 && <span className="count-taken">{day.taken} taken</span>}
                  {day.missed > 0 && <span className="count-missed">{day.missed} missed</span>}
                  {day.skipped > 0 && <span className="count-skipped">{day.skipped} skipped</span>}
                  {day.pending > 0 && <span className="count-pending">{day.pending} pending</span>}
                </span>
              </div>
              <svg
                className={`expand-icon ${expandedDate === day.dateKey ? "expanded" : ""}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {expandedDate === day.dateKey && (
              <div className="adherence-day-details">
                {day.doses.map((dose) => {
                  const schedTime = dose.scheduled_time?.seconds
                    ? new Date(dose.scheduled_time.seconds * 1000).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "—";
                  return (
                    <div key={dose.id} className="adherence-dose">
                      <div className="dose-left">
                        <span className="dose-name">{dose.medicine_name}</span>
                        <span className="dose-time">{schedTime} · {dose.dosage}</span>
                      </div>
                      <span className={`adherence-badge ${dose.displayStatus}`}>
                        {dose.displayStatus}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
