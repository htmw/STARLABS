import { useEffect, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import API_BASE_URL from "../config";

const BACKEND = API_BASE_URL;

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Session = {
  sessionId: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};

type ResearchPageProps = {
  onLogout: () => void;
  onGoToDashboard: () => void;
  onGoToUpload: () => void;
  onGoToHistory: () => void;
  onGoToQuiz: () => void;
  onSearchCase: (query: string) => Promise<{ ok: boolean; message?: string }>;
  userGrade?: string;
};

type ParsedSource = {
  label: string;
  url: string;
};

type ParsedResponse = {
  summary: string;
  keyPoints: string[];
  clinicalNote: string;
  sources: ParsedSource[];
};

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "Research Session";
  return first.content.slice(0, 48) + (first.content.length > 48 ? "..." : "");
}

const TOPIC_CARDS = [
  {
    title: "Treatment Options",
    description: "Conservative, injection, and surgical treatments by grade",
    prompt: "What are the treatment options for each KL grade of osteoarthritis?",
  },
  {
    title: "KL Grading Guide",
    description: "How the Kellgren-Lawrence scale works from Grade 0 to 4",
    prompt: "Explain the Kellgren-Lawrence grading system for knee osteoarthritis in detail.",
  },
  {
    title: "OA Epidemiology",
    description: "Prevalence, risk factors, and global burden of knee OA",
    prompt: "What is the epidemiology of knee osteoarthritis — who gets it and why?",
  },
  {
    title: "Surgical Thresholds",
    description: "When knee replacement becomes the recommended option",
    prompt: "When is knee replacement surgery recommended for osteoarthritis patients?",
  },
  {
    title: "Imaging Features",
    description: "What to look for on X-rays — osteophytes, JSN, sclerosis",
    prompt: "What are the key radiographic features of knee osteoarthritis on X-ray?",
  },
  {
    title: "Current Research",
    description: "DMOADs, stem cells, biomarkers, and AI in OA diagnosis",
    prompt: "What are the current research directions and emerging treatments for osteoarthritis?",
  },
];

const KL_GRADES = [
  {
    grade: "Grade 0",
    label: "Normal",
    color: "#22c55e",
    description: "No radiographic features of OA. Normal joint space.",
  },
  {
    grade: "Grade 1",
    label: "Doubtful",
    color: "#84cc16",
    description: "Possible osteophytic lipping, doubtful joint space narrowing.",
  },
  {
    grade: "Grade 2",
    label: "Mild",
    color: "#eab308",
    description: "Definite osteophytes, possible narrowing of joint space.",
  },
  {
    grade: "Grade 3",
    label: "Moderate",
    color: "#f97316",
    description: "Multiple osteophytes, definite narrowing, some sclerosis.",
  },
  {
    grade: "Grade 4",
    label: "Severe",
    color: "#ef4444",
    description: "Large osteophytes, marked narrowing, severe sclerosis, deformity.",
  },
];

function parseStructuredResponse(content: string): ParsedResponse | null {
  const summaryMatch = content.match(/\*\*Summary\*\*\s*([\s\S]*?)(?=\*\*Key Points\*\*|\*\*Clinical Note\*\*|\*\*Sources\*\*|$)/);
  const keyPointsMatch = content.match(/\*\*Key Points\*\*\s*([\s\S]*?)(?=\*\*Clinical Note\*\*|\*\*Sources\*\*|$)/);
  const clinicalNoteMatch = content.match(/\*\*Clinical Note\*\*\s*([\s\S]*?)(?=\*\*Sources\*\*|$)/);
  const sourcesMatch = content.match(/\*\*Sources\*\*\s*([\s\S]*?)$/);

  if (!summaryMatch && !keyPointsMatch) return null;

  const summary = (summaryMatch?.[1]?.trim() || "").replace(/\*\*/g, "");

  const keyPointsRaw = keyPointsMatch?.[1]?.trim() || "";
  const keyPoints = keyPointsRaw
  .split("\n")
  .map((l) => l.replace(/^[-*]\s*/, "").replace(/\*\*/g, "").trim())
  .filter(Boolean);

  const clinicalNote = (clinicalNoteMatch?.[1]?.trim() || "").replace(/\*\*/g, "");

  const sourcesRaw = sourcesMatch?.[1]?.trim() || "";
  const sources: ParsedSource[] = sourcesRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const urlMatch = line.match(/https?:\/\/[^\s]+/);
      const url = urlMatch?.[0] || "";
      const label = line
        .replace(/^\[\d+\]\s*/, "")
        .replace(url, "")
        .replace(/-\s*$/, "")
        .trim();
      return { label, url };
    })
    .filter((s) => s.url);

  return { summary, keyPoints, clinicalNote, sources };
}

