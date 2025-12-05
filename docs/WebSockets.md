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
  <h1>Aeroduel WebSockets Documentation</h1>
</div>

This document describes the WebSocket protocol used by the Aeroduel server for
real‑time communication with:

- **Mobile clients** (role: `"mobile"`)
- **Planes / ESP32s** (role: `"arduino"`)

It covers connection details, handshake, authentication, and every event type
currently implemented.

---

## 1. Connection & Ports

- The HTTP API listens on a configurable `PORT` (default: **45045**).
- The WebSocket server listens on a configurable `WS_PORT`.  
  By default:

  ```text
  WS_PORT = PORT + 1
  ```

So if HTTP is on `45045`, WebSockets are on **45046**.

- The server exposes a **WebSocket URL** that is included in the match state
  (`wsUrl`). Always prefer that URL over hard‑coding.

### Example (JavaScript client)
```javascript
const ws = new WebSocket('ws://aeroduel.local:45046');

ws.onopen = () => {
  // Send hello handshake (required), see section 2
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('Received:', msg);
};

ws.onerror = (err) => {
  console.error('WebSocket error', err);
};

ws.onclose = () => {
  console.log('WebSocket closed');
};
```
---

## 2. Handshake (Client → Server)

The **first** message on every new WebSocket connection **must** be a `hello`
handshake. If:

- The first message is not a valid `hello`, or
- No valid `hello` is received within a short timeout (≈ 5 seconds),

the server sends a `system:error` and closes the connection.

There are two handshake variants, one for mobiles and one for planes.

### 2.1 Mobile handshake

Used by the **mobile app** after the user has joined a match via
`POST /api/join-match`.

**Client → Server**
```json
{
  "type": "hello",
  "role": "mobile",
  "matchId": "a1b2c3d4e5f6...",
  "userId": "uuid-of-user",
  "authToken": "user-auth-token-from-join-match"
}
```
Fields:

- `type`: `"hello"` (required).
- `role`: `"mobile"`.
- `matchId`: ID of the match the user joined.
- `userId`: ID of the user.
- `authToken`: Mobile auth token issued for that user+match.

**Server behavior:**

- Validates the `authToken` against the given `matchId` and `userId`.
- On success:
    - Starts tracking this socket as a mobile client for `matchId`.
    - Replies with `system:ack` (see §3.1).
- On failure:
    - Sends `system:error` (see §3.2).
    - Closes the connection.

After a successful handshake, the mobile client will begin receiving:

- `match:update`
- `plane:hit`
- `match:end`

for that specific match.

---

### 2.2 Arduino (plane) handshake

Used by the **ESP32 / plane** after registering via `POST /api/register`.

**Client → Server**
```json
{
  "type": "hello",
  "role": "arduino",
  "planeId": "uuid-of-plane",
  "authToken": "plane-auth-token-from-register"
}
```
Fields:

- `type`: `"hello"` (required).
- `role`: `"arduino"`.
- `planeId`: Unique ID of the plane.
- `authToken`: Plane auth token issued for the current session.

**Server behavior:**

- Validates the `authToken` for the given `planeId` and session.
- On success:
    - Tracks this socket as an arduino client for `planeId`.
    - Marks the plane as online.
    - Cancels any pending "disconnect" timers for that plane.
    - Replies with `system:ack` (see §3.1).
- On failure:
    - Sends `system:error` (see §3.2).
    - Closes the connection.

After a successful handshake, the plane will receive:

- `match:state`
- `plane:flash`
- `plane:kicked`
- `plane:disqualified`

as appropriate.

---

## 3. System Messages (Server → Client)

These messages are used during and immediately after handshake, and for generic
error reporting.

### 3.1 `system:ack`

**Direction:** Server → Client  
**Sent when:** A `hello` handshake is successfully validated.

**For mobile clients:**
```json
{
  "type": "system:ack",
  "data": {
    "role": "mobile",
    "userId": "uuid-of-user",
    "matchId": "a1b2c3d4e5f6..."
  }
}
```
**For planes:**
```json
{
  "type": "system:ack",
  "data": {
    "role": "arduino",
    "planeId": "uuid-of-plane"
  }
}
```
Semantics:

- Confirms that:
    - The `hello` message format was correct.
    - The provided auth token was valid.
    - The connection is now "bound" to that role and identity.
- After receiving this, the client can treat the connection as established for
  the current match/session.

---

### 3.2 `system:error`

**Direction:** Server → Client  
**Sent when:** There is a protocol or auth problem, typically during handshake.

