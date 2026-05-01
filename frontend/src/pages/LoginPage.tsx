import LoginForm from "../components/LoginForm";

type LoginPageProps = {
  onLoginSuccess: () => void;
  onSwitchToRegister: () => void;
  onBackToHome: () => void;
};

function LoginPage({
  onLoginSuccess,
  onSwitchToRegister,
  onBackToHome,
}: LoginPageProps) {
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

          <h1>AI-Assisted Knee X-ray Analysis</h1>

          <p>
            Upload knee X-ray images, review model confidence, and explore
            osteoarthritis severity results in one research-friendly workspace.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature-item">
              <span>01</span>
              <strong>Image Upload</strong>
            </div>
            <div className="auth-feature-item">
              <span>02</span>
              <strong>AI Prediction</strong>
            </div>
            <div className="auth-feature-item">
              <span>03</span>
              <strong>Result History</strong>
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
            onClick={onSwitchToRegister}
          >
            Register
          </button>
        </div>

        <div className="auth-card auth-card-split">
          <div className="auth-card-header">
            <div className="auth-logo-row">
              <span className="auth-logo-mark" />
              <span>KneeVision</span>
            </div>

            <h1>Login</h1>
            <p className="auth-subtitle">
              Sign in to continue your knee X-ray analysis workflow.
            </p>
          </div>

          <LoginForm onLoginSuccess={onLoginSuccess} />

          <p className="auth-switch-text">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              className="auth-switch-button"
              onClick={onSwitchToRegister}
            >
              Create one
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;