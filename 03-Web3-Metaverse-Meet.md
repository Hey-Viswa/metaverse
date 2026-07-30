# 🌐 Google Meet Metaverse (Web3)

## 🎯 Functional Requirements
*   Real-time Peer-to-Peer (P2P) video streaming.
*   Spatial audio and Web3 Wallet Login.

## ⚙️ How it Works
Avatars render on a 2D Canvas. When two avatars are close, WebRTC establishes a direct P2P connection between their browsers.

## 📂 File Structure (Step-by-Step)
```text
/server
 ├── signaling.ts       (WebSocket server to relay WebRTC offers/answers)
/client
 ├── src/
 │    ├── canvas/
 │    │    └── WorldRenderer.ts  (Vanilla JS HTML5 Canvas loop)
 │    ├── web3/
 │    │    └── MetaMaskAuth.ts   (Ethers.js integration)
 │    └── webrtc/
 │         └── PeerConnection.ts (Manages the video/audio streams)
```

## 🧮 Algorithms to Master
*   **Pythagorean Theorem (Distance Formula):** `sqrt((x2-x1)^2 + (y2-y1)^2)` to calculate volume based on avatar proximity (Spatial Audio).
*   **WebRTC ICE Negotiation:** Handshaking algorithm to bypass NAT firewalls.

## 💻 Tech Stack (No Constraints)
*   **Backend:** Node.js + Socket.io (Signaling).
*   **Frontend:** Vanilla JS Canvas + Ethers.js + Vanilla CSS.

## 🧠 The Dual-Brain Architecture (Scale Upgrade)
This architecture fundamentally separates **State (Memory)** from **Velocity (Reflexes)** to handle 10K+ concurrent users without DB locking.

### 1. Separation of Concerns
1. **The State Engine (HTTP):** Handles standard CRUD operations (Signup/Signin, Create Space, Get Maps, Update Metadata). Returns JWTs for auth.
2. **The Velocity Engine (WebSocket):** Pure, dumb speed relay server for low-latency movement (X,Y updates) and WebRTC handshakes. No DB connection here if possible to keep it lean. "Sticky connections" to the same WS server per room.
3. **Database (Postgres via Prisma):** Stores Users, Avatars, Maps, Elements, and Map-Element mappings (many-to-many via explicit tables).

```mermaid
graph TD
    %% Styling
    classDef client fill:#2a2a2a,stroke:#00ffcc,stroke-width:2px,color:#fff
    classDef http fill:#1a365d,stroke:#4299e1,stroke-width:2px,color:#fff
    classDef ws fill:#742a2a,stroke:#f56565,stroke-width:2px,color:#fff
    classDef db fill:#276749,stroke:#48bb78,stroke-width:2px,color:#fff
    classDef turbo fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff,stroke-dasharray: 5 5

    %% Nodes
    C1["Avatar 1 Client<br>Canvas + WebRTC"]:::client
    C2["Avatar 2 Client<br>Canvas + WebRTC"]:::client

    subgraph "Turborepo (Monorepo)"
        direction TB
        
        HTTP["HTTP Server<br>Express / Node"]:::http
        WS["WebSocket Server<br>Socket.io Relay"]:::ws
        
        subgraph "Shared Database Package"
            Prisma["@repo/db<br>Prisma Client"]:::turbo
        end
        
        DB[("Postgres DB<br>Maps, Users, Elements")]:::db
    end

    %% Connections
    C1 <-->|"REST API<br>Auth, Get Map, Update"| HTTP
    C2 <-->|"REST API<br>Auth, Get Map, Update"| HTTP
    
    C1 <-->|"WebSocket<br>Movement (X,Y), WebRTC Signaling"| WS
    C2 <-->|"WebSocket<br>Movement (X,Y), WebRTC Signaling"| WS
    
    %% Direct P2P Video
    C1 <.->|"WebRTC Direct P2P<br>Video & Spatial Audio"| C2

    %% Backend DB Connections
    HTTP ==>|Reads/Writes State| Prisma
    Prisma ==>|SQL Queries| DB
    
    %% WS avoids DB for speed
    WS -.->|Auth Verification Only| Prisma
```

### 2. The Database Matrix (Map-Element Join)
To allow multiple users to see the exact same chair in the same coordinate dynamically, elements are mapped to spaces via a join table.

```mermaid
erDiagram
    USERS ||--o{ SPACES : creates
    SPACES ||--o{ SPACE_ELEMENTS : contains
    ELEMENTS ||--o{ SPACE_ELEMENTS : "placed as"

    USERS {
        string ID
        string Username
        string AvatarID
    }
    SPACES {
        string ID
        string Name
        int Width
        int Height
    }
    ELEMENTS {
        string ID
        string ImageURL
        boolean isStatic
    }
    SPACE_ELEMENTS {
        string SpaceID
        string ElementID
        int X_Coordinate
        int Y_Coordinate
    }
```
