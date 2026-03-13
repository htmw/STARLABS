import RegisterForm from "../components/RegisterForm";

type RegisterPageProps = {
  onRegistrationSuccess: () => void;
  onSwitchToLogin: () => void;
};

function RegisterPage({
  onRegistrationSuccess,
  onSwitchToLogin,
}: RegisterPageProps) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>KneeVision</h1>
        <p className="auth-subtitle">Create your account</p>

        <RegisterForm onRegistrationSuccess={onRegistrationSuccess} />

        <p className="auth-switch-text">
          Already have an account?{" "}
          <button
            type="button"
            className="auth-switch-button"
            onClick={onSwitchToLogin}
          >
            Login
          </button>
        </p>
      </div>
    </main>
  );
}

export default RegisterPage;