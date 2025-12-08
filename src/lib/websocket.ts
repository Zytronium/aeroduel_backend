import WebSocket, { WebSocketServer } from "ws";
import {
    getCurrentMatch,
    getJoinedPlanes,
    getSessionId,
    validatePlaneAuthToken,
    validateUserAuthToken,
    markPlaneOnline,
    markPlaneOffline,
    schedulePlaneDisconnectCheck,
    cancelPlaneDisconnectTimer, getPlaneById,
} from "@/lib/match-state";

export type WSClientRole = "mobile" | "arduino";

interface TrackedClient {
  ws: WebSocket;
  role: WSClientRole;
  userId?: string;
  planeId?: string;
  matchId?: string;
}

type HelloMessage =
  | {
      type: "hello";
      role: "mobile";
      matchId: string;
      userId: string;
      authToken: string;
    }
  | {
      type: "hello";
      role: "arduino";
      planeId: string;
      authToken: string;
    };

interface MatchUpdate {
  type: "match:update";
  data: {
    status: "waiting" | "active" | "ended";
    timeRemaining?: number | null;
    scores: Array<{
      planeId: string;
      playerName?: string;
      hits: number;
      hitsTaken: number;
      isDisqualified: boolean;
    }>;
  };
}

interface PlaneHit {
  type: "plane:hit";
  data: {
    planeId: string;
    targetId: string;
    timestamp: string;
  };
}

interface MatchEnd {
  type: "match:end";
  data: {
    winners: string[];
    scores: Array<{
      planeId: string;
      playerName?: string;
      hits: number;
      hitsTaken: number;
      isDisqualified: boolean;
    }>;
  };
}

interface MatchCreated {
    type: "match:created";
    data: {
        matchId: string;
        status: "waiting";
    };
}

interface SystemAcknowledge {
  type: "system:ack";
  data: {
    role: WSClientRole;
    userId?: string;
    planeId?: string;
    matchId?: string;
  };
}

interface SystemError {
  type: "system:error";
  error: string;
}

interface PlaneFlash {
  type: "plane:flash";
  data: {
    planeId: string;
    byPlaneId: string;
    timestamp: string;
  };
}

interface MatchStateMsg {
  type: "match:state";
  data: {
    status: "waiting" | "active" | "ended";
  };
}

interface PlaneRemoved {
  type: "plane:kicked" | "plane:disqualified";
  data: {
    planeId: string;
    reason: "kick" | "disconnect" | "manual";
  };
}

interface PlanePowerOn {
    type: "plane:poweron";
    data: {
        planeId: string;
        userId: string;
    };
}

type OutgoingMessage =
    | MatchUpdate |  PlaneHit  |   MatchEnd    | MatchCreated
    | SystemError | PlaneFlash | MatchStateMsg | PlaneRemoved
    | SystemAcknowledge | PlanePowerOn;

// WebSocket port: default to PORT + 1 so we don't collide with HTTP server
export const WS_PORT = Number(
  process.env.WS_PORT ?? (Number(process.env.PORT ?? 45045) + 1),
);

let wss: WebSocketServer | null = null;
const clients = new Set<TrackedClient>();

