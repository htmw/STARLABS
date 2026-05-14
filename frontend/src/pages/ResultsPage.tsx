import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import AppShell from "../components/AppShell";
import Tooltip from "../components/Tooltip";
import API_BASE_URL from "../config";

const BACKEND = API_BASE_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProbabilityItem = {
  label: string;
  value: number;
};

export type SimilarCase = {
  caseId: string;
  similarity: number;
  imageBase64: string | null;
  klGrade: number;
  gradeLabel: string;
  previousFindings: string;
  suggestedActions: string;
  progressionRisk: string;
  lifestyleFactors: string;
  recommendedFollowup: string;
  patientProfile: string;
};

export type AnalysisResult = {
  imageUrl: string;
  fileName: string;
  grade: string;
  confidence: number;
  probabilities: ProbabilityItem[];
  summary: string;
  severityLabel: string;
  heatmapUrl?: string;
  isMock?: boolean;
  similarCases?: SimilarCase[];
  previousFindings?: string;
  suggestedActions?: string;
  progressionRisk?: string;
  lifestyleFactors?: string;
  recommendedFollowup?: string;
  patientProfile?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ResultsPageProps = {
  result: AnalysisResult;
  predictionId?: string;
  onBackToUpload: () => void;
  onBackToDashboard: () => void;
  onGoToHistory: () => void;
  onGoToQuiz: () => void;
  onGoToResearch?: () => void;
  onLogout: () => void;
  onSearchCase: (query: string) => Promise<{ ok: boolean; message?: string }>;
};




// ─── Component ────────────────────────────────────────────────────────────────

function ResultsPage({
  result,
  predictionId,
  onBackToUpload,
  onBackToDashboard,
  onGoToHistory,
  onGoToQuiz,
  onGoToResearch,
  onLogout,
  onSearchCase,
}: ResultsPageProps) {
  const topProbability =
    result.probabilities.length > 0
      ? result.probabilities.reduce((best, item) =>
          item.value > best.value ? item : best,
        )
      : null;

  // ─── Chat state ───────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollChatRef = useRef(false);
  const [expandedCase, setExpandedCase] = useState<SimilarCase | null>(null);

  useEffect(() => {
    shouldAutoScrollChatRef.current = false;
    setChatMessages([]);

    if (!predictionId) {
      setHistoryLoading(false);
      return;
    }

    const loadHistory = async () => {
      setHistoryLoading(true);

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${BACKEND}/api/v1/chat-history/${predictionId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        const data = await res.json();

        if (data.messages?.length > 0) {
          setChatMessages(data.messages);
        }
      } catch {
        // silently fail — chat just starts empty
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, [predictionId, result.imageUrl]);

  useEffect(() => {
    if (!shouldAutoScrollChatRef.current) return;

    const chatBox = chatMessagesRef.current;

    if (chatBox) {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, [chatMessages]);

  const saveHistory = async (messages: ChatMessage[]) => {
    if (!predictionId) return;

    try {
      const token = localStorage.getItem("token");

      await fetch(`${BACKEND}/api/v1/chat-history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ predictionId, messages }),
      });
    } catch {
      // silently fail — history save is non-critical
    }
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    shouldAutoScrollChatRef.current = true;

    const updatedMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: text },
    ];

    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${BACKEND}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
  imageBase64: result.imageUrl,
  result: {
    grade: result.grade,
    severityLabel: result.severityLabel,
    confidence: result.confidence,
    summary: result.summary,
    previousFindings: result.previousFindings ?? null,
    suggestedActions: result.suggestedActions ?? null,
    progressionRisk: result.progressionRisk ?? null,
    lifestyleFactors: result.lifestyleFactors ?? null,
    recommendedFollowup: result.recommendedFollowup ?? null,
    patientProfile: result.patientProfile ?? null,
  },
  similarCases: result.similarCases ?? [],
  messages: updatedMessages,
}),
      });

      const data = await response.json();

      const finalMessages: ChatMessage[] = [
        ...updatedMessages,
        { role: "assistant", content: data.reply ?? "No response received." },
      ];

      setChatMessages(finalMessages);
      saveHistory(finalMessages);
    } catch {
      setChatMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <AppShell
      currentPage="results"
      title="Prediction Result"
      subtitle="Review AI-assisted KL grade prediction, confidence, heatmap explanation, and case-level discussion."
      onGoToDashboard={onBackToDashboard}
      onGoToUpload={onBackToUpload}
      onGoToHistory={onGoToHistory}
      onGoToQuiz={onGoToQuiz}
      onGoToResearch={onGoToResearch}
      onLogout={onLogout}
      onSearchCase={onSearchCase}
    >
      <section className="kv-results-hero">
        <div className="kv-results-hero-main">
          <span className="kv-dashboard-eyebrow">
            AI-assisted analysis result
          </span>

          <h2>{result.grade}</h2>
          <p>{result.severityLabel}</p>

          <div className="kv-results-hero-actions">
            <button className="kv-primary-action" onClick={onBackToUpload}>
              Analyze Another Image
            </button>

            <button className="kv-secondary-action" onClick={onGoToHistory}>
              View History
            </button>
          </div>
        </div>

        <div className="kv-results-confidence-card">
          <div className="results-confidence-header">
            <Tooltip text="Model certainty for this selected class; not diagnostic accuracy.">
              <span>Confidence</span>
            </Tooltip>
            <strong>{result.confidence.toFixed(2)}%</strong>
          </div>

          <div
            className="results-confidence-track"
            role="progressbar"
            aria-valuenow={result.confidence}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Confidence ${result.confidence.toFixed(2)}%`}
          >
            <div
              className="results-confidence-fill"
              style={{
                width: `${Math.max(0, Math.min(result.confidence, 100))}%`,
              }}
            />
          </div>

          <div className="kv-results-top-class">
            <span>Top class</span>
            <strong>{topProbability?.label ?? "-"}</strong>
          </div>
        </div>
      </section>

      <section className="kv-results-image-grid">
        <article className="kv-panel">
          <div className="kv-panel-header">
            <div>
              <h3>Input Image</h3>
              <p>Uploaded file: {result.fileName}</p>
            </div>
          </div>

          <div className="results-image-frame">
            <img src={result.imageUrl} alt={result.fileName} />
          </div>
        </article>

        <article className="kv-panel">
          <div className="kv-panel-header">
            <div>
              <h3>
                <Tooltip text="Highlights image regions influencing the prediction.">
                  <span>Grad-CAM Explanation</span>
                </Tooltip>
              </h3>
              <p>Regions the model focused on when making its prediction.</p>
            </div>
          </div>

          {result.heatmapUrl ? (
            <div className="results-image-frame">
              <img src={result.heatmapUrl} alt="Grad-CAM explanation" />
            </div>
          ) : (
            <div className="results-heatmap-frame">
              <img src={result.imageUrl} alt="Grad-CAM placeholder" />
              <div className="results-heatmap-overlay" />
              <div className="results-heatmap-tag">Grad-CAM preview</div>
            </div>
          )}
        </article>
      </section>

      <section className="kv-results-detail-grid">
        <article className="kv-panel">
          <div className="kv-panel-header">
            <div>
              <h3>
                <Tooltip text="Softmax distribution across KL classes.">
                  <span>Class Probabilities</span>
                </Tooltip>
              </h3>
              <p>Probability distribution across all five severity classes.</p>
            </div>
          </div>

          <div className="results-probability-list">
            {result.probabilities.map((item) => (
              <div key={item.label} className="results-probability-row">
                <span className="results-probability-label">{item.label}</span>

                <div className="results-probability-track">
                  <div
                    className="results-probability-fill"
                    style={{ width: `${Math.max(item.value, 2)}%` }}
                  />
                </div>

                <span className="results-probability-value">
                  {item.value.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="kv-panel">
          <div className="kv-panel-header">
            <div>
              <h3>Summary</h3>
              <p>{result.summary}</p>
            </div>
          </div>

          <div className="results-summary-grid">
            <div className="results-info-box">
              <span>
                <Tooltip text="Prediction certainty; not diagnostic accuracy.">
                  <span>Confidence</span>
                </Tooltip>
              </span>
              <strong>{result.confidence.toFixed(2)}%</strong>
            </div>

            <div className="results-info-box">
              <span>
                <Tooltip text="Predicted Kellgren-Lawrence grade.">
                  <span>Predicted class</span>
                </Tooltip>
              </span>
              <strong>{result.grade}</strong>
            </div>

            <div className="results-info-box">
              <span>
                <Tooltip text="Readable label derived from KL grade.">
                  <span>Severity band</span>
                </Tooltip>
              </span>
              <strong>{result.severityLabel}</strong>
            </div>

            <div className="results-info-box">
              <span>
                <Tooltip text="Indicates whether heatmap output is available.">
                  <span>Explanation</span>
                </Tooltip>
              </span>
              <strong>{result.heatmapUrl ? "Connected" : "Placeholder"}</strong>
            </div>
          </div>

          {result.isMock && (
            <div className="results-note">
              This is a front-end mock result. Once your predict endpoint is
              ready, replace the mock data with the actual backend response.
            </div>
          )}
        </article>
      </section>

      {result.similarCases && result.similarCases.length > 0 && (
        <section className="kv-panel kv-results-similar-section">
          <div className="kv-panel-header">
            <div>
              <h3>
                <Tooltip text="Reference cases ranked by feature similarity.">
                  <span>Similar Cases</span>
                </Tooltip>
              </h3>
              <p>
                Top {result.similarCases.length} visually similar X-rays from
                the reference database. Click a case for clinical details.
              </p>
            </div>
          </div>

          <div className="results-similar-grid">
            {result.similarCases.map((c) => (
              <article
                key={c.caseId}
                className="results-similar-card"
                onClick={() => setExpandedCase(c)}
                style={{ cursor: "pointer" }}
              >
                <div className="results-similar-image-frame">
                  {c.imageBase64 ? (
                    <img src={c.imageBase64} alt={`Case ${c.caseId}`} />
                  ) : (
                    <div className="results-similar-no-image">No image</div>
                  )}
                  <div className="results-similar-badge">
                    {(c.similarity * 100).toFixed(1)}% match
                  </div>
                </div>

                <div className="results-similar-meta">
                  <div className="results-similar-grade">
                    KL Grade {c.klGrade} · {c.gradeLabel}
                  </div>
                  <div className="results-similar-tags">
                    {c.progressionRisk && (
                      <span className="results-similar-tag">
                        Risk: {c.progressionRisk.split("–")[0].split("-")[0].trim()}
                      </span>
                    )}
                    {c.patientProfile && (
                      <span className="results-similar-tag">
                        {c.patientProfile.split(",")[0]}
                      </span>
                    )}
                  </div>
                  <p className="results-similar-hint">Click to view details</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ─── Similar Case Modal ─────────────────────────────────────────── */}
      {expandedCase && (
        <div
          className="results-case-modal-overlay"
          onClick={() => setExpandedCase(null)}
        >
          <div
            className="results-case-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="results-case-modal-close"
              onClick={() => setExpandedCase(null)}
            >
              ✕
            </button>

           <div className="results-case-modal-header">
              <div className="results-case-modal-thumb">
                {expandedCase.imageBase64 ? (
                  <img src={expandedCase.imageBase64} alt={`Case ${expandedCase.caseId}`} />
                ) : (
                  <div className="results-similar-no-image">No image</div>
                )}
              </div>
              <div className="results-case-modal-title">
                <h3>KL Grade {expandedCase.klGrade} · {expandedCase.gradeLabel}</h3>
                <span className="results-similar-badge" style={{position: 'static'}}>
                  {(expandedCase.similarity * 100).toFixed(1)}% match
                </span>
              </div>
            </div>

            <div className="results-case-modal-body">

              {expandedCase.previousFindings && (
                <div className="results-case-modal-field">
                  <span>Previous Findings</span>
                  <p>{expandedCase.previousFindings}</p>
                </div>
              )}
              {expandedCase.suggestedActions && (
                <div className="results-case-modal-field">
                  <span>Suggested Actions</span>
                  <p>{expandedCase.suggestedActions}</p>
                </div>
              )}
              {expandedCase.progressionRisk && (
                <div className="results-case-modal-field">
                  <span>Progression Risk</span>
                  <p>{expandedCase.progressionRisk}</p>
                </div>
              )}
              {expandedCase.lifestyleFactors && (
                <div className="results-case-modal-field">
                  <span>Lifestyle Factors</span>
                  <p>{expandedCase.lifestyleFactors}</p>
                </div>
              )}
              {expandedCase.recommendedFollowup && (
                <div className="results-case-modal-field">
                  <span>Recommended Follow-up</span>
                  <p>{expandedCase.recommendedFollowup}</p>
                </div>
              )}
              {expandedCase.patientProfile && (
                <div className="results-case-modal-field">
                  <span>Patient Profile</span>
                  <p>{expandedCase.patientProfile}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="kv-panel kv-results-chat-section">
        <div className="kv-panel-header">
          <div>
            <h3>
              <Tooltip text="Ask contextual questions about this case.">
                <span>Ask about this X-ray</span>
              </Tooltip>
            </h3>

            <p>
              Ask questions about the predicted grade, findings, or similar
              cases.
              {predictionId && (
                <span className="results-chat-history-badge">
                  {historyLoading
                    ? " Loading history…"
                    : chatMessages.length > 0
                      ? " · History restored"
                      : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="results-chat-messages" ref={chatMessagesRef}>
          {chatMessages.length === 0 && !historyLoading && (
            <div className="results-chat-empty">
              Try: &quot;Why is this Grade 2?&quot; or &quot;How does this
              compare to the similar cases?&quot;
            </div>
          )}

          {historyLoading && (
            <div className="results-chat-empty">
              Loading previous conversation…
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`results-chat-bubble results-chat-bubble--${msg.role}`}
            >
              <span className="results-chat-role">
                {msg.role === "user" ? "You" : "KneeVision AI"}
              </span>

              {msg.role === "assistant" ? (
                <div className="results-chat-markdown">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          ))}

          {chatLoading && (
            <div className="results-chat-bubble results-chat-bubble--assistant">
              <span className="results-chat-role">KneeVision AI</span>
              <p className="results-chat-typing">Analyzing…</p>
            </div>
          )}
        </div>

        <div className="results-chat-input-row">
          <input
            className="results-chat-input"
            type="text"
            placeholder="Ask about this X-ray…"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={chatLoading || historyLoading}
          />

          <button
            className="kv-primary-action kv-results-send-button"
            onClick={sendMessage}
            disabled={chatLoading || historyLoading || !chatInput.trim()}
          >
            Send
          </button>
        </div>
      </section>
    </AppShell>
  );
}

export default ResultsPage;
