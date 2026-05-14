import { useState, useEffect, useRef } from "react";
import AppShell from "../components/AppShell";
import API_BASE_URL from "../config";

const BACKEND = API_BASE_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";

type Question = {
  caseId: string;
  imageBase64: string;
  previousFindings: string;
  suggestedActions: string;
  progressionRisk: string;
  lifestyleFactors: string;
  recommendedFollowup: string;
  patientProfile: string;
};

type AnswerResult = {
  correct: boolean;
  correctGrade: number;
  gradeLabel: string;
  previousFindings: string;
  suggestedActions: string;
  progressionRisk: string;
  lifestyleFactors: string;
  recommendedFollowup: string;
  patientProfile: string;
};

type LeaderboardEntry = {
  rank: number;
  email: string;
  score: number;
  total: number;
  accuracy: number;
  difficulty: string;
  createdAt: string;
};

type QuizPageProps = {
  onBackToDashboard: () => void;
  onGoToUpload: () => void;
  onGoToHistory: () => void;
  onLogout: () => void;
  onSearchCase: (query: string) => Promise<{ ok: boolean; message?: string }>;
  onGoToResearch?: () => void;
};

// const BACKEND = "http://localhost:4000";
const TOTAL_QUESTIONS = 10;
const TIME_PER_QUESTION = 30;

const GRADE_LABELS: Record<number, string> = {
  0: "Grade 0 — Normal",
  1: "Grade 1 — Doubtful",
  2: "Grade 2 — Mild",
  3: "Grade 3 — Moderate",
  4: "Grade 4 — Severe",
};