function ensureWebSocketServer(): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ port: WS_PORT });

  wss.on("connection", (ws) => {
    let tracked: TrackedClient | null = null;
    let helloReceived = false;

    const helloTimeout = setTimeout(() => {
      if (!helloReceived) {
        safeSend(ws, {
          type: "system:error",
          error: "First message must be a 'hello' handshake.",
        });
        ws.close();
      }
    }, 5000);

    ws.on("message", (raw) => {
      if (helloReceived) {
        // For now we ignore subsequent messages; this can be extended later.
        return;
      }

      let msg: unknown;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        safeSend(ws, {
          type: "system:error",
          error: "Invalid JSON.",
        });
        ws.close();
        return;
      }

      if (!isHelloMessage(msg)) {
        safeSend(ws, {
          type: "system:error",
          error: "First message must be a 'hello' handshake.",
        });
        ws.close();
        return;
      }

      helloReceived = true;
      clearTimeout(helloTimeout);

      // Validate + register client
      if (msg.role === "mobile") {
        const ok = validateUserAuthToken(
          msg.matchId,
          msg.userId,
          msg.authToken,
        );
        if (!ok) {
          safeSend(ws, {
            type: "system:error",
            error: "Invalid auth token for this user/match.",
          });
          ws.close();
          return;
        }

        tracked = {
          ws,
          role: "mobile",
          userId: msg.userId,
          matchId: msg.matchId,
        };
        clients.add(tracked);

        safeSend(ws, {
          type: "system:ack",
          data: {
            role: "mobile",
            userId: msg.userId,
            matchId: msg.matchId,
          },
        });
      } else if (msg.role === "arduino") {
        const ok = validatePlaneAuthToken(
          getSessionId(),
          msg.planeId,
          msg.authToken,
        );
        if (!ok) {
          safeSend(ws, {
            type: "system:error",
            error: "Invalid auth token for this plane.",
          });
          ws.close();
          return;
        }

        tracked = {
          ws,
          role: "arduino",
          planeId: msg.planeId,
        };
        clients.add(tracked);

        // Mark plane online and cancel any pending disconnect timer
        try {
          markPlaneOnline(msg.planeId);
          cancelPlaneDisconnectTimer(msg.planeId);
        } catch (e) {
          // Non-fatal; keep WS connection alive
          console.error("[ws] Failed to mark plane online:", e);
        }

        safeSend(ws, {
          type: "system:ack",
          data: {
            role: "arduino",
            planeId: msg.planeId,
          },
        });
      }
    });

    ws.on("close", () => {
      if (tracked) {
        clients.delete(tracked);

        if (tracked.role === "arduino" && tracked.planeId) {
          try {
            // Immediately mark offline and schedule grace-period check
            markPlaneOffline(tracked.planeId);
            schedulePlaneDisconnectCheck(tracked.planeId, 20_000);
          } catch (e) {
            console.error("[ws] Error handling arduino disconnect:", e);
          }
        }
      }
      clearTimeout(helloTimeout);
    });

    ws.on("error", () => {
      if (tracked) {
        clients.delete(tracked);

        if (tracked.role === "arduino" && tracked.planeId) {
          try {
            markPlaneOffline(tracked.planeId);
            schedulePlaneDisconnectCheck(tracked.planeId, 20_000);
          } catch (e) {
            console.error("[ws] Error handling arduino error/disconnect:", e);
          }
        }
      }
      clearTimeout(helloTimeout);
    });
  });

  console.log(
    `[ws] WebSocket server started on port ${WS_PORT} (role-aware: mobile + arduino)`,
  );

  return wss;
}

function isHelloMessage(msg: any): msg is HelloMessage {
  if (!msg || msg.type !== "hello" || typeof msg.role !== "string") return false;

  if (msg.role === "mobile") {
    return (
      typeof msg.matchId === "string" &&
      typeof msg.userId === "string" &&
      typeof msg.authToken === "string"
    );
  }

  if (msg.role === "arduino") {
    return (
      typeof msg.planeId === "string" &&
      typeof msg.authToken === "string"
    );
  }

  return false;
}

