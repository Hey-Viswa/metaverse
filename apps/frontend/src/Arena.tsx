import React, { useEffect, useState, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Box, Instances, Instance, Stars, PointerLockControls } from "@react-three/drei";
import * as THREE from "three";

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f1a",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    position: "relative" as const,
  },
  button: {
    position: "absolute" as const,
    top: "20px",
    right: "20px",
    padding: "8px 16px",
    backgroundColor: "#1a1a2e",
    color: "white",
    border: "1px solid #e94560",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    zIndex: 10,
  },
  title: {
    position: "absolute" as const,
    top: "20px",
    left: "20px",
    margin: "0",
    fontSize: "2rem",
    letterSpacing: "2px",
    color: "#00f0ff",
    textShadow: "0 0 10px rgba(0, 240, 255, 0.5)",
    zIndex: 10,
  },
  status: {
    position: "absolute" as const,
    top: "70px",
    left: "20px",
    zIndex: 10,
    margin: "0",
  }
};

const WALLS = [
  { x: 200, y: 100, width: 400, height: 40 }, // Top horizontal wall
  { x: 200, y: 100, width: 40, height: 300 }, // Left vertical wall
  { x: 600, y: 300, width: 40, height: 200 }, // Right vertical wall
];

const to3D = (cx: number, cy: number, cw = 40, ch = 40) => {
  const centerX = cx + cw / 2;
  const centerY = cy + ch / 2;
  return [
    (centerX - 400) / 10,
    0, 
    (centerY - 300) / 10
  ] as [number, number, number];
};

// Procedural Generation: 5000 Trees spanning 4000 square meters
const CYBER_FOREST = Array.from({ length: 5000 }).map(() => {
  let x = (Math.random() - 0.5) * 4000; // Spans from -2000 to 2000
  let z = (Math.random() - 0.5) * 4000; 
  
  // Hollow out the center spawn area (80x60) so players don't spawn inside trees
  if (Math.abs(x) < 50 && Math.abs(z) < 40) {
    x = x > 0 ? x + 50 : x - 50;
    z = z > 0 ? z + 40 : z - 40;
  }

  return {
    x,
    z,
    height: Math.random() * 40 + 10,
    color: Math.random() > 0.9 ? "#e94560" : (Math.random() > 0.5 ? "#161625" : "#1a1a2e")
  };
});

// 🚀 OPTIMIZATION: Dynamically map 3D visual coordinates back into 2D Physics Space
const FOREST_COLLIDERS = CYBER_FOREST.map(t => ({
  x: t.x * 10 + 380, // Reverse of to3D logic
  y: t.z * 10 + 280,
  width: 40,
  height: 40
}));

const ALL_COLLIDERS = [...WALLS, ...FOREST_COLLIDERS];

// Global allocated vectors to kill GC spikes
const cameraTarget = new THREE.Vector3();
const desiredCameraPos = new THREE.Vector3();

function FPSMonitor({ onStatsUpdate }: { onStatsUpdate: (fps: number, lows: number) => void }) {
  const frames = useRef<number[]>([]);
  const lastUpdate = useRef(Date.now());

  useFrame((state, delta) => {
    // Math.max avoids Infinity during frame drops
    const currentFps = Math.max(0, 1 / (delta || 0.016)); 
    frames.current.push(currentFps);
    if (frames.current.length > 120) frames.current.shift(); // Keep history of last 120 frames (2 seconds)

    const now = Date.now();
    if (now - lastUpdate.current > 500) { // Update React UI twice a second to prevent React bottleneck
      lastUpdate.current = now;
      const sorted = [...frames.current].sort((a, b) => a - b);
      const low1Percent = sorted[Math.floor(sorted.length * 0.01)] || 0;
      const avgFps = frames.current.reduce((a, b) => a + b, 0) / frames.current.length;
      onStatsUpdate(Math.round(avgFps), Math.round(low1Percent));
    }
  });
  return null;
}

