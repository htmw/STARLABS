import { useState } from "react";
import "./App.css";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UploadPage from "./pages/UploadPage";
import ResultsPage, { type AnalysisResult } from "./pages/ResultsPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";

const BACKEND = "http://localhost:4000";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type AuthMode = "landing" | "login" | "register";
type AppView = "dashboard" | "upload" | "results" | "history";

type PredictionImageRef = {
  id?: string;
  fileUrl?: string;
  originalName?: string;
};

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

  const handleGoToHistory = () => {
    setAppView("history");
  };

  const handleOpenSavedAnalysis = async (image: PredictionImageRef) => {
    try {
      if (!image.id) {
        throw new Error("Image id is missing.");
      }

      const res = await fetch(`${BACKEND}/api/v1/predictions`, {
        headers: authHeader(),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.message || `Failed to load predictions (${res.status})`,
        );
      }

      const predictions = await res.json();

      const matched = predictions.find(
        (prediction: {
          imageId: string;
          fileUrl: string;
          result: AnalysisResult;
        }) => prediction.imageId === image.id,
      );

      if (!matched) {
        throw new Error("No saved prediction found for this upload.");
      }

      const result: AnalysisResult = {
        imageUrl: `${BACKEND}${matched.fileUrl}`,
        fileName: image.originalName || "Uploaded image",
        grade: matched.result.grade,
        confidence: matched.result.confidence,
        probabilities: matched.result.probabilities || [],
        summary: matched.result.summary || "",
        severityLabel: matched.result.severityLabel || "Unknown",
        heatmapUrl: matched.result.heatmapUrl,
        isMock: false,
      };

      setAnalysisResult(result);
      setAppView("results");
    } catch (err) {
      console.error("Failed to open saved analysis:", err);
    }
  };

  if (isAuthenticated) {
    if (appView === "results" && analysisResult) {
      return (
        <ResultsPage
          result={analysisResult}
          onBackToUpload={handleBackToUpload}
          onBackToDashboard={handleGoToDashboard}
          onGoToHistory={handleGoToHistory}
          onLogout={handleLogout}
        />
      );
    }

    if (appView === "dashboard") {
      return (
        <DashboardPage
          onLogout={handleLogout}
          onGoToUpload={handleGoToUpload}
          onGoToHistory={handleGoToHistory}
          onOpenRecentUpload={handleOpenSavedAnalysis}
        />
      );
    }

    if (appView === "history") {
      return (
        <HistoryPage
          onLogout={handleLogout}
          onGoToDashboard={handleGoToDashboard}
          onGoToUpload={handleGoToUpload}
          onOpenHistoryImage={handleOpenSavedAnalysis}
        />
      );
    }

    return (
      <UploadPage
        onLogout={handleLogout}
        onAnalysisReady={handleAnalysisReady}
        onGoToDashboard={handleGoToDashboard}
        onOpenGalleryImage={handleOpenSavedAnalysis}
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