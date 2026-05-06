import { useEffect, useState } from "react";
import "./App.css";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UploadPage from "./pages/UploadPage";
import ResultsPage, { type AnalysisResult } from "./pages/ResultsPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import QuizPage from "./pages/QuizPage";
import SettingsPage from "./pages/SettingsPage";

import API_BASE_URL from "../src/config";

const BACKEND = API_BASE_URL;
// const BACKEND = "http://localhost:4000";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type AuthMode = "landing" | "login" | "register";
type AppView =
  | "dashboard"
  | "upload"
  | "results"
  | "history"
  | "quiz"
  | "settings";

type PredictionImageRef = {
  id?: string;
  fileUrl?: string;
  originalName?: string;
  createdAt?: string;
  imageData?: string | null;
};

type SavedPrediction = {
  id?: string;
  imageId: string;
  fileUrl: string;
  result: AnalysisResult;
};

type SearchResult = {
  ok: boolean;
  message?: string;
};

function getTimeValue(dateString?: string) {
  if (!dateString) return 0;

  const time = new Date(dateString).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function normalizeText(value?: string) {
  return (value || "").trim().toLowerCase();
}

function getSearchCaseNumber(query: string) {
  const cleaned = query.trim().toLowerCase();

  // Only formats like "case 3", "case 003", or "case #003"
  // are treated as case-number search.
  // Plain numbers like "003" will be treated as filename search.
  const match = cleaned.match(/^case\s*#?\s*0*(\d+)$/);

  if (!match) return null;

  const number = Number(match[1]);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function findImageBySearchQuery(
  images: PredictionImageRef[],
  query: string,
): PredictionImageRef | null {
  const normalizedQuery = normalizeText(query);
  const caseNumber = getSearchCaseNumber(query);

  if (caseNumber !== null) {
    const sortedOldestFirst = [...images].sort(
      (a, b) => getTimeValue(a.createdAt) - getTimeValue(b.createdAt),
    );

    return sortedOldestFirst[caseNumber - 1] || null;
  }

  return (
    images.find((image) => {
      const id = normalizeText(image.id);
      const originalName = normalizeText(image.originalName);
      const fileUrl = normalizeText(image.fileUrl);

      return (
        id === normalizedQuery ||
        originalName.includes(normalizedQuery) ||
        fileUrl.includes(normalizedQuery)
      );
    }) || null
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem("token")),
  );
  const [authMode, setAuthMode] = useState<AuthMode>("landing");
  const [appView, setAppView] = useState<AppView>("dashboard");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [predictionId, setPredictionId] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    const storedTheme = localStorage.getItem("kv-theme");
    const safeTheme = storedTheme === "dark" ? "dark" : "light";

    document.documentElement.setAttribute("data-theme", safeTheme);

    if (localStorage.getItem("kv-compact-layout") === "true") {
      document.documentElement.classList.add("kv-compact-mode");
    } else {
      document.documentElement.classList.remove("kv-compact-mode");
    }
  }, []);

  useEffect(() => {
    const handleGlobalNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{ view?: AppView }>;
      const nextView = customEvent.detail?.view;

      if (
        nextView === "dashboard" ||
        nextView === "upload" ||
        nextView === "results" ||
        nextView === "history" ||
        nextView === "quiz" ||
        nextView === "settings"
      ) {
        setAppView(nextView);
      }
    };

    window.addEventListener("kv:navigate", handleGlobalNavigate);

    return () => {
      window.removeEventListener("kv:navigate", handleGlobalNavigate);
    };
  }, []);

  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    };

    scrollToTop();

    const frameId = window.requestAnimationFrame(scrollToTop);
    const timeoutId = window.setTimeout(scrollToTop, 120);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [appView, predictionId, analysisResult?.imageUrl]);

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
    setPredictionId(undefined);
  };

  const handleRegistrationSuccess = () => {
    setAuthMode("login");
  };

  const handleAnalysisReady = (result: AnalysisResult & { id?: string }) => {
    const { id, ...rest } = result;

    setPredictionId(id);
    setAnalysisResult(rest);
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

  const handleGoToQuiz = () => {
    setAppView("quiz");
  };

  const handleGoToSettings = () => {
    setAppView("settings");
  };

  const handleOpenSavedAnalysis = async (
    image: PredictionImageRef,
  ): Promise<boolean> => {
    try {
      if (!image.id) {
        throw new Error("Image id is missing.");
      }

      const res = await fetch(`${BACKEND}/api/v1/predictions`, {
        headers: authHeader(),
      });

      if (res.status === 401) {
        handleLogout();
        return false;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.message || `Failed to load predictions (${res.status})`,
        );
      }

      const predictions: SavedPrediction[] = await res.json();

      const matched = predictions.find(
        (prediction) => prediction.imageId === image.id,
      );

      if (!matched) {
        throw new Error("No saved prediction found for this upload.");
      }

      const result: AnalysisResult = {
        imageUrl: image.imageData || `${BACKEND}${matched.fileUrl}`,
        fileName: image.originalName || "Uploaded image",
        grade: matched.result.grade,
        confidence: matched.result.confidence,
        probabilities: matched.result.probabilities || [],
        summary: matched.result.summary || "",
        severityLabel: matched.result.severityLabel || "Unknown",
        heatmapUrl: matched.result.heatmapUrl,
        isMock: false,
        similarCases: matched.result.similarCases || [],
        osteophyteSeverity: matched.result.osteophyteSeverity,
        jointSpaceNarrowing: matched.result.jointSpaceNarrowing,
        subchondralSclerosis: matched.result.subchondralSclerosis,
        boneTexture: matched.result.boneTexture,
        affectedCompartment: matched.result.affectedCompartment,
        overallFindings: matched.result.overallFindings,
      };

      setPredictionId(matched.id);
      setAnalysisResult(result);
      setAppView("results");

      // Fetch similar cases in the background.
      // Opening the result should not wait for this request.
      void (async () => {
        try {
          const simRes = await fetch(`${BACKEND}/api/v1/similar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeader(),
            },
            body: JSON.stringify({
              fileUrl: matched.fileUrl,
              grade: matched.result.grade,
            }),
          });

          if (simRes.ok) {
            const simData = await simRes.json();

            setAnalysisResult((prev) =>
              prev ? { ...prev, similarCases: simData.similarCases } : prev,
            );
          }
        } catch (err) {
          console.error("Similar cases fetch failed:", err);
        }
      })();

      return true;
    } catch (err) {
      console.error("Failed to open saved analysis:", err);
      return false;
    }
  };

  const handleSearchCase = async (query: string): Promise<SearchResult> => {
    try {
      const trimmed = query.trim();

      if (!trimmed) {
        return {
          ok: false,
          message: "Please enter a case number or file name.",
        };
      }

      const res = await fetch(`${BACKEND}/api/v1/images`, {
        headers: authHeader(),
      });

      if (res.status === 401) {
        handleLogout();

        return {
          ok: false,
          message: "Session expired. Please log in again.",
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          message: "Search failed. Please try again.",
        };
      }

      const images: PredictionImageRef[] = await res.json();
      const matchedImage = findImageBySearchQuery(images, trimmed);

      if (!matchedImage) {
        return {
          ok: false,
          message: "No matching case found.",
        };
      }

      const opened = await handleOpenSavedAnalysis(matchedImage);

      if (!opened) {
        return {
          ok: false,
          message: "No matching case found.",
        };
      }

      return {
        ok: true,
        message: "Case opened.",
      };
    } catch (err) {
      console.error("Case search failed:", err);

      return {
        ok: false,
        message: "Search failed. Please try again.",
      };
    }
  };

  if (isAuthenticated) {
    if (appView === "results" && analysisResult) {
      return (
        <ResultsPage
          result={analysisResult}
          predictionId={predictionId}
          onBackToUpload={handleBackToUpload}
          onBackToDashboard={handleGoToDashboard}
          onGoToHistory={handleGoToHistory}
          onGoToQuiz={handleGoToQuiz}
          onLogout={handleLogout}
          onSearchCase={handleSearchCase}
        />
      );
    }

    if (appView === "dashboard") {
      return (
        <DashboardPage
          onLogout={handleLogout}
          onGoToUpload={handleGoToUpload}
          onGoToHistory={handleGoToHistory}
          onGoToQuiz={handleGoToQuiz}
          onOpenRecentUpload={handleOpenSavedAnalysis}
          onSearchCase={handleSearchCase}
        />
      );
    }

    if (appView === "history") {
      return (
        <HistoryPage
          onLogout={handleLogout}
          onGoToDashboard={handleGoToDashboard}
          onGoToUpload={handleGoToUpload}
          onGoToQuiz={handleGoToQuiz}
          onOpenHistoryImage={handleOpenSavedAnalysis}
          onSearchCase={handleSearchCase}
        />
      );
    }

    if (appView === "quiz") {
      return (
        <QuizPage
          onBackToDashboard={handleGoToDashboard}
          onGoToUpload={handleGoToUpload}
          onGoToHistory={handleGoToHistory}
          onLogout={handleLogout}
          onSearchCase={handleSearchCase}
        />
      );
    }

    if (appView === "settings") {
      return (
        <SettingsPage
          onLogout={handleLogout}
          onGoToDashboard={handleGoToDashboard}
          onGoToUpload={handleGoToUpload}
          onGoToHistory={handleGoToHistory}
          onGoToQuiz={handleGoToQuiz}
          onSearchCase={handleSearchCase}
        />
      );
    }

    return (
      <UploadPage
        onLogout={handleLogout}
        onAnalysisReady={handleAnalysisReady}
        onGoToDashboard={handleGoToDashboard}
        onGoToHistory={handleGoToHistory}
        onGoToQuiz={handleGoToQuiz}
        onOpenGalleryImage={handleOpenSavedAnalysis}
        onSearchCase={handleSearchCase}
      />
    );
  }

  if (authMode === "landing") {
    return (
      <LandingPage
        onLogin={() => setAuthMode("login")}
        onRegister={() => setAuthMode("register")}
      />
    );
  }

  return authMode === "login" ? (
    <LoginPage
      onLoginSuccess={handleLoginSuccess}
      onSwitchToRegister={() => setAuthMode("register")}
      onBackToHome={() => setAuthMode("landing")}
    />
  ) : (
    <RegisterPage
      onRegistrationSuccess={handleRegistrationSuccess}
      onSwitchToLogin={() => setAuthMode("login")}
      onBackToHome={() => setAuthMode("landing")}
    />
  );
}

export default App;