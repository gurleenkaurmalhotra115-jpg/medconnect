🚀 Project Release: MedConnect — A Full-Stack Healthcare Management & Adherence Platform!

I’m excited to share a project I’ve been building: **MedConnect**, a digital health dashboard designed to bridge the gap between clinical prescription management and daily patient medication adherence.

Medical non-adherence is a major contributor to poor health outcomes. MedConnect attacks this issue directly by combining doctor clinical management portals with patient-facing tracking logs and visual analytics.

### 🛠️ The Tech Stack
* **Frontend**: React 19, Vite, CSS Grid/Flexbox
* **Backend (BaaS)**: Firebase (Auth, Firestore DB, Cloud Storage)
* **Web APIs**: Web Speech API (Native browser recognition), jsPDF

### 💡 Key Technical Features & Challenges Overcome:

1. **Voice-Assisted Prescription Writing**:
   Doctors can write prescriptions hands-free. I integrated the **Web Speech API** for speech-to-text dictation and built a custom React state engine to manage recording flags, paired with a bouncing CSS audio wave animation to give real-time recording feedback.

2. **SVG-Based Adherence Analytics**:
   To avoid adding heavy charting libraries, I built responsive, lightweight **SVG progress indicators** (circular rings and stacked bar charts) that analyze and display a patient's taken, missed, and skipped medication logs over a rolling 7-day period.

3. **Secure BaaS Security Layer**:
   Configured granular Firebase security rules to ensure patient data privacy. Doctors can only view records of patients under their search logs, and patients can only access their specific dashboard documents and file uploads.

4. **On-Demand PDF Report & ID Compilation**:
   Implemented client-side PDF document compilation using `jsPDF`. Patients can export a 30-day adherence compliance report or download a custom-sized, glassmorphic **Digital Health ID Card** complete with an emergency QR code for quick scanning.

---

💻 **Check out the GitHub Repository**: [Link to your GitHub repository here]
🎥 **Live Demo / Screenshots**: [Add a link or attachment here]

I learned a lot about Web Speech listeners, optimizing SVG rendering, and writing strict database security rules. If you're building in the HealthTech space or working with React + Firebase, I’d love to connect and hear your feedback!

#ReactJS #Firebase #WebDevelopment #SoftwareEngineering #HealthTech #JavaScript #FullStackDeveloper #PortfolioProject
