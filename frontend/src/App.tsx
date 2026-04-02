import { useState } from "react";
import "./App.css";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UploadPage from "./pages/UploadPage";
import ResultsPage, { type AnalysisResult } from "./pages/ResultsPage";

type AuthMode = "landing" | "login" | "register";
type AppView = "upload" | "results";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem("token")),
  );
  const [authMode, setAuthMode] = useState<AuthMode>("landing");
  const [appView, setAppView] = useState<AppView>("upload");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setAppView("upload");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    setAuthMode("landing");
    setAppView("upload");
    setAnalysisResult(null);
  };

  const handleRegistrationSuccess = () => {
    setAuthMode("login");
  };

  const handleAnalysisReady = (result: AnalysisResult) => {
    setAnalysisResult(result);
    setAppView("results");
  };

  const handleBackToUpload = () => {
    setAppView("upload");
  };

  // Already authenticated → go straight to upload
  if (isAuthenticated) {
    if (appView === "results" && analysisResult) {
      return (
        <ResultsPage
          result={analysisResult}
          onBackToUpload={handleBackToUpload}
          onLogout={handleLogout}
        />
      );
    }

    return (
      <UploadPage
        onLogout={handleLogout}
        onAnalysisReady={handleAnalysisReady}
      />
    );
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