// 🚀 OPTIMIZATION: FPS & TPP PointerLock Camera (PUBG/Valorant Style)
function CameraTracker({ localPosRef, isTPP }: { localPosRef: React.MutableRefObject<{x: number, y: number}>, isTPP: boolean }) {
  useFrame((state) => {
    // 1. First, always anchor the camera to the player's exact head coordinates
    const [px, , pz] = to3D(localPosRef.current.x, localPosRef.current.y);
    state.camera.position.set(px, 3, pz);

    // 2. AAA Perspective Switch! If TPP, dynamically pull the camera backwards 
    // along its own local Z-axis. PointerLock handles the pure rotation.
    if (isTPP) {
      state.camera.translateZ(15); // 15 units behind
      state.camera.translateY(4);  // 4 units up (Over the shoulder)
    }
  });

  return <PointerLockControls />;
}

function LocalPlayer({ 
  localPosRef, 
  myMessage, 
  keys, 
  networkStateRef, 
  wsRef 
}: { 
  localPosRef: React.MutableRefObject<{x: number, y: number}>, 
  myMessage: string,
  keys: React.MutableRefObject<{ [key: string]: boolean }>,
  networkStateRef: React.MutableRefObject<Record<string, {x: number, y: number}>>,
  wsRef: React.MutableRefObject<WebSocket | null>
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const lastSend = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // 1. CONTINUOUS PHYSICS ENGINE (Decoupled from OS Keyboard Rate)
    const speed = 250 * delta; // Restore framerate-independent physics!
    let newX = localPosRef.current.x;
    let newY = localPosRef.current.y;
    let moved = false;

    let dx = 0;
    let dy = 0;

    if (keys.current["w"] || keys.current["arrowup"]) dy -= 1;
    if (keys.current["s"] || keys.current["arrowdown"]) dy += 1;
    if (keys.current["a"] || keys.current["arrowleft"]) dx -= 1;
    if (keys.current["d"] || keys.current["arrowright"]) dx += 1;

    if (dx !== 0 || dy !== 0) {
      moved = true;
      // Normalize to prevent faster diagonal movement
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;

      // Extract the exact yaw rotation from the First-Person Camera
      const yaw = state.camera.rotation.y;
      
      // Apply 2D Trigonometry so "W" always moves exactly where you are looking
      const moveX = dx * Math.cos(yaw) + dy * Math.sin(yaw);
      const moveY = -dx * Math.sin(yaw) + dy * Math.cos(yaw);

      newX += moveX * speed;
      newY += moveY * speed;

      // THE OPEN WORLD UNLOCK: We completely removed the Math.min/Math.max clamping!
      // You can now walk infinitely in any direction.

      let collision = false;
      for (let wall of ALL_COLLIDERS) {
        // 🚀 AAA OPTIMIZATION (Spatial Partitioning Fast-Fail)
        // Do not calculate AABB math for trees that are more than 100 units away!
        if (Math.abs(wall.x - newX) > 100 || Math.abs(wall.y - newY) > 100) continue;

        // AABB (Axis-Aligned Bounding Box) Collision Math
        if (
          newX < wall.x + wall.width &&
          newX + 40 > wall.x &&
          newY < wall.y + wall.height &&
          newY + 40 > wall.y
        ) {
          collision = true;
          break;
        }
      }

      // We explicitly cast to any here to avoid TS complaining about Object.values
      const ghosts: any[] = Object.values(networkStateRef.current);
      for (let g of ghosts) {
        if (newX < g.x + 40 && newX + 40 > g.x && newY < g.y + 40 && newY + 40 > g.y) {
          collision = true; break;
        }
      }

      if (!collision) {
        localPosRef.current.x = newX;
        localPosRef.current.y = newY;
        
        // 2. NETWORK THROTTLING (Send state 15 times a second maximum to avoid Server DDOS)
        const now = Date.now();
        if (now - lastSend.current > 66 && wsRef.current?.readyState === WebSocket.OPEN) {
          lastSend.current = now;
          wsRef.current.send(JSON.stringify({ type: "move", payload: { x: newX, y: newY } }));
        }
      }
    }

    // 3. EXACT RENDERING
    const [px, , pz] = to3D(localPosRef.current.x, localPosRef.current.y);
    
    // CRITICAL FIX: The physics engine is already moving continuously via delta. 
    // If we apply a .lerp() on top of continuous physics, it creates a "rubber-banding" jitter!
    // So we just instantly copy the exact physics position to the mesh.
    meshRef.current.position.set(px, 0, pz);
  });

  return (
    <Box ref={meshRef} args={[4, 4, 4]}>
      <meshLambertMaterial color="#e94560" />
      {myMessage && (
         <Text position={[0, 4, 0]} fontSize={2} color="white" anchorY="bottom" outlineWidth={0.1} outlineColor="#000">
           {myMessage}
         </Text>
      )}
    </Box>
  );
}

