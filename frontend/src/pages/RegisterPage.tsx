import RegisterForm from "../components/RegisterForm";

function RegisterPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>KneeVision</h1>
        <p className="auth-subtitle">Create your account</p>
        <RegisterForm />
      </div>
    </main>
  );
}

export default RegisterPage;