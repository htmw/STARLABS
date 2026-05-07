import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import AppShell from "../components/AppShell";

type ProfilePageProps = {
    onLogout: () => void;
    onGoToDashboard: () => void;
    onGoToUpload: () => void;
    onGoToHistory: () => void;
    onGoToQuiz: () => void;
    onSearchCase: (query: string) => Promise<{ ok: boolean; message?: string }>;
};

function getUserData() {
    try {
        const raw = localStorage.getItem("user");
        if (!raw) return { email: "", username: "" };
        const user = JSON.parse(raw);
        return {
            email: user.email || "",
            username: user.name || user.username || "",
        };
    } catch {
        return { email: "", username: "" };
    }
}

function getLastLogin(): string {
    const raw = localStorage.getItem("kv-last-login");
    if (!raw) return "Not available";
    const date = new Date(raw);
    if (isNaN(date.getTime())) return "Not available";
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function ProfilePage({
    onLogout,
    onGoToDashboard,
    onGoToUpload,
    onGoToHistory,
    onGoToQuiz,
    onSearchCase,
}: ProfilePageProps) {
    const userData = getUserData();

    // Account info
    const [username, setUsername] = useState(userData.username);
    const [newUsername, setNewUsername] = useState("");
    const [usernameError, setUsernameError] = useState("");

    // Photo
    const [photoSrc, setPhotoSrc] = useState<string | null>(() =>
        localStorage.getItem("kv-profile-photo"),
    );
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Password
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");

    // Toast
    const [toast, setToast] = useState("");
    const [toastType, setToastType] = useState<"success" | "error">("success");

    // Delete modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");

    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast(message);
        setToastType(type);
        window.setTimeout(() => setToast(""), 2200);
    };

    const openDeleteModal = () => {
        setDeleteConfirmText("");
        setShowDeleteModal(true);
    };

    const closeDeleteModal = () => {
        setDeleteConfirmText("");
        setShowDeleteModal(false);
    };

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleUsernameSubmit = (e: FormEvent) => {
        e.preventDefault();
        const trimmed = newUsername.trim();

        if (!trimmed) {
            setUsernameError("Username cannot be empty.");
            return;
        }
        if (trimmed.length < 2) {
            setUsernameError("Username must be at least 2 characters.");
            return;
        }

        setUsernameError("");

        // TODO: POST /api/v1/users/username when backend endpoint exists
        try {
            const raw = localStorage.getItem("user");
            const user = raw ? JSON.parse(raw) : {};
            user.name = trimmed;
            localStorage.setItem("user", JSON.stringify(user));
        } catch {
            // ignore storage errors
        }

        setUsername(trimmed);
        setNewUsername("");
        showToast("Username updated.");
    };

    const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            // TODO: POST /api/v1/users/photo when backend endpoint exists
            localStorage.setItem("kv-profile-photo", dataUrl);
            setPhotoSrc(dataUrl);
            window.dispatchEvent(new Event("kv:profile-updated"));
            showToast("Profile photo updated.");
        };
        reader.readAsDataURL(file);

        // Reset so the same file can be re-selected
        e.target.value = "";
    };

    const handleRemovePhoto = () => {
        localStorage.removeItem("kv-profile-photo");
        setPhotoSrc(null);
        window.dispatchEvent(new Event("kv:profile-updated"));
        showToast("Profile photo removed.");
    };

    const handlePasswordSubmit = (e: FormEvent) => {
        e.preventDefault();
        setPasswordError("");

        if (!currentPassword) {
            setPasswordError("Please enter your current password.");
            return;
        }
        if (newPassword.length < 8) {
            setPasswordError("New password must be at least 8 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("New passwords do not match.");
            return;
        }

        // TODO: POST /api/v1/users/password when backend endpoint exists
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        showToast("Password updated. (Backend integration pending.)");
    };

    const handleDeleteAccount = () => {
        // TODO: DELETE /api/v1/users/account when backend endpoint exists
        // Safe placeholder: clear local state and log out
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("kv-profile-photo");
        onLogout();
    };

    // Derive avatar initial: username → email → "U"
    const initial = (username || userData.email || "U").trim().charAt(0).toUpperCase();

    return (
        <AppShell
            currentPage="profile"
            title="Profile"
            subtitle="Manage your KneeVision account details and security."
            onGoToDashboard={onGoToDashboard}
            onGoToUpload={onGoToUpload}
            onGoToHistory={onGoToHistory}
            onGoToQuiz={onGoToQuiz}
            onLogout={onLogout}
            onSearchCase={onSearchCase}
        >
            <section className="kv-settings-grid">

                {/* Account Information */}
                <div className="kv-panel kv-settings-panel">
                    <div className="kv-panel-header">
                        <div>
                            <h3>Account Information</h3>
                            <p>Your email address and display name on this device.</p>
                        </div>
                    </div>

                    <div className="kv-settings-list">
                        <div className="kv-settings-row">
                            <div>
                                <strong>Email</strong>
                                <span>{userData.email || "No email on file"}</span>
                            </div>
                        </div>
                        <div className="kv-settings-row">
                            <div>
                                <strong>Username</strong>
                                <span>
                                    {username || "Not set yet — choose a display name"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <form className="kv-profile-form" onSubmit={handleUsernameSubmit}>
                        <div className="kv-profile-form-field">
                            <label htmlFor="kv-new-username">Change Username</label>
                            <input
                                id="kv-new-username"
                                type="text"
                                placeholder="New username"
                                value={newUsername}
                                onChange={(e) => {
                                    setNewUsername(e.target.value);
                                    setUsernameError("");
                                }}
                                autoComplete="off"
                            />
                            {usernameError ? (
                                <span className="kv-profile-field-error">{usernameError}</span>
                            ) : null}
                        </div>
                        <button type="submit" className="kv-profile-submit-btn">
                            Save Username
                        </button>
                    </form>
                </div>

                {/* Profile Photo */}
                <div className="kv-panel kv-settings-panel">
                    <div className="kv-panel-header">
                        <div>
                            <h3>Profile Photo</h3>
                            <p>Shown in the sidebar. Stored locally in your browser.</p>
                        </div>
                    </div>

                    <div className="kv-profile-photo-section">
                        <div className="kv-profile-avatar-lg">
                            {photoSrc ? (
                                <img src={photoSrc} alt="Profile" />
                            ) : (
                                initial
                            )}
                        </div>

                        <div className="kv-profile-photo-actions">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={handlePhotoChange}
                            />
                            <button
                                type="button"
                                className="kv-profile-submit-btn"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Upload Photo
                            </button>
                            {photoSrc ? (
                                <button
                                    type="button"
                                    className="kv-profile-remove-btn"
                                    onClick={handleRemovePhoto}
                                >
                                    Remove Photo
                                </button>
                            ) : null}
                        </div>

                        <p className="kv-profile-photo-hint">
                            JPG or PNG recommended. Stored locally for this MVP.
                        </p>
                    </div>
                </div>

                {/* Security */}
                <div className="kv-panel kv-settings-panel">
                    <div className="kv-panel-header">
                        <div>
                            <h3>Security</h3>
                            <p>Update your account password.</p>
                        </div>
                    </div>

                    <form className="kv-profile-form" onSubmit={handlePasswordSubmit}>
                        <div className="kv-profile-form-field">
                            <label htmlFor="kv-current-password">Current Password</label>
                            <input
                                id="kv-current-password"
                                type="password"
                                placeholder="Current password"
                                value={currentPassword}
                                onChange={(e) => {
                                    setCurrentPassword(e.target.value);
                                    setPasswordError("");
                                }}
                                autoComplete="current-password"
                            />
                        </div>
                        <div className="kv-profile-form-field">
                            <label htmlFor="kv-new-password">New Password</label>
                            <input
                                id="kv-new-password"
                                type="password"
                                placeholder="At least 8 characters"
                                value={newPassword}
                                onChange={(e) => {
                                    setNewPassword(e.target.value);
                                    setPasswordError("");
                                }}
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="kv-profile-form-field">
                            <label htmlFor="kv-confirm-password">Confirm New Password</label>
                            <input
                                id="kv-confirm-password"
                                type="password"
                                placeholder="Repeat new password"
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    setPasswordError("");
                                }}
                                autoComplete="new-password"
                            />
                        </div>
                        {passwordError ? (
                            <span className="kv-profile-field-error">{passwordError}</span>
                        ) : null}
                        <button type="submit" className="kv-profile-submit-btn">
                            Change Password
                        </button>
                        {/* TODO: POST /api/v1/users/password when backend endpoint exists */}
                    </form>
                </div>

                {/* Session & Security */}
                <div className="kv-panel kv-settings-panel">
                    <div className="kv-panel-header">
                        <div>
                            <h3>Session &amp; Security</h3>
                            <p>Your current login session details.</p>
                        </div>
                    </div>

                    <div className="kv-settings-list kv-profile-session-list">
                        <div className="kv-settings-row">
                            <div>
                                <strong>Logged In As</strong>
                                <span>{userData.email || "Unknown"}</span>
                            </div>
                        </div>

                        <div className="kv-settings-row">
                            <div>
                                <strong>Session Status</strong>
                                <span className="kv-profile-session-status">
                                    <span className="kv-profile-status-dot" aria-hidden="true" />
                                    Active
                                </span>
                            </div>
                        </div>

                        <div className="kv-settings-row">
                            <div>
                                <strong>Last Login</strong>
                                <span>{getLastLogin()}</span>
                            </div>
                        </div>

                        <div className="kv-settings-row">
                            <div>
                                <strong>Sign Out</strong>
                                <span>End your current session.</span>
                            </div>
                            <button
                                type="button"
                                className="kv-profile-remove-btn"
                                onClick={onLogout}
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="kv-panel kv-settings-panel kv-settings-reset-panel kv-profile-danger-section">
                    <div>
                        <h3>Danger Zone</h3>
                        <p>
                            Permanently delete your account and all associated data.
                            This action cannot be undone.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="kv-settings-reset-button"
                        onClick={openDeleteModal}
                    >
                        Delete Account
                    </button>
                    {/* TODO: DELETE /api/v1/users/account when backend endpoint exists */}
                </div>
            </section>

            {/* Delete account confirmation modal */}
            {showDeleteModal ? (
                <div
                    className="kv-confirm-backdrop"
                    onClick={closeDeleteModal}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="kv-delete-title"
                >
                    <div
                        className="kv-confirm-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="kv-confirm-icon">!</div>
                        <div className="kv-confirm-content">
                            <h3 id="kv-delete-title">Delete Account?</h3>
                            <p>
                                This will permanently remove your KneeVision account and all
                                saved analyses. This action cannot be undone.
                            </p>
                        </div>

                        <div className="kv-profile-delete-confirm">
                            <label htmlFor="kv-delete-input">
                                Type <strong>DELETE</strong> to confirm
                            </label>
                            <input
                                id="kv-delete-input"
                                type="text"
                                placeholder="DELETE"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </div>

                        <div className="kv-confirm-actions">
                            <button
                                type="button"
                                className="kv-confirm-cancel"
                                onClick={closeDeleteModal}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="kv-confirm-delete"
                                disabled={deleteConfirmText.trim().toUpperCase() !== "DELETE"}
                                onClick={handleDeleteAccount}
                            >
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Toast notification */}
            {toast ? (
                <div
                    className={`kv-settings-toast${toastType === "error" ? " kv-settings-toast--error" : ""}`}
                    role="status"
                >
                    {toast}
                </div>
            ) : null}
        </AppShell>
    );
}

export default ProfilePage;