const DIFFICULTY_GRADES: Record<Difficulty, number[]> = {
  easy: [0, 4],
  medium: [0, 1, 2, 3, 4],
  hard: [1, 2, 3],
};

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDifficulty(difficulty: Difficulty) {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

// ─── Component ────────────────────────────────────────────────────────────────

function QuizPage({
  onBackToDashboard,
  onGoToUpload,
  onGoToHistory,
  onLogout,
  onSearchCase,
  onGoToResearch,
}: QuizPageProps) {
  const [screen, setScreen] = useState<
    "intro" | "quiz" | "feedback" | "summary" | "leaderboard"
  >("intro");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [question, setQuestion] = useState<Question | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [loading, setLoading] = useState(false);
  const [gradeBreakdown, setGradeBreakdown] = useState<
    Record<number, { correct: number; total: number }>
  >({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "quiz" || !question) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit(null);
          return 0;
        }

        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
  }, [screen, question]);

  // ─── Fetch question ───────────────────────────────────────────────────────
  const fetchQuestion = async () => {
    setLoading(true);
    setSelectedGrade(null);
    setTimeLeft(TIME_PER_QUESTION);
    clearInterval(timerRef.current!);

    try {
      const res = await fetch(
        `${BACKEND}/api/v1/quiz/question?difficulty=${difficulty}`,
        {
          headers: authHeader(),
        },
      );

      const data = await res.json();
      setQuestion(data);
      setScreen("quiz");
    } catch {
      alert("Failed to load question. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Submit answer ────────────────────────────────────────────────────────
  const handleSubmit = async (grade: number | null) => {
    if (!question) return;

    clearInterval(timerRef.current!);

    const submittedGrade = grade ?? -1;

    if (grade === null) {
      setSelectedGrade(-1);
    }

    try {
      const res = await fetch(`${BACKEND}/api/v1/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          caseId: question.caseId,
          userAnswer: submittedGrade,
          difficulty,
          timeLeft,
        }),
      });

      const result: AnswerResult = await res.json();
      setAnswerResult(result);

      if (result.correct) {
        setScore((s) => s + 1);
        setStreak((s) => {
          const newStreak = s + 1;
          setMaxStreak((ms) => Math.max(ms, newStreak));
          return newStreak;
        });
      } else {
        setStreak(0);
      }

      setGradeBreakdown((prev) => {
        const g = result.correctGrade;
        const entry = prev[g] || { correct: 0, total: 0 };

        return {
          ...prev,
          [g]: {
            correct: entry.correct + (result.correct ? 1 : 0),
            total: entry.total + 1,
          },
        };
      });

      setScreen("feedback");
    } catch {
      alert("Failed to submit answer.");
    }
  };

  // ─── Next question or finish ──────────────────────────────────────────────
  const handleNext = async () => {
    if (questionIndex + 1 >= TOTAL_QUESTIONS) {
      await fetch(`${BACKEND}/api/v1/quiz/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          score,
          total: TOTAL_QUESTIONS,
          difficulty,
          accuracy: Math.round((score / TOTAL_QUESTIONS) * 100),
        }),
      });

      setScreen("summary");
    } else {
      setQuestionIndex((i) => i + 1);
      fetchQuestion();
    }
  };

  // ─── Leaderboard ──────────────────────────────────────────────────────────
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(
        `${BACKEND}/api/v1/quiz/leaderboard?difficulty=${difficulty}`,
        {
          headers: authHeader(),
        },
      );

      const data = await res.json();
      setLeaderboard(data);
      setScreen("leaderboard");
    } catch {
      alert("Failed to load leaderboard.");
    }
  };

  // ─── Reset ────────────────────────────────────────────────────────────────
  const handleRestart = () => {
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setQuestionIndex(0);
    setGradeBreakdown({});
    setQuestion(null);
    setAnswerResult(null);
    setScreen("intro");
  };

  // ─── Render wrapper ───────────────────────────────────────────────────────
  const renderShell = (children: React.ReactNode, subtitle?: string) => (
    <AppShell
      currentPage="quiz"
      title="KneeVision Quiz"
      subtitle={
        subtitle ||
        "Practice Kellgren-Lawrence grading using real knee X-ray cases."
      }
      onGoToDashboard={onBackToDashboard}
      onGoToUpload={onGoToUpload}
      onGoToHistory={onGoToHistory}
      onGoToResearch={onGoToResearch}
      onLogout={onLogout}
      onSearchCase={onSearchCase}
    >
      {children}
    </AppShell>
  );

  // ─── Render: Intro ────────────────────────────────────────────────────────
  if (screen === "intro") {
    return renderShell(
      <>
        <section className="kv-quiz-hero">
          <div className="kv-quiz-hero-content">
            <span className="kv-dashboard-eyebrow">KL grading challenge</span>

            <h2>Train your eye for knee OA severity</h2>

            <p>
              Review knee X-ray images, choose the most likely KL grade, and get
              immediate feedback based on radiographic findings.
            </p>

            <div className="kv-quiz-hero-actions">
              <button
                className="kv-primary-action"
                onClick={fetchQuestion}
                disabled={loading}
              >
                {loading ? "Loading..." : "Start Quiz"}
              </button>

              <button
                className="kv-secondary-action"
                onClick={fetchLeaderboard}
              >
                View Leaderboard
              </button>
            </div>
          </div>
        </section>

        <section className="kv-quiz-grid">
          <article className="kv-panel">
            <div className="kv-panel-header">
              <div>
                <h3>Choose Difficulty</h3>
                <p>Select the grade range you want to practice.</p>
              </div>
            </div>

            <div className="kv-quiz-difficulty-grid">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  className={`kv-quiz-difficulty-card ${
                    difficulty === d ? "kv-quiz-difficulty-card--active" : ""
                  }`}
                  onClick={() => setDifficulty(d)}
                >
                  <strong>{formatDifficulty(d)}</strong>
                  <span>
                    {d === "easy" && "Grade 0 vs Grade 4 only"}
                    {d === "medium" && "All 5 grades"}
                    {d === "hard" && "Grades 1, 2, and 3 only"}
                  </span>
                </button>
              ))}
            </div>
          </article>

          <article className="kv-panel">
            <div className="kv-panel-header">
              <div>
                <h3>Quiz Rules</h3>
                <p>Each session is short and focused.</p>
              </div>
            </div>

            <div className="kv-quiz-rule-list">
              <div className="kv-quiz-rule">
                <span>01</span>
                <p>{TOTAL_QUESTIONS} questions per session</p>
              </div>

              <div className="kv-quiz-rule">
                <span>02</span>
                <p>{TIME_PER_QUESTION} seconds per image</p>
              </div>

              <div className="kv-quiz-rule">
                <span>03</span>
                <p>Build streaks for consecutive correct answers</p>
              </div>

              <div className="kv-quiz-rule">
                <span>04</span>
                <p>Top scores are saved to the leaderboard</p>
              </div>
            </div>
          </article>
        </section>
      </>,
    );
  }

  // ─── Render: Quiz ─────────────────────────────────────────────────────────
  if (screen === "quiz" && question) {
    const grades = DIFFICULTY_GRADES[difficulty];
    const timerPct = (timeLeft / TIME_PER_QUESTION) * 100;
    const timerColor =
      timeLeft > 15
        ? "var(--success)"
        : timeLeft > 8
          ? "#f59e0b"
          : "var(--error)";

    return renderShell(
      <section className="kv-quiz-play-layout">
        <article className="kv-panel kv-quiz-question-panel">
          <div className="kv-quiz-play-topbar">
            <div>
              <span className="kv-quiz-progress">
                Question {questionIndex + 1} / {TOTAL_QUESTIONS}
              </span>

              {streak >= 2 && (
                <span className="kv-quiz-streak">🔥 {streak} streak</span>
              )}
            </div>

            <div className="kv-quiz-score-chip">Score: {score}</div>
          </div>

          <div className="quiz-timer-track">
            <div
              className="quiz-timer-fill"
              style={{ width: `${timerPct}%`, background: timerColor }}
            />
          </div>

          <div className="quiz-timer-label" style={{ color: timerColor }}>
            {timeLeft}s remaining
          </div>

          <div className="kv-quiz-image-card">
            <img
              src={question.imageBase64}
              alt="Knee X-ray"
              className="quiz-xray"
            />
          </div>
        </article>

        <aside className="kv-panel kv-quiz-answer-panel">
          <div className="kv-panel-header">
            <div>
              <h3>What is the KL Grade?</h3>
              <p>Select the best answer for this X-ray image.</p>
            </div>
          </div>

          <div className="kv-quiz-grade-grid">
            {grades.map((g) => (
              <button
                key={g}
                className={`kv-quiz-grade-btn ${
                  selectedGrade === g ? "kv-quiz-grade-btn--selected" : ""
                }`}
                onClick={() => {
                  setSelectedGrade(g);
                  handleSubmit(g);
                }}
              >
                {GRADE_LABELS[g]}
              </button>
            ))}
          </div>
        </aside>
      </section>,
      `Question ${questionIndex + 1} of ${TOTAL_QUESTIONS}. Choose the most likely KL grade before time runs out.`,
    );
  }

  // ─── Render: Feedback ─────────────────────────────────────────────────────
  if (screen === "feedback" && answerResult) {
    return renderShell(
      <section className="kv-quiz-feedback-layout">
        <div
          className={`kv-quiz-feedback-banner ${
            answerResult.correct
              ? "kv-quiz-feedback-banner--correct"
              : "kv-quiz-feedback-banner--wrong"
          }`}
        >
          {answerResult.correct
            ? "Correct!"
            : selectedGrade === -1
              ? "Time's up!"
              : "Incorrect"}
        </div>

        <article className="kv-panel kv-quiz-feedback-card">
          <div className="kv-panel-header">
            <div>
              <h3>Correct Answer: {GRADE_LABELS[answerResult.correctGrade]}</h3>
              <p>Review the radiographic findings for this case.</p>
            </div>
          </div>

          <div className="quiz-findings-grid">
            {answerResult.progressionRisk && (
              <div className="quiz-finding">
                <span>Progression Risk</span>
                <strong>{answerResult.progressionRisk}</strong>
              </div>
            )}

            {answerResult.recommendedFollowup && (
              <div className="quiz-finding">
                <span>Recommended Follow-up</span>
                <strong>{answerResult.recommendedFollowup}</strong>
              </div>
            )}

            {answerResult.patientProfile && (
              <div className="quiz-finding">
                <span>Patient Profile</span>
                <strong>{answerResult.patientProfile}</strong>
              </div>
            )}

            {answerResult.lifestyleFactors && (
              <div className="quiz-finding">
                <span>Lifestyle Factors</span>
                <strong>{answerResult.lifestyleFactors}</strong>
              </div>
            )}
          </div>

          {answerResult.previousFindings && (
            <p className="quiz-findings-text">
              <strong>Previous:</strong> {answerResult.previousFindings}
            </p>
          )}

          {answerResult.suggestedActions && (
            <p className="quiz-findings-text">
              <strong>Actions:</strong> {answerResult.suggestedActions}
            </p>
          )}

          <div className="quiz-feedback-meta">
            <span>
              Score: <strong>{score}</strong>
            </span>

            {streak >= 2 && (
              <span>
                🔥 Streak: <strong>{streak}</strong>
              </span>
            )}

            <span>
              Question {questionIndex + 1} of {TOTAL_QUESTIONS}
            </span>
          </div>

          <button
            className="kv-primary-action kv-quiz-next-btn"
            onClick={handleNext}
          >
            {questionIndex + 1 >= TOTAL_QUESTIONS
              ? "See Results"
              : "Next Question →"}
          </button>
        </article>
      </section>,
      "Review the explanation, then move to the next case.",
    );
  }

  // ─── Render: Summary ──────────────────────────────────────────────────────
  if (screen === "summary") {
    const accuracy = Math.round((score / TOTAL_QUESTIONS) * 100);

    return renderShell(
      <section className="kv-quiz-summary-layout">
        <article className="kv-panel kv-quiz-summary-card">
          <span className="kv-dashboard-eyebrow">Quiz complete</span>

          <h2>
            {score}/{TOTAL_QUESTIONS}
          </h2>
          <p>{accuracy}% accuracy</p>

          <div className="quiz-summary-stats">
            <div className="quiz-stat">
              <span>Difficulty</span>
              <strong>{formatDifficulty(difficulty)}</strong>
            </div>

            <div className="quiz-stat">
              <span>Best Streak</span>
              <strong>🔥 {maxStreak}</strong>
            </div>

            <div className="quiz-stat">
              <span>Result</span>
              <strong>
                {accuracy >= 80
                  ? "Excellent"
                  : accuracy >= 60
                    ? "Good"
                    : "Keep Practicing"}
              </strong>
            </div>
          </div>

          {Object.keys(gradeBreakdown).length > 0 && (
            <div className="quiz-breakdown">
              <h3>Performance by Grade</h3>

              {Object.entries(gradeBreakdown).map(([grade, data]) => (
                <div key={grade} className="quiz-breakdown-row">
                  <span>Grade {grade}</span>

                  <div className="quiz-breakdown-track">
                    <div
                      className="quiz-breakdown-fill"
                      style={{ width: `${(data.correct / data.total) * 100}%` }}
                    />
                  </div>

                  <span>
                    {data.correct}/{data.total}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="quiz-summary-actions">
            <button className="kv-primary-action" onClick={handleRestart}>
              Play Again
            </button>

            <button
              className="kv-secondary-light-action"
              onClick={fetchLeaderboard}
            >
              Leaderboard
            </button>

            <button
              className="kv-secondary-light-action"
              onClick={onBackToDashboard}
            >
              Dashboard
            </button>
          </div>
        </article>
      </section>,
      "Review your score and continue practicing KL grade recognition.",
    );
  }

  // ─── Render: Leaderboard ──────────────────────────────────────────────────
  if (screen === "leaderboard") {
    return renderShell(
      <section className="kv-panel kv-quiz-leaderboard-panel">
        <div className="kv-panel-header">
          <div>
            <h3>Leaderboard</h3>
            <p>Top scores for {difficulty} difficulty.</p>
          </div>

          <button
            className="kv-secondary-light-action"
            onClick={() => setScreen("intro")}
          >
            Back
          </button>
        </div>

        <div className="quiz-leaderboard">
          {leaderboard.length === 0 ? (
            <p className="upload-gallery-empty">
              No scores yet for this difficulty. Be the first!
            </p>
          ) : (
            leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`quiz-leaderboard-row ${
                  entry.rank === 1
                    ? "quiz-leaderboard-row--gold"
                    : entry.rank === 2
                      ? "quiz-leaderboard-row--silver"
                      : entry.rank === 3
                        ? "quiz-leaderboard-row--bronze"
                        : ""
                }`}
              >
                <span className="quiz-leaderboard-rank">#{entry.rank}</span>
                <span className="quiz-leaderboard-email">{entry.email}</span>
                <span className="quiz-leaderboard-score">
                  {entry.score}/{entry.total}
                </span>
                <span className="quiz-leaderboard-accuracy">
                  {entry.accuracy}%
                </span>
              </div>
            ))
          )}
        </div>
      </section>,
      `Top scores for ${difficulty} difficulty.`,
    );
  }

  return null;
}

export default QuizPage;
