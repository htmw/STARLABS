import LoginForm from "../components/LoginForm";

type LoginPageProps = {
  onLoginSuccess: () => void;
  onSwitchToRegister: () => void;
};

function LoginPage({ onLoginSuccess, onSwitchToRegister }: LoginPageProps) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>KneeVision</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        <LoginForm onLoginSuccess={onLoginSuccess} />

        <p className="auth-switch-text">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            className="auth-switch-button"
            onClick={onSwitchToRegister}
          >
            Register
          </button>
        </p>
      </div>
    </main>
  );
}

export default LoginPage;
