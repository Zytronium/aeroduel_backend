<div align="center">
  <a href="https://github.com/Aeroduel">
    <img src="public/two-jets-logo.svg" alt="Aeroduel Logo" width="800" />
  </a>
  <br />
  <hr/>
  <br />
  <img src="public/logo_text.svg" alt="Aeroduel" width="400" />
  <br />
  <img src="public/server-text.svg" alt="Server" width="150" />
  <br />
  <h1>Aeroduel Server API Documentation</h1>
</div>

## Overview

The Aeroduel Server API handles match creation, plane registration, game state management, and real-time communication between ESP32s and mobile apps.

**Base URL:** `http://aeroduel.local:45045`  
**WebSocket URL:** `ws://aeroduel.local:45045`

---

## Authentication

Currently, no authentication is required. All endpoints are accessible on the local network.
In the future, the onboard ESP32s will require an auth token for endpoints relating to the game (`POST /api/hit` for example).
This auth token is given to the ESP32 in the response to `POST /api/register`.

---

## Endpoints

### POST `/api/new-match`

Creates a new Aeroduel match in "waiting" state.

**Request Body:**
```json
{
  "duration": 420,      // Optional: Match duration in seconds (default: 420 (7 minutes))
  "maxPlayers": 2       // Optional: Maximum players (default: 2)
}
```

