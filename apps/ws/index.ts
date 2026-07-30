import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

const wss = new WebSocketServer({ port: 8080 });

const JWT_SECRET = "metaverse-super-secret";

wss.on("connection", function connection(ws, req) {
  const url = req.url;
  if (!url) {
    ws.close();
    return;
  }

  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token");
  
  if (!token) {
    ws.close();
    return;
  }

  try {
    // 1. Verify Token
    jwt.verify(token, JWT_SECRET as string);
    
    // 2. Assign unique Ghost ID so you can play against yourself with the same Token!
    const clientId = randomUUID();
    
    ws.send(JSON.stringify({ type: "welcome", payload: { message: "Welcome to the Matrix", clientId } }));
    
    // 3. The Broadcast Engine
    ws.on("message", function message(data) {
      const parsed = JSON.parse(data.toString());
      
      if (parsed.type === "move") {
        // Blast this movement coordinate to EVERYONE else in the network
        wss.clients.forEach(function each(client) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "player_moved",
              payload: { clientId: clientId, x: parsed.payload.x, y: parsed.payload.y }
            }));
          }
        });
      }

      if (parsed.type === "chat") {
        wss.clients.forEach(function each(client) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "chat_received",
              payload: { clientId: clientId, message: parsed.payload.message }
            }));
          }
        });
      }

      if (parsed.type === "ping") {
        ws.send(JSON.stringify({
          type: "pong",
          payload: { time: parsed.payload.time }
        }));
      }
    });
  } catch (e) {
    console.error("JWT Verification failed:", e);
    ws.close();
  }
});

console.log("Websocket Velocity Engine listening on port 8080");
