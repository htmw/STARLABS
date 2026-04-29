import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Tooltip from "../components/Tooltip";

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
  datasetSource: string;
  osteophyteSeverity: string;
  jointSpaceNarrowing: string;
  subchondralSclerosis: string;
  boneTexture: string;
  affectedCompartment: string;
  overallFindings: string;
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
  osteophyteSeverity?: string;
  jointSpaceNarrowing?: string;
  subchondralSclerosis?: string;
  boneTexture?: string;
  affectedCompartment?: string;
  overallFindings?: string;
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
  onLogout: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

function ResultsPage({
  result,
  predictionId,
  onBackToUpload,
  onBackToDashboard,
  onGoToHistory,
  onLogout,
}: ResultsPageProps) {
  const topProbability =
    result.probabilities.reduce(
      (best, item) => (item.value > best.value ? item : best),
      result.probabilities[0],
    ) ?? null;

  // ─── Chat state ───────────────────────────────────────────────────────────
  // full conversation history — sent with every request so the model has context
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // load persisted chat history when the page opens (if predictionId exists)
  useEffect(() => {
    if (!predictionId) return;

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/v1/chat-history/${predictionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
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
  }, [predictionId]);

  // auto-scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // persist chat history to MongoDB after every assistant reply
  const saveHistory = async (messages: ChatMessage[]) => {
    if (!predictionId) return;
    try {
      const token = localStorage.getItem("token");
      await fetch("/api/v1/chat-history", {
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

  // sends the current input + full history to /api/v1/chat
  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const updatedMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: text },
    ];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/v1/chat", {
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
            osteophyteSeverity: result.osteophyteSeverity ?? null,
            jointSpaceNarrowing: result.jointSpaceNarrowing ?? null,
            subchondralSclerosis: result.subchondralSclerosis ?? null,
            boneTexture: result.boneTexture ?? null,
            affectedCompartment: result.affectedCompartment ?? null,
            overallFindings: result.overallFindings ?? null,
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
      saveHistory(finalMessages); // persist after every assistant reply
    } catch {
      setChatMessages([
        ...updatedMessages,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="results-page">
      <div className="results-shell">

        {/* ── Header ── */}
        <header className="results-header">
          <div>
            <div className="results-badge">AI-assisted analysis result</div>
            <h1>Prediction Result</h1>
            <p className="results-subtitle">
              Review the predicted Kellgren-Lawrence grade, model confidence,
              explanation heatmap, and the full class probability breakdown for
              the uploaded knee X-ray.
            </p>
          </div>
          <div className="results-header-actions">
            <button className="secondary-button" onClick={onBackToDashboard}>Dashboard</button>
            <button className="secondary-button" onClick={onGoToHistory}>History</button>
            <button className="secondary-button" onClick={onBackToUpload}>Upload</button>
            <button className="secondary-button" onClick={onLogout}>Logout</button>
          </div>
        </header>

        {/* ── Summary card ── */}
        <section className="results-summary-card">
          <div>
            <p className="results-summary-label">
              <Tooltip text="Model-predicted KL severity category.">
                <span>Predicted severity</span>
              </Tooltip>
            </p>
            <h2>{result.grade}</h2>
            <p className="results-summary-band">{result.severityLabel}</p>
          </div>
          <div className="results-summary-metrics">
            <div className="results-confidence-card">
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
            </div>
            <div className="results-summary-mini">
              <span>
                <Tooltip text="Class with the highest predicted probability.">
                  <span>Top class</span>
                </Tooltip>
              </span>
              <strong>{topProbability?.label ?? "-"}</strong>
            </div>
          </div>
        </section>

        {/* ── Images grid ── */}
        <section className="results-grid">
          <article className="results-card">
            <div className="results-card-header">
              <h3>Input Image</h3>
              <p>Uploaded file: {result.fileName}</p>
            </div>
            <div className="results-image-frame">
              <img src={result.imageUrl} alt={result.fileName} />
            </div>
          </article>

          <article className="results-card">
            <div className="results-card-header">
              <h3>
                <Tooltip text="Highlights image regions influencing the prediction.">
                  <span>Grad-CAM Explanation</span>
                </Tooltip>
              </h3>
              <p>Regions the model focused on when making its prediction.</p>
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

        {/* ── Probabilities + Summary ── */}
        <section className="results-bottom-grid">
          <article className="results-card">
            <div className="results-card-header">
              <h3>
                <Tooltip text="Softmax distribution across KL classes.">
                  <span>Class Probabilities</span>
                </Tooltip>
              </h3>
              <p>Probability distribution across all five severity classes.</p>
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

          <article className="results-card">
            <div className="results-card-header">
              <h3>Summary</h3>
              <p>{result.summary}</p>
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
            <div className="results-actions">
              <button className="primary-button" onClick={onBackToUpload}>
                Analyze Another Image
              </button>
            </div>
          </article>
        </section>

        {/* ── Similar Cases ── */}
        {result.similarCases && result.similarCases.length > 0 && (
          <section className="results-similar-section">
            <div className="results-card-header">
              <h3>
                <Tooltip text="Reference cases ranked by feature similarity.">
                  <span>Similar Cases</span>
                </Tooltip>
              </h3>
              <p>
                Top {result.similarCases.length} visually similar X-rays from
                the reference database, ranked by feature similarity.
              </p>
            </div>
            <div className="results-similar-grid">
              {result.similarCases.map((c) => (
                <article key={c.caseId} className="results-similar-card">
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
                    <div className="results-similar-grade">KL Grade {c.klGrade}</div>
                    <div className="results-similar-tags">
                      {c.osteophyteSeverity && (
                        <span className="results-similar-tag">Osteophytes: {c.osteophyteSeverity}</span>
                      )}
                      {c.jointSpaceNarrowing && (
                        <span className="results-similar-tag">JSN: {c.jointSpaceNarrowing}</span>
                      )}
                      {c.subchondralSclerosis && (
                        <span className="results-similar-tag">Sclerosis: {c.subchondralSclerosis}</span>
                      )}
                      {c.boneTexture && (
                        <span className="results-similar-tag">Texture: {c.boneTexture}</span>
                      )}
                      {c.affectedCompartment && (
                        <span className="results-similar-tag">Compartment: {c.affectedCompartment}</span>
                      )}
                    </div>
                    {c.overallFindings && (
                      <p className="results-similar-findings">{c.overallFindings}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── Chat Section ─────────────────────────────────────────────────────
            Stateful Q&A panel. Full history sent with every request so the
            model maintains conversation context. History persisted to MongoDB.
        ──────────────────────────────────────────────────────────────────────── */}
        <section className="results-chat-section">
          <div className="results-card-header">
            <h3>
              <Tooltip text="Ask contextual questions about this case.">
                <span>Ask about this X-ray</span>
              </Tooltip>
            </h3>
            <p>
              Ask questions about the predicted grade, findings, or how this
              case compares to similar cases.
              {predictionId && (
                <span className="results-chat-history-badge">
                  {historyLoading ? " Loading history…" : chatMessages.length > 0 ? " · History restored" : ""}
                </span>
              )}
            </p>
          </div>

          <div className="results-chat-messages">
            {chatMessages.length === 0 && !historyLoading && (
              <div className="results-chat-empty">
                Try: "Why is this Grade 2?" or "How does this compare to the similar cases?"
              </div>
            )}
            {historyLoading && (
              <div className="results-chat-empty">Loading previous conversation…</div>
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
            <div ref={chatEndRef} />
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
              className="primary-button"
              onClick={sendMessage}
              disabled={chatLoading || historyLoading || !chatInput.trim()}
            >
              Send
            </button>
          </div>
        </section>
        {/* ── End Chat Section ─────────────────────────────────────────────── */}

      </div>
    </main>
  );
}

export default ResultsPage;