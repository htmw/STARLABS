import { useState } from "react";
import "./App.css";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UploadPage from "./pages/UploadPage";
import ResultsPage, { type AnalysisResult } from "./pages/ResultsPage";
import DashboardPage from "./pages/DashboardPage";

type AuthMode = "landing" | "login" | "register";
type AppView = "dashboard" | "upload" | "results";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem("token")),
  );
  const [authMode, setAuthMode] = useState<AuthMode>("landing");
  const [appView, setAppView] = useState<AppView>("dashboard");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setAppView("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    setAuthMode("landing");
    setAppView("dashboard");
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

  const handleGoToUpload = () => {
    setAppView("upload");
  };

  const handleGoToDashboard = () => {
    setAppView("dashboard");
  };

  if (isAuthenticated) {
    if (appView === "results" && analysisResult) {
      return (
        <ResultsPage
          result={analysisResult}
          onBackToUpload={handleBackToUpload}
          onBackToDashboard={handleGoToDashboard}
          onLogout={handleLogout}
        />
      );
    }

    if (appView === "dashboard") {
      return (
        <DashboardPage
          onLogout={handleLogout}
          onGoToUpload={handleGoToUpload}
        />
      );
    }

    return (
      <UploadPage
        onLogout={handleLogout}
        onAnalysisReady={handleAnalysisReady}
        onGoToDashboard={handleGoToDashboard}
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