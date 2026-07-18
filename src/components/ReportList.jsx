import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function ReportList({ patientUid }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "reports"),
          where("patient_id", "==", patientUid)
        );
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        list.sort((a, b) => {
          const aTime = a.uploaded_at?.seconds || 0;
          const bTime = b.uploaded_at?.seconds || 0;
          return bTime - aTime;
        });
        setReports(list);
      } catch (err) {
        console.error("Fetch reports error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (patientUid) fetchReports();
  }, [patientUid]);

  const formatDate = (timestamp) => {
    if (!timestamp?.seconds) return "—";
    return new Date(timestamp.seconds * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "Lab Result":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21h6" /><path d="M9 18h6" /><path d="M12 2v4" /><path d="M12 6c-3 0-5 2-5 5v2h10v-2c0-3-2-5-5-5z" />
          </svg>
        );
      case "X-Ray/Scan":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2" /><circle cx="12" cy="12" r="4" /><path d="M12 8v0" />
          </svg>
        );
      case "Prescription Scan":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="section-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
        <p>No reports uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="report-list">
      {reports.map((report) => (
        <div key={report.id} className="report-card">
          <div className="report-icon">
            {getTypeIcon(report.report_type)}
          </div>
          <div className="report-info">
            <span className="report-type">{report.report_type}</span>
            {report.notes && <span className="report-notes">{report.notes}</span>}
            <span className="report-meta">
              {formatDate(report.uploaded_at)}
              {report.file_size && <span className="rx-dot">· {formatFileSize(report.file_size)}</span>}
              {report.uploader_name && <span className="rx-dot">· {report.uploader_name}</span>}
            </span>
          </div>
          <a
            href={report.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-view-report"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            View
          </a>
        </div>
      ))}
    </div>
  );
}
