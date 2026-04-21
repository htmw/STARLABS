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
};

type ResultsPageProps = {
  result: AnalysisResult;
  onBackToUpload: () => void;
  onBackToDashboard: () => void;
  onGoToHistory: () => void;
  onLogout: () => void;
};

function ResultsPage({
  result,
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

  return (
    <main className="results-page">
      <div className="results-shell">
        {/* Header */}
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

        {/* Summary card */}
        <section className="results-summary-card">
          <div>
            <p className="results-summary-label">Predicted severity</p>
            <h2>{result.grade}</h2>
            <p className="results-summary-band">{result.severityLabel}</p>
          </div>

          <div className="results-summary-metrics">
            <div className="results-metric-chip">
              {result.confidence.toFixed(2)}% confidence
            </div>
            <div className="results-summary-mini">
              <span>Top class</span>
              <strong>{topProbability?.label ?? "-"}</strong>
            </div>
          </div>
        </section>

        {/* Main grid */}
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
              <h3>Grad-CAM Explanation</h3>
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

        {/* Bottom grid */}
        <section className="results-bottom-grid">
          <article className="results-card">
            <div className="results-card-header">
              <h3>Class Probabilities</h3>
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
                <span>Confidence</span>
                <strong>{result.confidence.toFixed(2)}%</strong>
              </div>
              <div className="results-info-box">
                <span>Predicted class</span>
                <strong>{result.grade}</strong>
              </div>
              <div className="results-info-box">
                <span>Severity band</span>
                <strong>{result.severityLabel}</strong>
              </div>
              <div className="results-info-box">
                <span>Explanation</span>
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

        {/* Similar Cases */}
        {result.similarCases && result.similarCases.length > 0 && (
          <section className="results-similar-section">
            <div className="results-card-header">
              <h3>Similar Cases</h3>
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
                    <div className="results-similar-grade">
                      KL Grade {c.klGrade}
                    </div>
                    <div className="results-similar-tags">
                      {c.osteophyteSeverity && (
                        <span className="results-similar-tag">
                          Osteophytes: {c.osteophyteSeverity}
                        </span>
                      )}
                      {c.jointSpaceNarrowing && (
                        <span className="results-similar-tag">
                          JSN: {c.jointSpaceNarrowing}
                        </span>
                      )}
                      {c.subchondralSclerosis && (
                        <span className="results-similar-tag">
                          Sclerosis: {c.subchondralSclerosis}
                        </span>
                      )}
                      {c.boneTexture && (
                        <span className="results-similar-tag">
                          Texture: {c.boneTexture}
                        </span>
                      )}
                      {c.affectedCompartment && (
                        <span className="results-similar-tag">
                          Compartment: {c.affectedCompartment}
                        </span>
                      )}
                    </div>
                    {c.overallFindings && (
                      <p className="results-similar-findings">
                        {c.overallFindings}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default ResultsPage;