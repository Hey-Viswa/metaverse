import { useEffect, useRef, useState } from "react";

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [connectionStatus, setConnectionStatus] = useState(
    "Connecting to Matrix...",
  );

  // My Coordinates
  const [position, setPosition] = useState({ x: 400, y: 300 });

  // Ghost Coordinates (Other players in the network)
  const [otherPlayers, setOtherPlayers] = useState<
    Record<string, { x: number; y: number }>
  >({});

  const VIP_TOKEN = import.meta.env.VITE_VIP_TOKEN;

  // ENGINE 1: The WebSocket & Keyboard Event Listener
  useEffect(() => {
    if (!VIP_TOKEN) {
      setConnectionStatus("🔴 ERROR: VITE_VIP_TOKEN missing in .env");
      return;
    }

    const ws = new WebSocket(`ws://localhost:8080/?token=${VIP_TOKEN}`);

    ws.onopen = () => {
      setConnectionStatus("🟢 Multi-Node Synchronization Active");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // If the backend blasts a player movement, track it!
      if (data.type === "player_moved") {
        setOtherPlayers((prev) => ({
          ...prev,
          [data.payload.clientId]: { x: data.payload.x, y: data.payload.y },
        }));
      }
    };

    ws.onclose = () => {
      setConnectionStatus("🔴 Disconnected from the Matrix");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      setPosition((prev) => {
        let newX = prev.x;
        let newY = prev.y;
        const SPEED = 20;
        const CANVAS_WIDTH = 800;
        const CANVAS_HEIGHT = 600;
        const AVATAR_SIZE = 40;

        if (e.key === "ArrowUp" || e.key === "w") newY -= SPEED;
        if (e.key === "ArrowDown" || e.key === "s") newY += SPEED;
        if (e.key === "ArrowLeft" || e.key === "a") newX -= SPEED;
        if (e.key === "ArrowRight" || e.key === "d") newX += SPEED;

        // Matrix Boundary Collision Logic
        newX = Math.max(0, Math.min(newX, CANVAS_WIDTH - AVATAR_SIZE));
        newY = Math.max(0, Math.min(newY, CANVAS_HEIGHT - AVATAR_SIZE));

        // Broadcast MY new coordinates to the WS Server
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({ type: "move", payload: { x: newX, y: newY } }),
          );
        }

        return { x: newX, y: newY };
      });
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      ws.close();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [VIP_TOKEN]);

  // ENGINE 2: The Canvas Renderer (Triggers instantly when ANY position changes)
  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        // Draw dark grid
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, 800, 600);

        // Draw MY glowing avatar (RED)
        ctx.fillStyle = "#e94560";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#e94560";
        ctx.fillRect(position.x, position.y, 40, 40);

        // Draw ENEMY/GHOST avatars (CYAN)
        ctx.fillStyle = "#00f0ff";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#00f0ff";

        Object.values(otherPlayers).forEach((ghost) => {
          ctx.fillRect(ghost.x, ghost.y, 40, 40);
        });
      }
    }
  }, [position, otherPlayers]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f0f1a",
        minHeight: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <h1
        style={{
          margin: "20px 0",
          fontSize: "2rem",
          letterSpacing: "2px",
          color: "#00f0ff",
        }}
      >
        METAVERSE MULTIPLAYER
      </h1>

      <h3
        style={{
          color: connectionStatus.includes("🟢") ? "#4ade80" : "#f87171",
          marginBottom: "20px",
        }}
      >
        {connectionStatus}
      </h3>

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{
          border: "2px solid #00f0ff",
          borderRadius: "12px",
          boxShadow: "0 0 40px rgba(0,240,255,0.2)",
        }}
      />
    </div>
  );
}

export default App;