function StructuredMessage({ content }: { content: string }) {
  const parsed = parseStructuredResponse(content);

  if (!parsed) {
    return <p className="kv-research-message-content">{content}</p>;
  }

  return (
    <div className="kv-research-structured">
      {parsed.summary && (
        <div className="kv-research-structured-section">
          <span className="kv-research-structured-label">Summary</span>
          <p>{parsed.summary}</p>
        </div>
      )}

      {parsed.keyPoints.length > 0 && (
        <div className="kv-research-structured-section">
          <span className="kv-research-structured-label">Key Points</span>
          <ul className="kv-research-key-points">
            {parsed.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {parsed.clinicalNote && (
        <div className="kv-research-structured-section kv-research-clinical-note">
          <span className="kv-research-structured-label">Clinical Note</span>
          <p>{parsed.clinicalNote}</p>
        </div>
      )}

      {parsed.sources.length > 0 && (
        <div className="kv-research-structured-section kv-research-sources">
          <span className="kv-research-structured-label">Sources</span>
          <ul className="kv-research-source-list">
            {parsed.sources.map((source, i) => (
              <li key={i}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="kv-research-source-link"
                >
                  {source.label || source.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ResearchPage({
  onLogout,
  onGoToDashboard,
  onGoToUpload,
  onGoToHistory,
  onGoToQuiz,
  onSearchCase,
  userGrade,
}: ResearchPageProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showGradePanel, setShowGradePanel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadSessions = async () => {
    try {
      setSessionsLoading(true);
      const res = await fetch(`${BACKEND}/api/v1/research/sessions`, {
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed to load sessions");
      const data: Session[] = await res.json();
      setSessions(data);
    } catch {
      setError("Could not load saved sessions.");
    } finally {
      setSessionsLoading(false);
    }
  };

  const saveSession = async (sid: string, msgs: Message[]) => {
    try {
      await fetch(`${BACKEND}/api/v1/research/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          sessionId: sid,
          messages: msgs,
          title: deriveTitle(msgs),
        }),
      });
      await loadSessions();
    } catch {
      // non-blocking
    }
  };

  const deleteSession = async (sid: string) => {
    try {
      await fetch(`${BACKEND}/api/v1/research/session/${sid}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (activeSessionId === sid) {
        setActiveSessionId(null);
        setMessages([]);
      }
      await loadSessions();
    } catch {
      setError("Failed to delete session.");
    }
  };

  const openSession = (session: Session) => {
    setActiveSessionId(session.sessionId);
    setMessages(session.messages);
    setError("");
  };

  const startNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
    setError("");
  };

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    setError("");
    const updated: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND}/api/v1/research/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ messages: updated, userGrade: userGrade || null }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Chat request failed.");
      }

      const data = await res.json();
      const withReply: Message[] = [
        ...updated,
        { role: "assistant", content: data.reply },
      ];

      setMessages(withReply);

      const sid = activeSessionId || generateSessionId();
      if (!activeSessionId) setActiveSessionId(sid);

      await saveSession(sid, withReply);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <AppShell
      currentPage="research"
      title="AI Research Workspace"
      subtitle="Explore osteoarthritis research with cited sources from trusted medical databases."
      onGoToDashboard={onGoToDashboard}
      onGoToUpload={onGoToUpload}
      onGoToHistory={onGoToHistory}
      onGoToQuiz={onGoToQuiz}
      onLogout={onLogout}
      onSearchCase={onSearchCase}
    >
      <div className="kv-research-layout">
        <aside className="kv-research-sidebar">
          <div className="kv-research-sidebar-header">
            <span>Sessions</span>
            <button type="button" className="kv-research-new-btn" onClick={startNewSession}>
              + New
            </button>
          </div>

          {sessionsLoading ? (
            <p className="kv-research-sidebar-empty">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="kv-research-sidebar-empty">No saved sessions yet.</p>
          ) : (
            <ul className="kv-research-session-list">
              {sessions.map((session) => (
                <li
                  key={session.sessionId}
                  className={`kv-research-session-item ${
                    activeSessionId === session.sessionId
                      ? "kv-research-session-item--active"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    className="kv-research-session-title"
                    onClick={() => openSession(session)}
                  >
                    {session.title}
                  </button>
                  <button
                    type="button"
                    className="kv-research-session-delete"
                    onClick={() => deleteSession(session.sessionId)}
                    title="Delete session"
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="kv-research-main">
          <div className="kv-research-messages">
            {messages.length === 0 ? (
              <div className="kv-research-empty">
                <h3>Start a research session</h3>
                <p>
                  Each answer includes a summary, key clinical points, and
                  cited sources from Mayo Clinic, NIH, PubMed, and the
                  Arthritis Foundation.
                </p>

                {userGrade && (
                  <p className="kv-research-grade-context">
                    Personalized to your scan: <strong>{userGrade}</strong>
                  </p>
                )}

                <div className="kv-research-topic-grid">
                  {TOPIC_CARDS.map((topic) => (
                    <button
                      key={topic.title}
                      type="button"
                      className="kv-research-topic-card"
                      onClick={() => sendMessage(topic.prompt)}
                    >
                      <strong>{topic.title}</strong>
                      <span>{topic.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`kv-research-message kv-research-message--${msg.role}`}
                >
                  <span className="kv-research-message-label">
                    {msg.role === "user" ? "You" : "Research Assistant"}
                  </span>
                  {msg.role === "assistant" ? (
                    <StructuredMessage content={msg.content} />
                  ) : (
                    <p className="kv-research-message-content">{msg.content}</p>
                  )}
                </div>
              ))
            )}

            {loading && (
              <div className="kv-research-message kv-research-message--assistant">
                <span className="kv-research-message-label">Research Assistant</span>
                <p className="kv-research-message-content kv-research-thinking">
                  Searching sources...
                </p>
              </div>
            )}

            {error && <p className="kv-error-message">{error}</p>}

            <div ref={bottomRef} />
          </div>

          <div className="kv-research-input-row">
            <button
              type="button"
              className={`kv-research-grade-toggle ${showGradePanel ? "kv-research-grade-toggle--active" : ""}`}
              onClick={() => setShowGradePanel((v) => !v)}
            >
              KL Grade Reference
            </button>
          </div>

          {showGradePanel && (
            <div className="kv-research-grade-panel">
              <div className="kv-research-grade-panel-header">
                <strong>Kellgren-Lawrence Grade Reference</strong>
                <button type="button" onClick={() => setShowGradePanel(false)}>x</button>
              </div>
              <div className="kv-research-grade-list">
                {KL_GRADES.map((g) => (
                  <div key={g.grade} className="kv-research-grade-row">
                    <div className="kv-research-grade-dot" style={{ background: g.color }} />
                    <div>
                      <strong>{g.grade} — {g.label}</strong>
                      <p>{g.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="kv-research-input-area">
            <textarea
              className="kv-research-textarea"
              placeholder="Ask about OA grading, treatments, imaging features... (Enter to send, Shift+Enter for new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={3}
            />
            <button
              type="button"
              className="kv-research-send-btn"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default ResearchPage;
