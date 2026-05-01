import RegisterForm from "../components/RegisterForm";

type RegisterPageProps = {
  onRegistrationSuccess: () => void;
  onSwitchToLogin: () => void;
  onBackToHome: () => void;
};

function RegisterPage({
  onRegistrationSuccess,
  onSwitchToLogin,
  onBackToHome,
}: RegisterPageProps) {
  return (
    <main className="auth-page auth-page-split auth-screen-transition">
      <section className="auth-hero-panel">
        <div className="auth-hero-pattern auth-hero-pattern-top" />
        <div className="auth-hero-pattern auth-hero-pattern-bottom" />

        <div className="auth-hero-content">
          <button
            type="button"
            className="auth-brand-large auth-brand-button"
            onClick={onBackToHome}
          >
            <span className="auth-brand-mark" />
            <span>KneeVision</span>
          </button>

          <h1>Create Your KneeVision Account</h1>

          <p>
            Join the platform to upload knee X-ray images, review AI-assisted
            osteoarthritis analysis, and keep track of previous results in one
            place.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature-item">
              <span>01</span>
              <strong>Secure Sign Up</strong>
            </div>
            <div className="auth-feature-item">
              <span>02</span>
              <strong>AI Analysis Workflow</strong>
            </div>
            <div className="auth-feature-item">
              <span>03</span>
              <strong>History Tracking</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-top-actions">
          <button
            type="button"
            className="auth-top-nav-button auth-top-nav-button--ghost"
            onClick={onBackToHome}
          >
            Home
          </button>

          <button
            type="button"
            className="auth-top-nav-button auth-top-nav-button--solid"
            onClick={onSwitchToLogin}
          >
            Login
          </button>
        </div>

        <div className="auth-card auth-card-split">
          <div className="auth-card-header">
            <div className="auth-logo-row">
              <span className="auth-logo-mark" />
              <span>KneeVision</span>
            </div>

            <h1>Register</h1>
            <p className="auth-subtitle">
              Create an account to start your knee X-ray analysis workflow.
            </p>
          </div>

          <RegisterForm onRegistrationSuccess={onRegistrationSuccess} />

          <p className="auth-switch-text">
            Already have an account?{" "}
            <button
              type="button"
              className="auth-switch-button"
              onClick={onSwitchToLogin}
            >
              Sign in
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

export default RegisterPage;