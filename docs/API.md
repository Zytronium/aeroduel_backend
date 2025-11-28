<div align="center">
  <a href="https://github.com/Aeroduel">
    <img src="/public/two-jets-logo.svg" alt="Aeroduel Logo" width="800" />
  </a>
  <br />
  <hr/>
  <br />
  <img src="/public/logo_text.svg" alt="Aeroduel" width="400" />
  <br />
  <img src="/public/server-text.svg" alt="Server" width="150" />
  <br />
  <h1>Aeroduel Server API Documentation</h1>
</div>  

## Overview

The Aeroduel Server API handles match creation, plane registration, game state management, and real-time communication between ESP32s and mobile apps.

**Base URL:** `http://aeroduel.local:45045`  
**WebSocket URL:** `ws://aeroduel.local:45045`

---

## Authentication

### Server Tokens
Some endpoints are only accessible when inside the desktop application to prevent external tampering by accessing the browser version at `http://aeroduel.local:45045/`.
These endpoints require a server token. This token is accessible by importing `getServerToken()` from [src/app/getAuth.ts](/src/app/getAuth.ts) and must be awaited.
Only the server and Electron app know the token, which prevents outside tampering via any other source, including the host device unless the request explicitly comes 
from the Electron app itself. Not even the host device's browser can access the token. The server token is used for endpoints like `POST /api/new-match` or admin controls
like disqualifying planes during a match.

### Plane Tokens
The onboard ESP32s also require an auth token for endpoints relating to the game (`POST /api/hit` for example). This auth token is assigned when calling `POST /api/register`.
Anyone can call api/register, so to prevent bad actors from registering fake planes in order to get an auth token, the user can kick unknown planes from the match lobby
and disqualify planes during the match (if, for example, the plane crashes or turns out to be a fake plane that registered and is causing trouble). 
Each plane will be given a different auth token for each different session. A session starts when either the server first opens or when a new match begins, and ends 
when a new match begins or the server shuts down. 

### User Tokens
The mobile app also requires an auth token for many of the endpoints it needs to use. This auth token is assigned when the users joins a match (`POST /api/join-match`) and 
is reset when a new match begins.

---

## Endpoints

### POST `/api/new-match`

Creates a new Aeroduel match in "waiting" state. Requires a server token for
authentication. Validates `duration` (30–1800 seconds) and `maxPlayers` (2–16)
and detects the local IP and constructs `serverUrl`, `wsUrl`, and `qrCodeData`
using mDNS hostname (fallback to local IP)

**Request Body:**
```json
{
  "serverToken": "some-unique-token",
  "duration": 420,      // Optional: Match duration in seconds (default: 420 (7 minutes))
  "maxPlayers": 2       // Optional: Maximum players (default: 2)
}
```

