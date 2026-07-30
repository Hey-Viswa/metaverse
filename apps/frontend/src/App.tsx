import { useState } from "react";
import { AuthGateway } from "./AuthGateway";
import { Arena } from "./Arena";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("metaverse_token"));

  const handleLogin = (jwt: string) => {
    localStorage.setItem("metaverse_token", jwt);
    setToken(jwt);
  };

  const handleLogout = () => {
    localStorage.removeItem("metaverse_token");
    setToken(null);
  };

  if (!token) {
    return <AuthGateway onLogin={handleLogin} />;
  }

  return <Arena token={token} onLogout={handleLogout} />;
}