Examples:

- First message is not valid JSON.
- First message is not `type: "hello"`.
- Required fields are missing or wrong types.
- Auth token is invalid or does not match the given IDs.

**Payload:**
```json
{
  "type": "system:error",
  "error": "Human-readable error message."
}
```
Semantics:

- Explains why the connection is about to be closed (or why the request cannot
  be honored).
- In most handshake-related cases, the server closes the WebSocket right after
  sending `system:error`.

Client recommendation:

- Log the `error` string for debugging.
- Do not automatically retry in a tight loop; fix credentials or state first.

---

## 4. Match Events for Mobile Clients (Server → Mobile)

Mobile clients receive match-level updates scoped to the match they joined in
their `hello` handshake.

### 4.1 `match:update`

**Direction:** Server → Mobile  
**Sent when:** The match state or scores change (e.g., match starts, hit
registered, disqualification, etc.).

**Payload:**
```json
{
  "type": "match:update",
  "data": {
    "status": "active",
    "timeRemaining": null,
    "scores": [
      {
        "planeId": "plane-1",
        "playerName": "Foxtrot-4",
        "hits": 3,
        "hitsTaken": 1,
        "isDisqualified": false
      },
      {
        "planeId": "plane-2",
        "playerName": "Echo-7",
        "hits": 1,
        "hitsTaken": 3,
        "isDisqualified": false
      }
    ]
  }
}
```
Fields:

- `status`: `"waiting" | "active" | "ended"`.
- `timeRemaining`:
    - Intended to be the number of seconds left when `status === "active"`.
    - May be `null` or omitted as an implementation placeholder.
- `scores`: One entry per plane currently joined in the match:
    - `planeId`: Unique ID for the plane.
    - `playerName` (optional): Display name.
    - `hits`: Number of successful hits scored.
    - `hitsTaken`: Number of hits received.
    - `isDisqualified`: Whether the plane is currently disqualified.

Semantics:

- Represents the **authoritative scoreboard** and high-level match state at a
  particular moment.
- Clients should overwrite local UI state from each `match:update` rather than
  trying to "patch" or guess.

---

### 4.2 `plane:hit`

**Direction:** Server → Mobile  
**Sent when:** A hit is successfully registered via the HTTP API.

**Payload:**
```json
{
  "type": "plane:hit",
  "data": {
    "planeId": "attacker-plane-id",
    "targetId": "target-plane-id",
    "timestamp": "2025-11-21T12:05:30.000Z"
  }
}
```
Fields:

- `planeId`: Plane that scored the hit (attacker).
- `targetId`: Plane that was hit (target).
- `timestamp`: ISO 8601 timestamp for when the hit was recorded.

Semantics:

- A single discrete hit event.
- Useful for:
    - Animations and hit indicators in the UI.
    - Event logs ("Plane A hit Plane B at 12:05:30Z").
- Usually followed (or preceded) by a `match:update` that changes the scores.

---

### 4.3 `match:end`

**Direction:** Server → Mobile  
**Sent when:** The match finishes (either timer expiry or explicit admin end).

**Payload:**
```json
{
  "type": "match:end",
  "data": {
    "winners": ["plane-1", "plane-3"],
    "scores": [
      {
        "planeId": "plane-1",
        "playerName": "Foxtrot-4",
        "hits": 5,
        "hitsTaken": 2,
        "isDisqualified": false
      },
      {
        "planeId": "plane-2",
        "playerName": "Echo-7",
        "hits": 5,
        "hitsTaken": 2,
        "isDisqualified": false
      }
    ]
  }
}
```
Fields:

- `winners`: Array of `planeId`s that share first place.
    - Multiple winners indicate a draw according to scoring rules.
- `scores`: Final standings for all planes that joined:
    - Same schema as the `scores` array in `match:update`.

Semantics:

- This is the **final result** of the match.
- Clients should:
    - Transition to an end‑of‑match screen.
    - Highlight planes in `winners`.
    - Store the results.

---

## 5. Control Events for Planes (Server → Arduino)

Planes are primarily controlled via these messages. They do not send their own
WebSocket messages beyond the initial `hello` in the current implementation.

### 5.1 `match:state`

**Direction:** Server → Arduino (planes)  
**Sent when:** The global match state changes and planes need to react.

**Payload:**
```json
{
  "type": "match:state",
  "data": {
    "status": "active"
  }
}
```
Fields:

- `status`: `"waiting" | "active" | "ended"`.

Recommended plane behavior:

