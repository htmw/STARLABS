import { useState } from "react";
import API_BASE_URL from "../config";

const BACKEND = API_BASE_URL;

type RegisterResponse = {
  user?: { id?: string; email?: string; };
  message?: string;
};

type RegisterFormProps = {
  onRegistrationSuccess: () => void;
};

function RegisterForm({ onRegistrationSuccess }: RegisterFormProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) { setError("Email is required."); return; }
    if (!username.trim()) { setError("Username is required."); return; }
    if (username.trim().length < 2) { setError("Username must be at least 2 characters."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    try {
      setLoading(true);
      const response = await fetch(`${BACKEND}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          username: username.trim(),
          password,
        }),
      });

      const data: RegisterResponse = await response.json();
      if (!response.ok) throw new Error(data.message || "Registration failed.");

      setSuccess("Registration successful. Redirecting to login...");
      setEmail(""); setUsername(""); setPassword(""); setConfirmPassword("");
      setTimeout(() => onRegistrationSuccess(), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label htmlFor="username">Username</label>
      <input
        id="username"
        type="text"
        placeholder="Choose a username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <label htmlFor="confirmPassword">Confirm Password</label>
      <input
        id="confirmPassword"
        type="password"
        placeholder="Confirm your password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      {error && <p className="auth-message error">{error}</p>}
      {success && <p className="auth-message success">{success}</p>}

      <button type="submit" disabled={loading}>
        {loading ? "Creating Account..." : "Register"}
      </button>
    </form>
  );
}

export default RegisterForm;