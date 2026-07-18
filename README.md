# MedConnect — Healthcare Management & Patient Adherence Platform

MedConnect is a premium, full-stack digital health dashboard designed to streamline doctor-patient workflows, improve prescription fulfillment, and automate patient adherence tracking. 

Built on a modern serverless architecture, MedConnect integrates role-based secure access, voice-assisted data entry (Web Speech API), automated PDF generation, and responsive data visualizations.

---

## 🚀 Key Features

### 👨‍⚕️ For Doctors
* **Centralized Patient Management**: Search patient directories and access historical clinical reports securely.
* **Digital Prescription Desk**: Easily prescribe medications with autofill recommendations from a drug database.
* **Voice-Assisted Input**: Hands-free prescription writing using the **Web Speech API** with real-time bouncing audio wave animations.
* **Refill Request Management**: Track, approve, or deny patient refill requests with recorded clinical reasons.

### 🤒 For Patients
* **Medication Adherence Tracker**: Visual checklist of daily doses (Taken, Skipped, Snoozed) that updates dynamically.
* **Digital Health ID Card**: A sleek, glassmorphic medical ID card displaying blood group, allergies, emergency contacts, and a custom profile QR code, downloadable as a PDF.
* **Medical Reports Hub**: Upload and store laboratory results, scans, and prescriptions (supports PDF, PNG, JPG) using Firebase Storage.
* **Refill Petitions**: One-click refill requests sent directly to the prescribing doctor.

### 📊 System Utilities
* **Adherence Analytics**: Automated SVG progress rings and weekly stacked bar charts showing adherence statistics.
* **Automated PDF Reports**: Dynamic generation of a 30-day medication compliance ledger via `jsPDF`.
* **Security & Session Control**: Guarded routes, auto-timeout on inactivity (15 mins), and environment-secured Firebase initialization.

---

## 🛠️ Tech Stack & Architecture

* **Frontend**: React 19, Vite (HMR & fast bundling), Vanilla CSS (Modern custom properties & responsive flex grids)
* **Backend (BaaS)**: Firebase v12 (Authentication, Firestore Database, Cloud Storage)
* **APIs & Libraries**: Web Speech API (Browser Native), jsPDF (PDF compilation), QR Server API (Dynamic ID QR codes)

### System Architecture

```mermaid
graph TD
    User([User: Patient / Doctor]) -->|Auth / Session| Auth[Firebase Auth]
    
    subgraph Client Application (React + Vite)
        Portal{Role Check}
        Portal -->|Doctor| DocDash[Doctor Dashboard]
        Portal -->|Patient| PatDash[Patient Dashboard]
        
        DocDash -->|Web Speech API| Voice[Voice-to-Text Input]
        DocDash -->|Rx Manager| RxForm[Prescription Form]
        
        PatDash -->|SVG Analytics| Charts[Adherence Charts]
        PatDash -->|jsPDF| PDFGen[PDF Report Exporter]
        PatDash -->|Health Card| IDCard[Digital ID Generator]
    end

    subgraph Cloud Infrastructure (Firebase BaaS)
        Auth --> AuthDB[(User Roles)]
        RxForm -->|Write Rx| Firestore[(Cloud Firestore)]
        Charts -->|Read Logs| Firestore
        IDCard -->|Sync emergency data| Firestore
        
        PatDash -->|Upload Scans| Storage[[Firebase Cloud Storage]]
    end
```

---

## 📂 Project Directory Structure

```text
medconnect/
├── public/                 # Static assets
├── src/
│   ├── assets/             # Brand logos and SVGs
│   ├── components/         # Reusable dashboard modules
│   │   ├── AdherenceHistory.jsx # Adherence ledger & PDF exporter
│   │   ├── DigitalHealthCard.jsx # Glassmorphic ID Card & editor
│   │   ├── ProtectedRoute.jsx   # Route security filter
│   │   ├── ReportList.jsx       # Document files manager
│   │   ├── UploadReport.jsx     # Firebase Storage file uploader
│   │   └── Toast.jsx            # Action notification banners
│   ├── data/
│   │   └── medicines.js    # Local drug index for smart suggestions
│   ├── hooks/
│   │   ├── useDarkMode.js  # Client theme hook (Dark/Light mode)
│   │   └── useSessionTimeout.js # Inactivity listener
│   ├── pages/
│   │   ├── Dashboard.jsx   # Role router hub
│   │   ├── DoctorDashboard.jsx  # Doctor workspace
│   │   ├── PatientDashboard.jsx # Patient workspace
│   │   ├── Login.jsx       # Auth login portal
│   │   └── Signup.jsx      # Portal registration
│   ├── App.css             # Main styling system
│   ├── App.jsx             # React routing table
│   ├── firebase.js         # Firebase connection config
│   └── main.jsx            # Mount setup
├── firebase.json           # Firebase deployment config
├── firestore.rules         # Security rules for database
└── storage.rules           # Security rules for storage upload
```

---

## ⚙️ Local Development Setup

Follow these steps to run the MedConnect platform locally:

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended) and a Firebase account.

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/your-username/medconnect.git
cd medconnect
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory and append your Firebase SDK keys:
```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Run the Dev Server
```bash
npm run dev
```
Open your browser to `http://localhost:5173`.

### 5. Build for Production
```bash
npm run build
npm run preview
```

---

## 🛡️ Firestore & Storage Security Rules

This project enforces secure database transactions. Make sure to apply security rules to your Firebase console.

* **Firestore Rules (`firestore.rules`)**:
  * Users can only read/write their own document data.
  * Prescriptions and dose logs are restrictively queried based on patient UID or doctor UID check.
* **Storage Rules (`storage.rules`)**:
  * Uploads are limited to images and PDF files under 10MB.
  * Patients and doctors can only retrieve files related to their registered IDs.