function GhostAvatar({ id, message, networkStateRef }: { id: string; message?: string; networkStateRef: React.MutableRefObject<Record<string, {x: number, y: number}>> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!meshRef.current || !networkStateRef.current[id]) return;
    const { x, y } = networkStateRef.current[id];
    const [px, , pz] = to3D(x, y);
    targetPos.set(px, 0, pz);
    // Ghosts ONLY receive updates 15 times a sec, so they MUST lerp to appear smooth!
    const lerpFactor = 1 - Math.exp(-10 * delta);
    meshRef.current.position.lerp(targetPos, lerpFactor);
  });

  return (
    <Box ref={meshRef} args={[4, 4, 4]}>
      <meshLambertMaterial color="#00f0ff" />
      {message && (
         <Text position={[0, 4, 0]} fontSize={2} color="white" anchorY="bottom" outlineWidth={0.1} outlineColor="#000">
           {message}
         </Text>
      )}
    </Box>
  );
}

export function Arena({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [status, setStatus] = useState("Connecting to Matrix...");
  
  // React State for low-frequency UI updates (chat messages)
  const [myMessage, setMyMessage] = useState("");
  const [ghostUI, setGhostUI] = useState<Record<string, { message?: string }>>({});
  
  // High-Performance Telemetry State
  const [telemetry, setTelemetry] = useState({ fps: 0, lows: 0, ping: 0 });
  const [isTPP, setIsTPP] = useState(false); // Perspective Toggle State

  // High-Frequency Physics State (Completely bypasses React Renders!)
  const localPosRef = useRef({ x: 400, y: 300 });
  const networkStateRef = useRef<Record<string, { x: number; y: number }>>({});

  const keys = useRef<{ [key: string]: boolean }>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    wsRef.current = new WebSocket(`ws://localhost:8080/?token=${token}`);
    const ws = wsRef.current;

    ws.onopen = () => setStatus("🟢 Multi-Node Synchronization Active");
    ws.onclose = () => setStatus("🔴 Disconnected from the Matrix");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const id = data.payload?.clientId;

      if (data.type === "player_moved") {
        if (!networkStateRef.current[id]) {
          networkStateRef.current[id] = { x: data.payload.x, y: data.payload.y };
          setGhostUI((prev) => ({ ...prev, [id]: {} }));
        } else {
          networkStateRef.current[id].x = data.payload.x;
          networkStateRef.current[id].y = data.payload.y;
        }
      }
      
      if (data.type === "chat_received") {
        setGhostUI((prev) => ({
          ...prev,
          [id]: { ...prev[id], message: data.payload.message },
        }));
      }
      
      if (data.type === "pong") {
        setTelemetry(prev => ({ ...prev, ping: Date.now() - data.payload.time }));
      }
    };

    // Latency Ping Loop
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", payload: { time: Date.now() } }));
      }
    }, 1000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        keys.current = {}; // Fix: Stop moving when opening chat prompt
        const msg = prompt("Broadcast to Matrix:");
        if (msg && msg.trim() !== "") {
          setMyMessage(msg);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "chat", payload: { message: msg } }));
          }
        }
        return;
      }
      
      if (e.key.toLowerCase() === "v") {
        setIsTPP(prev => !prev);
        return;
      }

      keys.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };

    const handleBlur = () => {
      keys.current = {}; // Fix: Stop moving if user Alt+Tabs or clicks away
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    
    return () => {
      clearInterval(pingInterval);
      ws.close();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [token]);

  return (
    <div style={styles.container}>
      <button onClick={onLogout} style={styles.button}>
        Disconnect
      </button>
      <h1 style={styles.title}>METAVERSE 3D ENGINE</h1>
      <h3 style={{ ...styles.status, color: status.includes("🟢") ? "#4ade80" : "#f87171" }}>
        {status}
      </h3>

      {/* FPS & Latency Overlay HUD */}
      <div style={{ position: "absolute", top: "110px", left: "20px", zIndex: 10, background: "rgba(15, 15, 26, 0.8)", padding: "10px", borderRadius: "8px", border: "1px solid #00f0ff", fontFamily: "monospace", color: "#fff" }}>
        <div style={{ color: telemetry.fps > 55 ? "#4ade80" : "#fbbf24" }}>FPS: {telemetry.fps}</div>
        <div style={{ color: telemetry.lows > 30 ? "#4ade80" : "#f87171" }}>1% Lows: {telemetry.lows}</div>
        <div style={{ color: telemetry.ping < 100 ? "#4ade80" : "#f87171" }}>Ping: {telemetry.ping} ms</div>
        <div style={{ marginTop: "10px", color: "#a855f7", fontSize: "12px" }}>Press [V] to toggle FPP/TPP</div>
      </div>

      <Canvas 
        camera={{ position: [0, 25, 30], fov: 50 }} 
        style={{ width: "100%", height: "100%", flex: 1 }}
        dpr={[1, 2]} 
        performance={{ min: 0.5 }}
        gl={{ powerPreference: "high-performance", antialias: false }}
      >
        {/* 🚀 ATMOSPHERE: Fog creates immense depth of field! */}
        <fog attach="fog" args={['#0f0f1a', 50, 400]} />
        <Stars radius={200} depth={50} count={10000} factor={6} saturation={0} fade speed={1} />

        <ambientLight intensity={0.5} />
        {/* Removed castShadow which kills GPUs for no reason on large planes */}
        <directionalLight position={[10, 20, 10]} intensity={1} />
        
        <FPSMonitor onStatsUpdate={(fps, lows) => setTelemetry(prev => ({ ...prev, fps, lows }))} />

        <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10000, 10000]} />
          <meshLambertMaterial color="#05050a" />
        </mesh>
        
        <gridHelper args={[4000, 400, "#e94560", "#1a1a2e"]} position={[0, -1.9, 0]} />

        {/* 🚀 THE CYBER FOREST: 5000 trees in 1 Draw Call! */}
        <Instances limit={CYBER_FOREST.length}>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial color="#ffffff" />
          {CYBER_FOREST.map((t, i) => (
            <Instance key={i} position={[t.x, t.height / 2 - 2, t.z]} scale={[4, t.height, 4]} color={t.color} />
          ))}
        </Instances>

        {/* 🚀 OPTIMIZATION: InstancedMesh reduces infinite walls to 1 Single Draw Call! */}
        <Instances limit={WALLS.length}>
          <boxGeometry args={[1, 8, 1]} />
          <meshLambertMaterial color="#3a3a5e" />
          {WALLS.map((w, i) => {
            const [cx, , cz] = to3D(w.x, w.y, w.width, w.height);
            return (
              <Instance key={i} position={[cx, 2, cz]} scale={[w.width / 10, 1, w.height / 10]} />
            );
          })}
        </Instances>

        <LocalPlayer 
          localPosRef={localPosRef} 
          myMessage={myMessage} 
          keys={keys} 
          networkStateRef={networkStateRef} 
          wsRef={wsRef} 
        />
        <CameraTracker localPosRef={localPosRef} isTPP={isTPP} />
        
        {Object.entries(ghostUI).map(([id, ui]) => (
          <GhostAvatar key={id} id={id} message={ui.message} networkStateRef={networkStateRef} />
        ))}
      </Canvas>
    </div>
  );
}
