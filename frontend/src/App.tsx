import { useState } from "react";
import "./App.css";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UploadPage from "./pages/UploadPage";

type AuthMode = "landing" | "login" | "register";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem("token")),
  );
  const [authMode, setAuthMode] = useState<AuthMode>("landing");

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    setAuthMode("landing");
  };

  const handleRegistrationSuccess = () => {
    setAuthMode("login");
  };

  // Already authenticated → go straight to upload
  if (isAuthenticated) {
    return <UploadPage onLogout={handleLogout} />;
  }

  // Landing page
  if (authMode === "landing") {
    return (
      <LandingPage
        onLogin={() => setAuthMode("login")}
        onRegister={() => setAuthMode("register")}
      />
    );
  }

  // Auth forms (login / register) — identical to your original code
  return authMode === "login" ? (
    <LoginPage
      onLoginSuccess={handleLoginSuccess}
      onSwitchToRegister={() => setAuthMode("register")}
    />
  ) : (
    <RegisterPage
      onRegistrationSuccess={handleRegistrationSuccess}
      onSwitchToLogin={() => setAuthMode("login")}
    />
  );
}

export default App;
