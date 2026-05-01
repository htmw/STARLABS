import { useState, type FormEvent, type ReactNode } from "react";

type AppPage = "dashboard" | "upload" | "history" | "results" | "quiz";

type SearchResult = {
    ok: boolean;
    message?: string;
};

type AppShellProps = {
    currentPage: AppPage;
    title: string;
    subtitle?: string;
    children: ReactNode;
    onGoToDashboard?: () => void;
    onGoToUpload?: () => void;
    onGoToHistory?: () => void;
    onGoToQuiz?: () => void;
    onLogout: () => void;
    onSearchCase?: (query: string) => Promise<SearchResult>;
};

function getUserLabel() {
    try {
        const rawUser = localStorage.getItem("user");
        if (!rawUser) return "Research User";

        const user = JSON.parse(rawUser);
        return user.email || user.name || "Research User";
    } catch {
        return "Research User";
    }
}

function getInitial(label: string) {
    return label.trim().charAt(0).toUpperCase() || "U";
}

function AppShell({
    currentPage,
    title,
    subtitle,
    children,
    onGoToDashboard,
    onGoToUpload,
    onGoToHistory,
    onGoToQuiz,
    onLogout,
    onSearchCase,
}: AppShellProps) {
    const userLabel = getUserLabel();

    const [searchText, setSearchText] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchNotice, setSearchNotice] = useState("");
    const [searchNoticeType, setSearchNoticeType] = useState<"success" | "error">(
        "error",
    );

    const navItems = [
        {
            key: "dashboard" as const,
            label: "Dashboard",
            icon: "⌂",
            onClick: onGoToDashboard,
        },
        {
            key: "upload" as const,
            label: "Upload",
            icon: "＋",
            onClick: onGoToUpload,
        },
        {
            key: "history" as const,
            label: "History",
            icon: "▣",
            onClick: onGoToHistory,
        },
        {
            key: "quiz" as const,
            label: "Quiz",
            icon: "?",
            onClick: onGoToQuiz,
        },
    ];

    const showSearchNotice = (message: string, type: "success" | "error") => {
        setSearchNotice(message);
        setSearchNoticeType(type);

        window.setTimeout(() => {
            setSearchNotice("");
        }, 2600);
    };

    const handleSearchSubmit = async (event: FormEvent) => {
        event.preventDefault();

        const query = searchText.trim();

        if (!query) {
            showSearchNotice("Please enter a case number or file name.", "error");
            return;
        }

        if (!onSearchCase) {
            showSearchNotice("Search is not available on this page.", "error");
            return;
        }

        try {
            setSearching(true);

            const result = await onSearchCase(query);

            if (result.ok) {
                showSearchNotice(result.message || "Case opened.", "success");
                setSearchText("");
            } else {
                showSearchNotice(result.message || "No matching case found.", "error");
            }
        } finally {
            setSearching(false);
        }
    };

    return (
        <main className="kv-app-shell">
            <aside className="kv-sidebar">
                <div className="kv-sidebar-top">
                    <div className="kv-sidebar-brand">
                        <span className="kv-sidebar-logo" />
                        <span>KneeVision</span>
                    </div>

                    <form className="kv-sidebar-search" onSubmit={handleSearchSubmit}>
                        <span>⌕</span>

                        <input
                            type="text"
                            placeholder="Search case number or file"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            disabled={searching}
                        />

                        <button type="submit" disabled={searching}>
                            {searching ? "..." : "Go"}
                        </button>
                    </form>

                    <nav className="kv-sidebar-nav" aria-label="Main navigation">
                        {navItems.map((item) => {
                            const isActive = currentPage === item.key;
                            const isDisabled = !item.onClick && !isActive;

                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    className={`kv-sidebar-nav-item ${isActive ? "kv-sidebar-nav-item--active" : ""
                                        }`}
                                    onClick={item.onClick}
                                    disabled={isDisabled}
                                >
                                    <span className="kv-sidebar-nav-icon">{item.icon}</span>
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="kv-sidebar-bottom">
                    <div className="kv-user-card">
                        <div className="kv-user-avatar">{getInitial(userLabel)}</div>

                        <div className="kv-user-meta">
                            <strong>{userLabel}</strong>
                            <button type="button" onClick={onLogout}>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            <section className="kv-workspace">
                <header className="kv-topbar">
                    <div>
                        <h1>{title}</h1>
                        {subtitle ? <p>{subtitle}</p> : null}
                    </div>

                    <div className="kv-topbar-actions">
                        <span className="kv-topbar-pill">
                            {new Date().toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                            })}
                        </span>

                        <span className="kv-topbar-pill">AI Research Workspace</span>
                    </div>
                </header>

                <div className="kv-workspace-content">{children}</div>
            </section>

            {searchNotice ? (
                <div
                    className={`kv-search-toast kv-search-toast--${searchNoticeType}`}
                    role="status"
                >
                    {searchNotice}
                </div>
            ) : null}
        </main>
    );
}

export default AppShell;