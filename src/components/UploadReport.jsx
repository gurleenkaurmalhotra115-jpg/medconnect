import { useState, useRef } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "../firebase";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export default function UploadReport({ patientUid, patientName, uploaderUid, uploaderName, onUploaded }) {
  const [reportType, setReportType] = useState("Lab Result");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setError("");

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError("Only JPG, PNG, and PDF files are allowed.");
      setFile(null);
      return;
    }
    if (selected.size > MAX_SIZE) {
      setError("File size must be under 10MB.");
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setUploading(true);
    setProgress(0);
    setError("");

    try {
      const timestamp = Date.now();
      const storagePath = `reports/${patientUid}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setProgress(pct);
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

      await addDoc(collection(db, "reports"), {
        patient_id: patientUid,
        doctor_id: uploaderUid,
        uploader_name: uploaderName,
        report_type: reportType,
        notes,
        file_url: downloadURL,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        uploaded_at: serverTimestamp(),
      });

      setFile(null);
      setNotes("");
      setReportType("Lab Result");
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error("Upload error:", err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-section">
      <h3>Upload Report</h3>
      <form onSubmit={handleUpload} className="upload-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="report-type">Report Type</label>
            <select
              id="report-type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="Lab Result">Lab Result</option>
              <option value="X-Ray/Scan">X-Ray/Scan</option>
              <option value="Prescription Scan">Prescription Scan</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="report-file">File (JPG, PNG, PDF — max 10MB)</label>
            <input
              id="report-file"
              type="file"
              ref={fileInputRef}
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="report-notes">Notes (optional)</label>
          <input
            id="report-notes"
            type="text"
            placeholder="e.g. Blood test results from City Lab"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={uploading}
          />
        </div>

        {error && <div className="error-msg">{error}</div>}

        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">{progress}%</span>
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={uploading || !file}
        >
          {uploading ? "Uploading..." : "Upload Report"}
        </button>
      </form>
    </div>
  );
}
