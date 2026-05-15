import { useState } from "react";
import API_BASE_URL from "../config";

const BACKEND = API_BASE_URL;

type LoginResponse = {
  token?: string;
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
  message?: string;
};

type LoginFormProps = {
  onLoginSuccess: () => void;
};

function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim()) { setError("Email or username is required."); return; }
    if (!password) { setError("Password is required."); return; }

    try {
      setLoading(true);

      const response = await fetch(`${BACKEND}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim().toLowerCase(),
          password,
        }),
      });

      const data: LoginResponse = await response.json();
      if (!response.ok) throw new Error(data.message || "Login failed.");

      if (data.token) localStorage.setItem("token", data.token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("kv-last-login", new Date().toISOString());

      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label htmlFor="identifier">Email or Username</label>
      <input
        id="identifier"
        type="text"
        placeholder="Enter your email or username"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="auth-message error">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? "Signing In..." : "Login"}
      </button>
    </form>
  );
}

export default LoginForm;