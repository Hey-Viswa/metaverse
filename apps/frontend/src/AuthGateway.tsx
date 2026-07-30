import { useState } from "react";

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f1a",
    minHeight: "100vh",
    width: "100vw",
    color: "white",
    fontFamily: "sans-serif",
  },
  title: {
    fontSize: "3rem",
    letterSpacing: "4px",
    color: "#00f0ff",
    marginBottom: "40px",
    textShadow: "0 0 20px rgba(0, 240, 255, 0.5)",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
    width: "300px",
    backgroundColor: "#1a1a2e",
    padding: "40px",
    borderRadius: "16px",
    border: "1px solid #16213e",
    boxShadow: "0 0 40px rgba(0,0,0,0.5)",
  },
  input: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#0f0f1a",
    color: "white",
    outline: "none",
  },
};

export function AuthGateway({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3000/api/v1/user/${mode}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      if (mode === "signup") {
        setMode("signin");
        setError("User created! Please enter the Matrix.");
      } else {
        onLogin(data.token);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>THE GATEWAY</h1>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />

        {error && (
          <p
            style={{
              color: error.includes("created") ? "#4ade80" : "#f87171",
              margin: 0,
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#00f0ff",
            color: "#0f0f1a",
            fontWeight: "bold",
            cursor: "pointer",
            marginTop: "10px",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? "INITIALIZING..."
            : mode === "signin"
              ? "ENTER MATRIX"
              : "REGISTER"}
        </button>

        <p
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          style={{
            textAlign: "center",
            margin: 0,
            fontSize: "12px",
            color: "#6b7280",
            cursor: "pointer",
          }}
        >
          {mode === "signin"
            ? "No account? Initialize one."
            : "Already registered? Enter Matrix."}
        </p>
      </form>
    </div>
  );
}
