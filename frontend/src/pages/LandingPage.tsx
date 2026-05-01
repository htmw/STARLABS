type LandingPageProps = {
  onLogin: () => void;
  onRegister: () => void;
};

const features = [
  {
    icon: "🔬",
    title: "KL Grade Analysis",
    desc: "Automatic Kellgren-Lawrence grading from X-ray images using deep learning.",
  },
  {
    icon: "⚡",
    title: "Fast Results",
    desc: "Upload once and get your analysis in seconds — no manual review needed.",
  },
  {
    icon: "🔒",
    title: "Secure & Private",
    desc: "Images are encrypted in transit. No patient identifiers required.",
  },
];

const stats = [
  { value: "95%+", label: "Model accuracy" },
  { value: "<5s", label: "Analysis time" },
  { value: "KL 0–4", label: "Full grading scale" },
];

function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  return (
    <div className="landing-page auth-screen-transition">
      {/* ── Nav ── */}
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <span aria-hidden="true" />
          KneeVision
        </div>
        <div className="landing-nav-actions">
          <button className="btn-ghost" onClick={onLogin}>
            Sign in
          </button>
          <button className="btn-primary-sm" onClick={onRegister}>
            Get started
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <h1 className="landing-title">
          AI-powered knee&nbsp;
          <em>osteoarthritis</em>
          &nbsp;analysis
        </h1>

        <p className="landing-desc">
          Upload a knee X-ray and get an instant Kellgren-Lawrence grade
          prediction. Built for clinicians and researchers.
        </p>

        <div className="landing-cta">
          <button className="btn-cta-primary" onClick={onRegister}>
            Create free account
          </button>
          <button className="btn-cta-secondary" onClick={onLogin}>
            Sign in
          </button>
        </div>

        {/* Stats */}
        <div className="landing-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="landing-stat-value">{s.value}</div>
              <div className="landing-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature strip ── */}
      <section className="landing-features">
        {features.map((f) => (
          <div key={f.title} className="landing-feature">
            <div className="landing-feature-icon">{f.icon}</div>
            <div>
              <div className="landing-feature-title">{f.title}</div>
              <div className="landing-feature-desc">{f.desc}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default LandingPage;
