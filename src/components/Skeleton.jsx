export function SkeletonCard({ count = 1 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="skeleton-card">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-text" style={{ width: "40%" }} />
    </div>
  ));
}

export function SkeletonDoseList({ count = 3 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="dose-item" style={{ opacity: 0.6 }}>
      <div className="dose-info">
        <div className="skeleton skeleton-text" style={{ width: 140 }} />
        <div className="skeleton skeleton-text" style={{ width: 100, height: 12 }} />
      </div>
      <div className="dose-actions">
        <div className="skeleton" style={{ width: 70, height: 30, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 70, height: 30, borderRadius: 6 }} />
      </div>
    </div>
  ));
}

export function SkeletonPrescriptionList({ count = 3 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="prescription-item" style={{ opacity: 0.6 }}>
      <div className="rx-header">
        <div className="skeleton skeleton-text" style={{ width: 160 }} />
        <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 20 }} />
      </div>
      <div className="skeleton skeleton-text" style={{ width: 200, height: 12 }} />
      <div className="skeleton skeleton-text" style={{ width: 120, height: 12 }} />
    </div>
  ));
}