function safeSend(ws: WebSocket, payload: OutgoingMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(
  predicate: (client: TrackedClient) => boolean,
  message: OutgoingMessage,
) {
  for (const client of clients) {
    if (!predicate(client)) continue;
    safeSend(client.ws, message);
  }
}

/**
 * Helper for /api/new-match to build wsUrl given a hostname.
 */
export function getWebSocketUrl(serverHost: string): string {
  return `ws://${serverHost}:${WS_PORT}`;
}

/**
 * Broadcast a full match snapshot (status + scores) to all mobile clients
 * that are associated with the current match.
 */
export function broadcastMatchUpdate(): void {
  ensureWebSocketServer();

  const match = getCurrentMatch();
  if (!match) return;

  const joined = getJoinedPlanes();
  const scores = joined.map((plane) => ({
    planeId: plane.planeId,
    playerName: plane.playerName,
    hits: plane.hits ?? 0,
    hitsTaken: plane.hitsTaken ?? 0,
    isDisqualified: plane.isDisqualified ?? false,
  }));

  // In the future, when you track endsAt, you can compute this precisely.
  const timeRemaining =
    match.status === "active" ? null : undefined; // placeholder

  const payload: OutgoingMessage = {
    type: "match:update",
    data: {
      status: match.status,
      timeRemaining,
      scores,
    },
  };

  broadcast(
    (c) => c.role === "mobile" && c.matchId === match.matchId,
    payload,
  );
}

/**
 * Broadcast a single hit event to all mobile clients in the match.
 */
export function broadcastPlaneHit(
  planeId: string,
  targetId: string,
  timestamp: Date,
): void {
  ensureWebSocketServer();

  const match = getCurrentMatch();
  if (!match) return;

  const payload: OutgoingMessage = {
    type: "plane:hit",
    data: {
      planeId,
      targetId,
      timestamp: timestamp.toISOString(),
    },
  };

  broadcast(
    (c) => c.role === "mobile" && c.matchId === match.matchId,
    payload,
  );
}

/**
 * Broadcast to all mobile clients that a new match has been created.
 * This allows them to reset their join state and join the new match.
 */
export function broadcastMatchCreated(matchId: string): void {
    ensureWebSocketServer();

    const payload: OutgoingMessage = {
        type: "match:created",
        data: {
            matchId,
            status: "waiting",
        },
    };

    // Broadcast to ALL mobile clients, regardless of their current matchId
    // This allows kicked/ended players to know a new match is available
    broadcast(
        (c) => c.role === "mobile",
        payload,
    );
}

/**
 * Broadcast final results to all mobile clients when a match ends.
 */
export function broadcastMatchEnd(results: {
  winners: string[];
  scores: Array<{
    planeId: string;
    playerName?: string;
    hits: number;
    hitsTaken: number;
    isDisqualified: boolean;
  }>;
}): void {
  ensureWebSocketServer();

  const match = getCurrentMatch();
  if (!match) return;

  const payload: OutgoingMessage = {
    type: "match:end",
    data: {
      winners: results.winners,
      scores: results.scores,
    },
  };

  broadcast(
    (c) => c.role === "mobile" && c.matchId === match.matchId,
    payload,
  );
}

/**
 * Utility for future use: send a message to a single plane (Arduino).
 * Useful for commands like "flash lights" or "match started".
 */
export function sendToPlane(
  planeId: string,
  message: OutgoingMessage,
): void {
  ensureWebSocketServer();

  for (const client of clients) {
    if (client.role === "arduino" && client.planeId === planeId) {
      safeSend(client.ws, message);
    }
  }
}

/**
 * Tell a specific plane to flash its lights because it was hit.
 */
export function sendFlashCommandToPlane(
  targetId: string,
  byPlaneId: string,
  ts: Date,
): void {
  sendToPlane(targetId, {
    type: "plane:flash",
    data: {
      planeId: targetId,
      byPlaneId,
      timestamp: ts.toISOString(),
    },
  });
}

/**
 * Broadcast match state (waiting/active/ended) to all connected planes.
 * ESP32s use this to know when they should or should not report hits.
 */
export function broadcastMatchStateToPlanes(
  status: "waiting" | "active" | "ended",
): void {
  ensureWebSocketServer();

  broadcast(
    (c) => c.role === "arduino",
    {
      type: "match:state",
      data: { status },
    },
  );
}

/**
 * Notify a plane AND the specific mobile client associated with that plane
 * that it has been kicked or disqualified.
 */
export function broadcastPlanePowerOn(planeId: string, userId: string): void {
    ensureWebSocketServer();

    const match = getCurrentMatch();
    if (!match) return;

    const payload: OutgoingMessage = {
        type: "plane:poweron",
        data: {
            planeId,
            userId,
        },
    };

    broadcast(
        (c) => c.role === "mobile" && c.matchId === match.matchId,
        payload,
    );
}

export function notifyPlaneKickedOrDisqualified(
  planeId: string,
  kind: "plane:kicked" | "plane:disqualified",
  reason: "kick" | "disconnect" | "manual",
): void {
  ensureWebSocketServer();

  const match = getCurrentMatch();

  const payload: OutgoingMessage = {
    type: kind,
    data: {
      planeId,
      reason,
    },
  };

  // Send to the specific plane
  sendToPlane(planeId, payload);

  // Find the plane to get its userId
  const plane = getPlaneById(planeId);

  // Only send to the mobile client associated with this specific plane's user
  if (match && plane) {
    broadcast(
      (c) => c.role === "mobile" && c.matchId === match.matchId && c.userId === plane.userId,
      payload,
    );
  }
}

/**
 * Introspection helper: see which users/planes are currently connected.
 */
export function getConnectedClientsSummary() {
  const mobiles: { userId?: string; matchId?: string }[] = [];
  const arduinos: { planeId?: string }[] = [];

  for (const c of clients) {
    if (c.role === "mobile") {
      mobiles.push({ userId: c.userId, matchId: c.matchId });
    } else if (c.role === "arduino") {
      arduinos.push({ planeId: c.planeId });
    }
  }

  return { mobiles, arduinos };
}

// Start server immediately when module is first imported
ensureWebSocketServer();