**Validation:**
- `duration`: 30-1800 seconds (30 seconds to 30 minutes)
- `maxPlayers`: 2-16 players (you probably shouldn't increase this limit, just to keep the game safe)

**Success Response (200):**
```json
{
  "success": true,
  "match": {
    "matchId": "a1b2c3d4e5f6...",
    "gamePin": "123456",
    "status": "waiting",
    "matchType": "timed",
    "duration": 420,
    "maxPlayers": 2,
    "serverUrl": "http://192.168.1.5:45045",
    "wsUrl": "ws://192.168.1.5:45045",
    "qrCodeData": "aeroduel://join?ip=192.168.1.5&port=45045&pin=123456",
    "registeredPlanes": []
  }
}
```

**Error Responses:**

**400 - Invalid JSON**
```json
{
  "error": "Invalid JSON"
}
```

**400 - Invalid duration**
```json
{
  "error": "Duration must be a valid number between 30 seconds and 30 minutes (1800 seconds)"
}
```

**400 - Invalid maxPlayers**
```json
{
  "error": "maxPlayers must be a valid number between 2 and 16"
}
```

**409 - A match already exists**
```json
{
  "error": "A match is already in progress",
  "existingMatch": {
    "matchId": "...",
    "gamePin": "123456",
    "status": "waiting"
  }
}
```

**500 - Network error**
```json
{
  "error": "Could not detect local IP address. Ensure you're connected to WiFi."
}
```

**Example:**
```bash
curl -X POST http://192.168.1.5:45045/api/new-match \
  -H "Content-Type: application/json" \
  -d '{"duration": 300, "maxPlayers": 3}'
```

---

### POST `/api/join-match` _<small>(Coming Soon)</small>_

Registers a plane to join the current match.

**Request Body:**
```json
{
  "gamePin": "123456",
  "planeId": "uuid-of-plane",
  "playerName": "Player 1",
  "esp32Ip": "192.168.1.101"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "plane": {
    "planeId": "uuid-of-plane",
    "playerName": "Player 1",
    "registeredAt": "2025-11-21T12:00:00Z"
  }
}
```

---

### POST `/api/start-match` _<small>(Coming Soon)</small>_

Starts the match timer if all conditions are met.

**Request Body:**
```json
{
  "matchId": "a1b2c3d4e5f6..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "match": {
    "status": "active",
    "startedAt": "2025-11-21T12:01:00Z",
    "endsAt": "2025-11-21T12:08:00Z"
  }
}
```

---

### POST `/api/hit` _<small>(Coming Soon)</small>_

ESP32 reports a hit event.

**Request Body:**
```json
{
  "targetPlaneId": "uuid-of-hit-plane",
  "attackingPlaneId": "uuid-of-this-plane",
  "timestamp": "2025-11-21T12:05:30Z"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "hitRegistered": true
}
```

---

## WebSocket Events _<small>(Coming Soon)</small>_

Real-time communication for match updates.

**Connection:**
```javascript
const ws = new WebSocket('ws://192.168.1.5:45045');
```

**Events:**

#### Server -> Client

**`match:update`**
```json
{
  "type": "match:update",
  "data": {
    "status": "active",
    "timeRemaining": 300,
    "scores": [...]
  }
}
```

**`plane:hit`**
```json
{
  "type": "plane:hit",
  "data": {
    "planeId": "uuid",
    "hitBy": "uuid",
    "timestamp": "2025-11-21T12:05:30Z"
  }
}
```

**`match:end`**
```json
{
  "type": "match:end",
  "data": {
    "winner": "uuid",
    "finalScores": [...]
  }
}
```

---

## Data Models

### MatchState
```typescript
{
  matchId: string;
  gamePin: string;
  status: "waiting" | "active" | "ended";
  createdAt: Date;
  matchType: "timed";
  duration: number;
  registeredPlanes: RegisteredPlane[];
  maxPlayers: number;
  serverUrl: string;
  wsUrl: string;
}
```

### RegisteredPlane
```typescript
{
  planeId: string;
  esp32Ip?: string;
  playerName?: string;
  registeredAt: Date;
}
```

---

## Game Logic _<small>(Coming Soon)</small>_

### Match Flow
1. **Create Match** - Desktop app calls `/api/new-match`
2. **Registration** - Players scan QR or enter game PIN; mobile app calls `/api/join-match`
3. **Start Match** - When ready, desktop app calls `/api/start-match`
4. **Gameplay** - ESP32s report hits via `/api/hit`, server broadcasts updates via WebSocket
5. **End Match** - Timer expires, server calculates winner and broadcasts results

### Scoring (Timed Mode) 
- Each hit on another plane: +1 point
- Getting hit: no penalty (unless there's a tie)
- Winner: the plane with the most points when timer expires. If there's a tie, the plane that's taken the fewest hits wins. If there's still a tie, it's a draw.

---

## Error Handling

All endpoints follow this error format:
```json
{
  "error": "Human-readable error message"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid input)
- `404` - Not Found
- `409` - Conflict (e.g., match already exists)
- `500` - Server Error

---

## Network Requirements

- **Desktop Server**, **Mobile Apps**, and **ESP32s** must be on the same WiFi network. This can be a mobile hotspot, so there's no need to bring a WiFi router to the airfield.
- Server auto-detects local IP address and publishes it as aeroduel.local via mDNS. Ensure mDNS is not blocked by your firewall.
- Default port: `45045` (configurable via `PORT` env variable). If you change this, the ESP32s and mobile app must also be programmed to know the new port.

---

## Future Endpoints
- `POST /api/register` - Tells the server this plane is online and active
  - Creates a plane ID and an OAuth token for that plane.
  - INPUT: none or possibly a unique plane UUID that this specific ESP32 always has even after rebooting.
  - OUTPUT: `{ planeId, authToken, matchId }`
- `POST /api/hit` - Registers a hit during the match
  - INPUT: `{ authToken, planeId, targetId }`
  - OUTPUT: `success`

## Possible Additional Future Endpoints

- `GET /api/match/:id` - Get match details
- `DELETE /api/match/:id` - Cancel/end match
- `GET /api/planes` - List registered planes
- `DELETE /api/plane/:id` - Unregister plane

---

## Notes

- Currently supports **one active match at a time**
- Match state stored in-memory (resets on server restart)
- Database persistence possibly coming in future release

---

**Documentation Created**: November 21, 2025
**Last Updated**: November 21, 2025  