- `waiting`:
    - Prepare for match; do not count or report hits yet.
- `active`:
    - Begin or continue normal gameplay behavior.
    - Only during this state should the firmware report hits to the server.
- `ended`:
    - Stop reporting hits.
    - Optionally display some end-of-match indication.

---

### 5.2 `plane:flash`

**Direction:** Server → Arduino (specific plane)  
**Sent when:** The server wants a plane to visually indicate that it has been hit
(e.g., after a registered hit).

**Payload:**
```json
{
  "type": "plane:flash",
  "data": {
    "planeId": "target-plane-id",
    "byPlaneId": "attacker-plane-id",
    "timestamp": "2025-11-21T12:05:30.000Z"
  }
}
```
Fields:

- `planeId`: The plane that should flash (usually the target of a hit).
- `byPlaneId`: The attacking plane.
- `timestamp`: ISO 8601 timestamp for the hit.

Recommended plane behavior:

- Trigger a visible/audible indication (LED pattern, buzzer, etc.).
- The pattern and duration are implementation details of the plane firmware.

---

### 5.3 `plane:kicked`

**Direction:** Server → Arduino (specific plane)  
**Sent when:** The plane is removed from the match, typically while the match is
still in the lobby/waiting phase.

**Payload:**
```json
{
  "type": "plane:kicked",
  "data": {
    "planeId": "uuid-of-plane",
    "reason": "kick"
  }
}
```
Fields:

- `planeId`: The plane that was kicked.
- `reason`: One of:
    - `"kick"` – Explicit admin kick while waiting.
    - `"disconnect"` – Removed because of connectivity issues.
    - `"manual"` – Generic administrative reason.

Recommended plane behavior:

- Stop participating in the current match.
- Optionally revert to an idle/waiting state until re-registered or re-joined.
- Optionally display a specific "kicked" indication.

---

### 5.4 `plane:disqualified`

**Direction:** Server → Arduino (specific plane)  
**Sent when:** The plane is disqualified during an active match (e.g., for
crashing or cheating).

**Payload:**
```json
{
  "type": "plane:disqualified",
  "data": {
    "planeId": "uuid-of-plane",
    "reason": "manual"
  }
}
```
Fields:

- `planeId`: The disqualified plane.
- `reason`: One of `"kick" | "disconnect" | "manual"`.
    - For a true disqualification, `"manual"` is typical.

Recommended plane behavior:

- Immediately stop normal gameplay (e.g., stop reporting hits).
- Change light colors, flash lights until powered off, or turn off lights.
---

## 6. Disconnect Semantics

### 6.1 Arduino (plane) disconnects

When a plane's WebSocket connection closes or errors:

1. The server stops tracking that WebSocket client.
2. The plane is marked offline in in-memory state.
3. A "grace period" disconnect timer is scheduled (e.g., ~20 seconds).
4. If the plane does not reconnect in time, the server may:
    - Treat it as fully disconnected.
    - Potentially kick or disqualify it, and send `plane:kicked` /
      `plane:disqualified` if/when it reconnects.

This behavior allows forgiveness for short WiFi drops while still enabling
reliable offline detection.

### 6.2 Mobile disconnects

When a mobile client's WebSocket closes or errors:

- The server simply stops sending that client updates.
- The match itself continues unaffected.
- The user can reconnect and send a fresh `hello` for the same match to resume
  real-time updates.

---

## 7. Summary of Message Types

### Client → Server

- `hello`
    - Mobile: `{ type: "hello", role: "mobile", matchId, userId, authToken }`
    - Arduino: `{ type: "hello", role: "arduino", planeId, authToken }`

> Currently, other client → server WebSocket messages are ignored after a
> successful `hello`. Game actions (hits, etc.) still go through HTTP APIs.

---

### Server → Any

- `system:ack` – Successful handshake acknowledgment.
- `system:error` – Protocol/auth error explanation (often followed by close).

---

### Server → Mobile

- `match:update` – Live match status and scores.
- `plane:hit` – Individual hit event (attacker, target, timestamp).
- `match:end` – Final winners and scores.

---

### Server → Arduino (Planes)

- `match:state` – Global match state: `"waiting" | "active" | "ended"`.
- `plane:flash` – Command to flash lights because of a hit.
- `plane:kicked` – Plane removed from match/lobby; includes reason.
- `plane:disqualified` – Plane disqualified during an active match; includes reason.

---

**Documentation Created**: December 5, 2025  
**Last Updated**: December 5, 2025
