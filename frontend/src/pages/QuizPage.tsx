import { useState, useEffect, useRef } from "react";

import API_BASE_URL from "../config";

const BACKEND = API_BASE_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";

type Question = {
  caseId: string;
  imageBase64: string;
  osteophyteSeverity: string;
  jointSpaceNarrowing: string;
  subchondralSclerosis: string;
  boneTexture: string;
  affectedCompartment: string;
  overallFindings: string;
};

type AnswerResult = {
  correct: boolean;
  correctGrade: number;
  osteophyteSeverity: string;
  jointSpaceNarrowing: string;
  subchondralSclerosis: string;
  boneTexture: string;
  affectedCompartment: string;
  overallFindings: string;
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
  onLogout: () => void;
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

// ─── Component ────────────────────────────────────────────────────────────────

function QuizPage({ onBackToDashboard, onLogout }: QuizPageProps) {
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
          handleSubmit(null); // time ran out
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

    const submittedGrade = grade ?? -1; // -1 means timed out

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

      // update score and streak
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

      // update grade breakdown
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
      // save score
      //   const finalScore = score + (answerResult?.correct ? 0 : 0); // already updated
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

  // ─── Render: Intro ────────────────────────────────────────────────────────
  if (screen === "intro") {
    return (
      <main className="quiz-page">
        <div className="quiz-shell">
          <header className="quiz-header">
            <div>
              <div className="results-badge">KL Grading Challenge</div>
              <h1>KneeVision Quiz</h1>
              <p className="results-subtitle">
                Test your ability to identify Kellgren-Lawrence grades from real
                knee X-rays. You'll get {TOTAL_QUESTIONS} questions with 30
                seconds each.
              </p>
            </div>
            <div className="results-header-actions">
              <button className="secondary-button" onClick={onBackToDashboard}>
                Dashboard
              </button>
              <button className="secondary-button" onClick={onLogout}>
                Logout
              </button>
            </div>
          </header>

          <div className="quiz-intro-card">
            <h2>Choose Difficulty</h2>
            <div className="quiz-difficulty-grid">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  className={`quiz-difficulty-btn ${difficulty === d ? "quiz-difficulty-btn--active" : ""}`}
                  onClick={() => setDifficulty(d)}
                >
                  <span className="quiz-difficulty-label">
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </span>
                  <span className="quiz-difficulty-desc">
                    {d === "easy" && "Grade 0 vs Grade 4 only"}
                    {d === "medium" && "All 5 grades"}
                    {d === "hard" && "Grades 1, 2 & 3 only"}
                  </span>
                </button>
              ))}
            </div>

            <div className="quiz-rules">
              <div className="quiz-rule">
                <p>{TOTAL_QUESTIONS} questions per session</p>
              </div>
              <div className="quiz-rule">
                <p>30 seconds per image</p>
              </div>
              <div className="quiz-rule">
                <p>Build streaks for consecutive correct answers</p>
              </div>
              <div className="quiz-rule">
                <p>Top scores saved to leaderboard</p>
              </div>
            </div>

            <div className="quiz-intro-actions">
              <button
                className="primary-button quiz-start-btn"
                onClick={fetchQuestion}
                disabled={loading}
              >
                {loading ? "Loading…" : "Start Quiz"}
              </button>
              <button className="secondary-button" onClick={fetchLeaderboard}>
                View Leaderboard
              </button>
            </div>
          </div>
        </div>
      </main>
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

    return (
      <main className="quiz-page">
        <div className="quiz-shell">
          <div className="quiz-topbar">
            <div className="quiz-progress-info">
              <span>
                Question {questionIndex + 1} / {TOTAL_QUESTIONS}
              </span>
              {streak >= 2 && (
                <span className="quiz-streak">🔥 {streak} streak</span>
              )}
            </div>
            <div className="quiz-score-chip">Score: {score}</div>
          </div>

          {/* timer bar */}
          <div className="quiz-timer-track">
            <div
              className="quiz-timer-fill"
              style={{ width: `${timerPct}%`, background: timerColor }}
            />
          </div>
          <div className="quiz-timer-label" style={{ color: timerColor }}>
            {timeLeft}s remaining
          </div>

          <div className="quiz-image-card">
            <img
              src={question.imageBase64}
              alt="Knee X-ray"
              className="quiz-xray"
            />
          </div>

          <p className="quiz-question-label">
            What is the KL Grade of this X-ray?
          </p>

          <div className="quiz-grade-grid">
            {grades.map((g) => (
              <button
                key={g}
                className={`quiz-grade-btn ${selectedGrade === g ? "quiz-grade-btn--selected" : ""}`}
                onClick={() => {
                  setSelectedGrade(g);
                  handleSubmit(g);
                }}
              >
                {GRADE_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ─── Render: Feedback ─────────────────────────────────────────────────────
  if (screen === "feedback" && answerResult) {
    return (
      <main className="quiz-page">
        <div className="quiz-shell">
          <div
            className={`quiz-feedback-banner ${answerResult.correct ? "quiz-feedback-banner--correct" : "quiz-feedback-banner--wrong"}`}
          >
            {answerResult.correct
              ? "Correct!"
              : selectedGrade === -1
                ? "Time's up!"
                : "✗ Incorrect"}
          </div>

          <div className="quiz-feedback-card">
            <h3>Correct Answer: {GRADE_LABELS[answerResult.correctGrade]}</h3>

            <div className="quiz-findings-grid">
              {answerResult.osteophyteSeverity && (
                <div className="quiz-finding">
                  <span>Osteophytes</span>
                  <strong>{answerResult.osteophyteSeverity}</strong>
                </div>
              )}
              {answerResult.jointSpaceNarrowing && (
                <div className="quiz-finding">
                  <span>Joint Space Narrowing</span>
                  <strong>{answerResult.jointSpaceNarrowing}</strong>
                </div>
              )}
              {answerResult.subchondralSclerosis && (
                <div className="quiz-finding">
                  <span>Subchondral Sclerosis</span>
                  <strong>{answerResult.subchondralSclerosis}</strong>
                </div>
              )}
              {answerResult.boneTexture && (
                <div className="quiz-finding">
                  <span>Bone Texture</span>
                  <strong>{answerResult.boneTexture}</strong>
                </div>
              )}
              {answerResult.affectedCompartment && (
                <div className="quiz-finding">
                  <span>Compartment</span>
                  <strong>{answerResult.affectedCompartment}</strong>
                </div>
              )}
            </div>

            {answerResult.overallFindings && (
              <p className="quiz-findings-text">
                {answerResult.overallFindings}
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
              className="primary-button quiz-next-btn"
              onClick={handleNext}
            >
              {questionIndex + 1 >= TOTAL_QUESTIONS
                ? "See Results"
                : "Next Question →"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ─── Render: Summary ──────────────────────────────────────────────────────
  if (screen === "summary") {
    const accuracy = Math.round((score / TOTAL_QUESTIONS) * 100);
    return (
      <main className="quiz-page">
        <div className="quiz-shell">
          <div className="quiz-summary-card">
            <h1>Quiz Complete!</h1>
            <div className="quiz-summary-score">
              <span className="quiz-summary-big">
                {score}/{TOTAL_QUESTIONS}
              </span>
              <span className="quiz-summary-pct">{accuracy}% accuracy</span>
            </div>

            <div className="quiz-summary-stats">
              <div className="quiz-stat">
                <span>Difficulty</span>
                <strong>
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </strong>
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
                      : "📚 Keep Practicing"}
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
                        style={{
                          width: `${(data.correct / data.total) * 100}%`,
                        }}
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
              <button className="primary-button" onClick={handleRestart}>
                Play Again
              </button>
              <button className="secondary-button" onClick={fetchLeaderboard}>
                Leaderboard
              </button>
              <button className="secondary-button" onClick={onBackToDashboard}>
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── Render: Leaderboard ──────────────────────────────────────────────────
  if (screen === "leaderboard") {
    return (
      <main className="quiz-page">
        <div className="quiz-shell">
          <header className="quiz-header">
            <div>
              <h1>Leaderboard</h1>
              <p className="results-subtitle">
                Top scores for {difficulty} difficulty
              </p>
            </div>
            <div className="results-header-actions">
              <button
                className="secondary-button"
                onClick={() => setScreen("intro")}
              >
                Back
              </button>
              <button className="secondary-button" onClick={onBackToDashboard}>
                Dashboard
              </button>
            </div>
          </header>

          <div className="quiz-leaderboard">
            {leaderboard.length === 0 ? (
              <p className="upload-gallery-empty">
                No scores yet for this difficulty. Be the first!
              </p>
            ) : (
              leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  className={`quiz-leaderboard-row ${entry.rank === 1 ? "quiz-leaderboard-row--gold" : entry.rank === 2 ? "quiz-leaderboard-row--silver" : entry.rank === 3 ? "quiz-leaderboard-row--bronze" : ""}`}
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
        </div>
      </main>
    );
  }

  return null;
}

export default QuizPage;
