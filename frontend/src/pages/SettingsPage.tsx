import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";

type ThemeMode = "light" | "dark";

type SettingsPageProps = {
    onLogout: () => void;
    onGoToDashboard: () => void;
    onGoToUpload: () => void;
    onGoToHistory: () => void;
    onGoToQuiz: () => void;
    onGoToResearch?: () => void;
    onSearchCase: (query: string) => Promise<{ ok: boolean; message?: string }>;
};

function readStoredBoolean(key: string, fallback: boolean) {
    const stored = localStorage.getItem(key);

    if (stored === null) return fallback;

    return stored === "true";
}

function readStoredTheme(): ThemeMode {
    const stored = localStorage.getItem("kv-theme");

    if (stored === "dark" || stored === "light") {
        return stored;
    }

    return "light";
}

function SettingsPage({
    onLogout,
    onGoToDashboard,
    onGoToUpload,
    onGoToHistory,
    onGoToQuiz,
    onGoToResearch,
    onSearchCase,
}: SettingsPageProps) {
    const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());
    const [showTips, setShowTips] = useState(() =>
        readStoredBoolean("kv-show-educational-tips", true),
    );
    const [compactLayout, setCompactLayout] = useState(() =>
        readStoredBoolean("kv-compact-layout", false),
    );
    const [rememberLastPage, setRememberLastPage] = useState(() =>
        readStoredBoolean("kv-remember-last-page", false),
    );
    const [savedNotice, setSavedNotice] = useState("");

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("kv-theme", theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem("kv-show-educational-tips", String(showTips));
    }, [showTips]);

    useEffect(() => {
        localStorage.setItem("kv-compact-layout", String(compactLayout));

        if (compactLayout) {
            document.documentElement.classList.add("kv-compact-mode");
        } else {
            document.documentElement.classList.remove("kv-compact-mode");
        }
    }, [compactLayout]);

    useEffect(() => {
        localStorage.setItem("kv-remember-last-page", String(rememberLastPage));
    }, [rememberLastPage]);

    const showSavedNotice = (message: string) => {
        setSavedNotice(message);

        window.setTimeout(() => {
            setSavedNotice("");
        }, 2200);
    };

    const handleThemeChange = (nextTheme: ThemeMode) => {
        setTheme(nextTheme);
        showSavedNotice("Appearance preference saved.");
    };

    const handleResetPreferences = () => {
        localStorage.removeItem("kv-theme");
        localStorage.removeItem("kv-show-educational-tips");
        localStorage.removeItem("kv-compact-layout");
        localStorage.removeItem("kv-remember-last-page");

        document.documentElement.setAttribute("data-theme", "light");
        document.documentElement.classList.remove("kv-compact-mode");

        setTheme("light");
        setShowTips(true);
        setCompactLayout(false);
        setRememberLastPage(false);

        showSavedNotice("Local preferences reset.");
    };

    return (
        <AppShell
            currentPage="settings"
            title="Settings"
            subtitle="Adjust local display preferences for your KneeVision workspace."
            onGoToDashboard={onGoToDashboard}
            onGoToUpload={onGoToUpload}
            onGoToHistory={onGoToHistory}
            onGoToQuiz={onGoToQuiz}
            onGoToResearch={onGoToResearch}
            onLogout={onLogout}
            onSearchCase={onSearchCase}
        >
            <section className="kv-settings-grid">
                <div className="kv-panel kv-settings-panel">
                    <div className="kv-panel-header">
                        <div>
                            <h3>Appearance</h3>
                            <p>Choose how the workspace should look on this device.</p>
                        </div>
                    </div>

                    <div className="kv-theme-choice-grid">
                        <button
                            type="button"
                            className={`kv-theme-choice ${theme === "light" ? "kv-theme-choice--active" : ""
                                }`}
                            onClick={() => handleThemeChange("light")}
                        >
                            <span className="kv-theme-preview kv-theme-preview--light">
                                <span />
                                <span />
                                <span />
                            </span>

                            <strong>Light Mode</strong>
                            <small>Clean blue medical workspace</small>
                        </button>

                        <button
                            type="button"
                            className={`kv-theme-choice ${theme === "dark" ? "kv-theme-choice--active" : ""
                                }`}
                            onClick={() => handleThemeChange("dark")}
                        >
                            <span className="kv-theme-preview kv-theme-preview--dark">
                                <span />
                                <span />
                                <span />
                            </span>

                            <strong>Dark Mode</strong>
                            <small>Low-light review interface</small>
                        </button>
                    </div>
                </div>

                <div className="kv-panel kv-settings-panel">
                    <div className="kv-panel-header">
                        <div>
                            <h3>Interface Preferences</h3>
                            <p>These preferences are saved locally in this browser.</p>
                        </div>
                    </div>

                    <div className="kv-settings-list">
                        <label className="kv-settings-row">
                            <div>
                                <strong>Educational Tips</strong>
                                <span>Show short explanations for medical and AI terms.</span>
                            </div>

                            <input
                                type="checkbox"
                                checked={showTips}
                                onChange={(e) => {
                                    setShowTips(e.target.checked);
                                    window.dispatchEvent(new Event("kv:settings-updated"));
                                    showSavedNotice("Tooltip preference saved.");
                                }}
                            />
                        </label>

                        <label className="kv-settings-row">
                            <div>
                                <strong>Compact Layout</strong>
                                <span>Reduce spacing slightly for smaller screens.</span>
                            </div>

                            <input
                                type="checkbox"
                                checked={compactLayout}
                                onChange={(e) => {
                                    setCompactLayout(e.target.checked);
                                    showSavedNotice("Layout preference saved.");
                                }}
                            />
                        </label>

                        <label className="kv-settings-row">
                            <div>
                                <strong>Remember Last Page</strong>
                                <span>Keep this as a local preference for future navigation.</span>
                            </div>

                            <input
                                type="checkbox"
                                checked={rememberLastPage}
                                onChange={(e) => {
                                    setRememberLastPage(e.target.checked);
                                    showSavedNotice("Navigation preference saved.");
                                }}
                            />
                        </label>
                    </div>
                </div>

                <div className="kv-panel kv-settings-panel">
                    <div className="kv-panel-header">
                        <div>
                            <h3>Language</h3>
                            <p>Language support can be expanded in a future version.</p>
                        </div>
                    </div>

                    <div className="kv-language-card">
                        <div>
                            <strong>Current Language</strong>
                            <span>English</span>
                        </div>

                        <span className="kv-coming-soon-pill">More coming soon</span>
                    </div>
                </div>

                <div className="kv-panel kv-settings-panel">
                    <div className="kv-panel-header">
                        <div>
                            <h3>System Info</h3>
                            <p>Basic deployment information for this project build.</p>
                        </div>
                    </div>

                    <div className="kv-system-info-grid">
                        <div>
                            <span>Version</span>
                            <strong>v1.0.0</strong>
                        </div>

                        <div>
                            <span>Frontend</span>
                            <strong>Vercel</strong>
                        </div>

                        <div>
                            <span>Backend</span>
                            <strong>Render</strong>
                        </div>

                        <div>
                            <span>ML Service</span>
                            <strong>Hugging Face</strong>
                        </div>
                    </div>
                </div>

                <div className="kv-panel kv-settings-panel kv-settings-reset-panel">
                    <div>
                        <h3>Reset Local Preferences</h3>
                        <p>
                            Reset appearance and interface preferences stored in this browser.
                            This will not affect your account or saved analysis history.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="kv-settings-reset-button"
                        onClick={handleResetPreferences}
                    >
                        Reset Preferences
                    </button>
                </div>
            </section>

            {savedNotice ? (
                <div className="kv-settings-toast" role="status">
                    {savedNotice}
                </div>
            ) : null}
        </AppShell>
    );
}

export default SettingsPage;