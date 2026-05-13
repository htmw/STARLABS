import { useEffect, useState, type FormEvent, type ReactNode } from "react";

type AppPage =
    | "dashboard"
    | "upload"
    | "history"
    | "results"
    | "quiz"
    | "profile"
    | "settings"
    | "research";

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
    onGoToProfile?: () => void;
    onGoToSettings?: () => void;
    onLogout: () => void;
    onSearchCase?: (query: string) => Promise<SearchResult>;
    onGoToResearch?: () => void;
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

function getStoredCollapsedState(key: string, fallback = false) {
    try {
        const stored = localStorage.getItem(key);
        if (stored === null) return fallback;
        return stored === "true";
    } catch {
        return fallback;
    }
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
    onGoToProfile,
    onGoToSettings,
    onLogout,
    onSearchCase,
    onGoToResearch,
}: AppShellProps) {
    const userLabel = getUserLabel();

    const [searchText, setSearchText] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchNotice, setSearchNotice] = useState("");
    const [searchNoticeType, setSearchNoticeType] = useState<"success" | "error">(
        "error",
    );

    const [workspaceCollapsed, setWorkspaceCollapsed] = useState(() =>
        getStoredCollapsedState("kv-sidebar-workspace-collapsed", false),
    );
    const [accountCollapsed, setAccountCollapsed] = useState(() =>
        getStoredCollapsedState("kv-sidebar-account-collapsed", false),
    );

    const [avatarPhoto, setAvatarPhoto] = useState<string | null>(() =>
        localStorage.getItem("kv-profile-photo"),
    );

    useEffect(() => {
        const handleProfileUpdated = () => {
            setAvatarPhoto(localStorage.getItem("kv-profile-photo"));
        };
        window.addEventListener("kv:profile-updated", handleProfileUpdated);
        return () => {
            window.removeEventListener("kv:profile-updated", handleProfileUpdated);
        };
    }, []);

    const goToSettings =
        onGoToSettings ||
        (() => {
            window.dispatchEvent(
                new CustomEvent("kv:navigate", {
                    detail: { view: "settings" },
                }),
            );
        });

    const goToProfile =
        onGoToProfile ||
        (() => {
            window.dispatchEvent(
                new CustomEvent("kv:navigate", {
                    detail: { view: "profile" },
                }),
            );
        });

    const workspaceNavItems = [
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

    const accountNavItems = [
        {
            key: "profile" as const,
            label: "Profile",
            icon: "U",
            onClick: goToProfile,
        },
        {
            key: "settings" as const,
            label: "Settings",
            icon: "⚙",
            onClick: goToSettings,
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

    const toggleWorkspaceGroup = () => {
        setWorkspaceCollapsed((current) => {
            const next = !current;
            localStorage.setItem("kv-sidebar-workspace-collapsed", String(next));
            return next;
        });
    };

    const toggleAccountGroup = () => {
        setAccountCollapsed((current) => {
            const next = !current;
            localStorage.setItem("kv-sidebar-account-collapsed", String(next));
            return next;
        });
    };

    const renderNavItem = (item: {
        key: AppPage;
        label: string;
        icon: string;
        onClick?: () => void;
    }) => {
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
                title={isDisabled ? "Coming soon" : item.label}
            >
                <span className="kv-sidebar-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
            </button>
        );
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
                        <div className="kv-sidebar-nav-group">
                            <button
                                type="button"
                                className="kv-sidebar-group-toggle"
                                onClick={toggleWorkspaceGroup}
                                aria-expanded={!workspaceCollapsed}
                            >
                                <span>Workspace</span>
                                <span className="kv-sidebar-group-arrow">
                                    {workspaceCollapsed ? "›" : "⌄"}
                                </span>
                            </button>

                            <div
                                className={`kv-sidebar-group-items ${workspaceCollapsed
                                        ? "kv-sidebar-group-items--collapsed"
                                        : ""
                                    }`}
                            >
                                {workspaceNavItems.map(renderNavItem)}
                            </div>
                        </div>

                        <div className="kv-sidebar-nav-group">
                            <button
                                type="button"
                                className="kv-sidebar-group-toggle"
                                onClick={toggleAccountGroup}
                                aria-expanded={!accountCollapsed}
                            >
                                <span>Account</span>
                                <span className="kv-sidebar-group-arrow">
                                    {accountCollapsed ? "›" : "⌄"}
                                </span>
                            </button>

                            <div
                                className={`kv-sidebar-group-items ${accountCollapsed ? "kv-sidebar-group-items--collapsed" : ""
                                    }`}
                            >
                                {accountNavItems.map(renderNavItem)}
                            </div>
                        </div>
                    </nav>
                </div>

                <div className="kv-sidebar-bottom">
                    <div className="kv-user-card">
                        <div className="kv-user-avatar">
                            {avatarPhoto ? (
                                <img src={avatarPhoto} alt="Profile" />
                            ) : (
                                getInitial(userLabel)
                            )}
                        </div>

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

                        <button
    type="button"
    className="kv-topbar-pill kv-topbar-pill--clickable"
    onClick={onGoToResearch}
>
    AI Research Workspace
</button>
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