**Validation:**
- `serverToken`: Must match `SERVER_TOKEN` environment variable, which is auto-generated and should not be set manually
- `duration`: 30-1800 seconds (30 seconds to 30 minutes)
- `maxPlayers`: 2-16 players (you probably shouldn't increase this limit, just to keep the game safe)

**Success Response (200):**
```json
{
  "success": true,
  "match": {
    "matchId": "a1b2c3d4e5f6...",
    "gamePin": "123456",
    "qrCodeData": "aeroduel://join?host=aeroduel.local&port=45045&pin=123456",
    "status": "waiting",
    "matchType": "timed",
    "duration": 420,
    "maxPlayers": 2,
    "serverUrl": "http://aeroduel.local:45045",
    "wsUrl": "ws://aeroduel.local:45045",
    "matchPlanes": [],
    "localIp": "192.168.1.5"
  }
}
```

**Server Discovery:**
- Prefers mDNS hostname (`aeroduel.local`) for URLs
- Falls back to local IP address when mDNS unavailable
- Port defaults to 45045 (configurable via `PORT` env var)

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

**403 - Unauthorized**
```json
{
  "error": "Unauthorized"
}
```

**409 - Match already exists**
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

**Notes:**
- Only one match can exist on the server at a time
- Attempting to create a match while one is active (not "ended") returns 409

---

### POST `/api/register`

Registers that a plane is online. Called when a plane's ESP32 is powered on and
the LoRa connects to the WiFi network.  
Registers/updates the plane in the in‑memory `planes` list. Generates and 
returns the auth token the ESP32 will use for plane-specific requests.


**Request Body:**
```json
{
  "planeId": "uuid-of-plane",
  "esp32Ip": "192.168.1.101",
  "userId": "uuid-of-linked-user-account-or-null"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "authToken": "some-authentication-token",
  "matchId": "a1b2c3d4e5f6..."
}
```

---

### POST `/api/join-match`

Adds a plane to the current match's waiting room.
Returns the auth token the mobile app will use for mobile-specific requests
during this match.
Ensures the match is still in `waiting` state and the requesting `userId` matches 
the one associated with the given `planeId` and enforces the `maxPlayers` limit.

**Request Body:**
```json
{
  "planeId": "uuid-of-plane",
  "playerName": "Foxtrot-4",
  "userId": "uuid-of-user"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "authToken": "some-authentication-token",
  "matchId": "a1b2c3d4e5f6..."
}
```

---

### POST `/api/start-match` _<small>(Coming Soon)</small>_

Begins the current match stored in memory if not started yet and if there are
at least 2 players joined so far. 

## Planned Body and Responses

**Request Body:**
```json
{
  "serverToken": "some-server-token"
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

### POST `/api/hit`

ESP32 reports a hit event. Validates `planeId` and `targetId` are associated 
with the current match and are not identical, adds a new "hit" `Event` to the 
match's `events` list, and updates the `Plane` for the target plane with the new
hit count. Can only be called by the ESP32s, as enforced by the auth token.

**Request Body:**
```json
{
  "authToken": "some-authentication-token",
  "planeId": "uuid-of-this-plane",
  "targetId": "uuid-of-hit-plane"
}
```

**Success Response (200):**
```json
{
  "success": true
}
```

### GET `/api/planes`

Returns a list of all registered planes, including their current match status and scores if applicable.

**Authentication:** None required (public endpoint)

**Request:** No parameters required

**Success Response (200):**
```json
{
  "planes": [
    {
      "planeId": "uuid-of-plane",
      "userId": "uuid-of-user",
      "esp32Ip": "192.168.1.101",
      "playerName": "Foxtrot-4",
      "registeredAt": "2025-11-28T12:00:00Z",
      "hits": 3,
      "hitsTaken": 1,
      "isOnline": true,
      "isJoined": true,
      "isDisqualified": false
    }
  ]
}
```

**Response Fields:**
- `planeId` - Unique identifier for the plane
- `userId` - User account linked to this plane (nullable)
- `esp32Ip` - IP address of the plane's ESP32 (nullable)
- `playerName` - Display name for the player (nullable until joined)
- `registeredAt` - Timestamp when plane first registered
- `hits` - Number of successful hits scored (default: 0)
- `hitsTaken` - Number of hits received (default: 0)
- `isOnline` - Whether the plane is currently connected
- `isJoined` - Whether the plane has joined the current match
- `isDisqualified` - Whether the plane has been disqualified

**Notes:**
- Returns all registered planes regardless of online/match status
- Sensitive data like auth tokens is excluded from response
- Scores (`hits`, `hitsTaken`) only meaningful during active matches
- Planes persist in memory until server restart

---

## WebSocket Events _<small>(Coming Soon)</small>_

Real-time communication for match updates.

**Connection:**
```javascript
const ws = new WebSocket('ws://aeroduel.local:45045');
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
  duration: number; // in seconds
  registeredPlanes: RegisteredPlane[];
  matchPlanes: Map<string, MatchPlane>;
  maxPlayers: number;
  serverUrl: string;
  wsUrl: string;
  events: Event[];
}
```

### RegisteredPlane
```typescript
{
  planeId: string;
  esp32Ip?: string;
  playerName?: string;
  userId: string;
  registeredAt: Date;
}
```

### MatchPlane
```typescript
{
  hits: number;
  hitsTaken: number;
}
```

### Event
```typescript
{
  type: "hit";
  planeId: string;
  targetId: string;
  timestamp: Date;
}
```

---

## Game Logic _<small>(WIP)</small>_

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
- `401` - Unauthenticated (missing or invalid auth token)
- `403` - Forbidden (Not authorized to perform this action from this device)
- `404` - Not Found
- `409` - Conflict (e.g., match already exists)
- `500` - Server Error

---

## Network Requirements

- **Desktop Server**, **Mobile Apps**, and **ESP32s** must be on the same WiFi network. This can be a mobile hotspot, so there's no need to bring a WiFi router to the airfield.
- Server auto-detects local IP address and publishes it as aeroduel.local via mDNS. Ensure mDNS is not blocked by your firewall.
- Default port: `45045` (configurable via `PORT` env variable). If you change this, the ESP32s and mobile app must also be programmed to know the new port.

---

## Current Endpoints
- `POST /api/new-match` – Creates a new Aeroduel match in waiting state
  - Only one match allowed at a time (returns 409 if match already exists)
  - INPUT: `{ serverToken, duration?, maxPlayers? }`
  - OUTPUT: `{ success, match }` (`match` includes `matchId`, `gamePin`, URLs, QR payload, etc.)

- `POST /api/register` – Registers that a plane is online, but doesn't associate it with the current match yet
  - Called by the plane's ESP32 once it is on Wi‑Fi
  - Returns a per‑session auth token for that `planeId` (used for plane‑specific requests)
  - INPUT: `{ planeId, esp32Ip?, userId? }`
  - OUTPUT: `{ success, authToken, matchId }`

- `POST /api/join-match` – Adds a plane to the current match's waiting room for a specific player
  - Called by the mobile app when a player hits the "join match" button
  - Assigns an auth token for the mobile app for the duration of the match
  - INPUT: `{ planeId, userId, playerName }`
  - OUTPUT: `{ success, authToken, matchId }`

- `POST /api/hit` - Registers a hit during the match
  - Called by the ESP32s when a plane is shot by another plane
  - Only the ESP32s should make requests to this endpoint, as enforced by the auth token
  - INPUT: `{ authToken, planeId, targetId }`
  - OUTPUT: `success`

- `GET /api/planes` - List all online planes
    - Returns a list of all online planes, including if they have joined the
      current match and their current score if the match is ongoing 
    - Anyone can make a request to this endpoint.
    - INPUT: none
    - OUTPUT: `{ planes: [{ planeId, userId?, esp32Ip?, playerName?, registeredAt, hits, hitsTaken, isOnline, isJoined, isDisqualified }] }`

## Future Endpoints
- `POST /api/start-match` - Begins an Aeroduel match
  - Updates the match in memory to be active and sends WebSocket updates to ESP32s and mobile apps
  - Only the sever's front-end can make requests to this endpoint, and this is enforced
  - INPUT: `serverToken` 
  - OUTPUT: `success, match`

## Possible Additional Future Endpoints
- `GET /api/match/:id` - Get match details
- `DELETE /api/match/:id` - Cancel/end match
- `GET /api/match/:id/events` - Get match events such as hits

---

## Notes

- Currently supports **one active match at a time**
- Match state stored in-memory (resets on server restart)
- Database persistence possibly coming in future release

---

**Documentation Created**: November 21, 2025  
**Last Updated**: November 28, 2025
