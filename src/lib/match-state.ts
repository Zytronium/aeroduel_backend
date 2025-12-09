import type { MatchState, Plane, Event } from "@/types";
import { generateAuthToken, generateMatchId } from "@/lib/utils";

let sessionId = generateMatchId(); // TODO: change this every time a match ENDS in order to invalidate all plane auth tokens after each match
let currentMatch: MatchState | null = null;
export const planes: Plane[] = [];

const planeAuthTokens = new Map<string, string>();
const userAuthTokens = new Map<string, string>();

// Track disconnect-grace timers per plane
const planeDisconnectTimers = new Map<string, NodeJS.Timeout>();

// Keep track of the icon color that was assigned to the previously registered plane.
// It will be "BLACK" or "WHITE", or null if no plane has been registered yet in this server run.
let lastRegisteredIcon: "BLACK" | "WHITE" | null = null;

// Return current session ID
export function getSessionId() {
  return sessionId;
}

// Return the next icon to assign. If the previous icon was "BLACK", return "WHITE".
// Otherwise return "BLACK". Default to "BLACK" if there was no previous icon.
export function getNextIcon(): "BLACK" | "WHITE" {
  if (lastRegisteredIcon === "BLACK") {
    return "WHITE";
  }
  return "BLACK";
}

// Regenerate Session ID
export function resetSessionId() {
  sessionId = generateAuthToken();
  return sessionId;
}

// Return list of all online planes
export function getOnlinePlanes() {
  return planes.filter(plane => plane.isOnline);
}

// Return list of planes that have joined the match
export function getJoinedPlanes(): Plane[] {
  if (!currentMatch) return [];
  return planes.filter(plane => plane.isJoined);
}

// Kicks a player's plane from the match
export function kickPlayer(planeId: string, disqualified: boolean = false) {
  if (!currentMatch)
    throw new Error("Cannot kick player from non-existent match");

  const planeIndex = planes.findIndex(plane => plane.planeId === planeId);
  if (planeIndex === -1)
    throw new Error("Cannot kick player that does not exist");

  if (!getJoinedPlanes().find(p => p.planeId === planeId))
    throw new Error("Cannot kick player that is not joined");

  // set plane.isJoined to false and update disqualified status if disqualified is true
  planes[planeIndex].isJoined = false;
  if (disqualified)
    planes[planeIndex].isDisqualified = true;

  // TODO: Decide whether to keep disqualified planes in match state and plane.isJoined.
  //  Currently, it is removed from the match state, but it could be kept in
  //  the match state for future reference.

  // remove this planeId from currentMatch.matchPlanes
  updateCurrentMatch(match => {
    if (!match) return match;
    const updatedPlanes = match.matchPlanes.filter(id => id !== planeId);
    return { ...match, matchPlanes: updatedPlanes };
  });
}

// Return current match state
export function getCurrentMatch() {
  return currentMatch;
}

export function getPlaneById(planeId: string) {
  return planes.find(plane => plane.planeId === planeId);
}

// Update match state
export function updateCurrentMatch(
  updater: (match: MatchState | null) => MatchState | null
): MatchState | null {
  const previousMatch = currentMatch;
  currentMatch = updater(currentMatch);

  // If the match instance changed (new matchId or match cleared), reset
  // per‑match user tokens.
  if (
    (!currentMatch && previousMatch) ||
    (currentMatch && previousMatch && currentMatch.matchId !== previousMatch.matchId)
  ) {
    userAuthTokens.clear();

    // When a NEW match is created (matchId changes), clear per‑match stats
    // from all currently online planes so they don't carry scores forward.
    if (currentMatch && previousMatch && currentMatch.matchId !== previousMatch.matchId) {
      // Reset per-plane match stats, even for offline planes
      for (const plane of planes) {
        plane.hits = 0;
        plane.hitsTaken = 0;
        plane.isDisqualified = false;
        plane.isJoined = false;
      }
      // Clear matchPlanes since its used to track IDs of joined planes
      currentMatch.matchPlanes = [];
    }
  }

  // NOTE: We no longer clear matchPlanes or isJoined flags when a match ends.
  // This allows the ended match to retain its joined planes for display and
  // post‑match stats. Per‑match cleanup should happen when a NEW match is created.

  return currentMatch;
}

export function registerHit(planeId: string, targetId: string, timestamp: Date): boolean {
  try {
    if (!currentMatch) return false;

    const attacker = getPlaneById(planeId);
    if (!attacker) return false;

    const target = getPlaneById(targetId);
    if (!target) return false;

    if (!currentMatch.events) {
      currentMatch.events = [];
    }

    currentMatch.events.push({
      type: "hit",
      planeId,
      targetId,
      timestamp,
    });

    // Update attacker stats on Plane
    attacker.hits = (attacker.hits ?? 0) + 1;

    // Update target stats on Plane
    target.hitsTaken = (target.hitsTaken ?? 0) + 1;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    return false;
  }
  return true;
}

export function registerPlane(planeData: Plane): boolean {
  // Check if plane already registered, if so update it
  const existingIndex = planes.findIndex(p => p.planeId === planeData.planeId);

  const normalized: Plane = {
    // Registration info
    planeId: planeData.planeId,
    userId: planeData.userId,
    esp32Ip: planeData.esp32Ip,
    playerName: planeData.playerName,
    registeredAt: planeData.registeredAt ?? new Date(),
    icon: planeData.icon ?? getNextIcon(),

    // Match info
    hits: planeData.hits ?? 0,
    hitsTaken: planeData.hitsTaken ?? 0,

    // Misc booleans
    isOnline: planeData.isOnline ?? true,
    isJoined: planeData.isJoined ?? false,
    isDisqualified: planeData.isDisqualified ?? false,
  };

  if (existingIndex >= 0) {
    planes[existingIndex] = {
      ...planes[existingIndex],
      ...normalized,
    };
  } else {
    planes.push(normalized);
  }

  // Update the stored lastRegisteredIcon to reflect this registration.
  // Use the icon from the normalized object to ensure we store what was actually assigned.
  lastRegisteredIcon = normalized.icon === "BLACK" ? "BLACK" : "WHITE";

  return true;
}

// Store/overwrite the auth token for a given plane in a given match
export function setPlaneAuthToken(sessionId: string, planeId: string, authToken: string): void {
  const key = `${sessionId}:${planeId}`;
  planeAuthTokens.set(key, authToken);
}

export function validatePlaneAuthToken(
  sessionId: string,
  planeId: string,
  authToken: string
): boolean {
  const key = `${sessionId}:${planeId}`;
  return planeAuthTokens.get(key) === authToken;
}

// Store/overwrite the auth token for a given user's mobile app in a given match
export function setUserAuthToken(matchId: string, userId: string, authToken: string): void {
  const key = `${matchId}:${userId}`;
  userAuthTokens.set(key, authToken);
}

export function validateUserAuthToken(
  matchId: string,
  userId: string,
  authToken: string
): boolean {
  const key = `${matchId}:${userId}`;
  return userAuthTokens.get(key) === authToken;
}

export function joinPlaneToMatch(planeId: string, playerName: string): boolean {
  if (!currentMatch) return false;

  const planeIndex = planes.findIndex(p => p.planeId === planeId);
  if (planeIndex === -1) return false;

  const plane = planes[planeIndex];

  // Update plane join state
  plane.playerName = playerName;
  plane.isJoined = true;

  // Ensure match.matchPlanes tracks joined planeIds
  if (!currentMatch.matchPlanes.includes(planeId)) {
    currentMatch.matchPlanes = [...currentMatch.matchPlanes, planeId];
  }

  // Record join event
  if (!currentMatch.events) {
    currentMatch.events = [];
  }
  currentMatch.events.push({
    type: "join",
    planeId,
    timestamp: new Date(),
  });

  return true;
}

/**
 * Mark a plane as online in memory.
 * Called when its WebSocket "hello" handshake succeeds.
 */
export function markPlaneOnline(planeId: string): void {
  const plane = getPlaneById(planeId);
  if (!plane) {
    console.warn(`[match-state] markPlaneOnline: plane not found: ${planeId}`);
    return;
  }

  plane.isOnline = true;
}

/**
 * Mark a plane as offline in memory and log it.
 * Called immediately when the WebSocket connection closes/errors.
 */
export function markPlaneOffline(planeId: string): void {
  const plane = getPlaneById(planeId);
  if (!plane) {
    console.warn(`[match-state] markPlaneOffline: plane not found: ${planeId}`);
    return;
  }
  plane.isOnline = false;
  console.log(`[match-state] Plane ${planeId} went offline (WebSocket closed).`);

  // If this plane is currently part of the match, remove it from matchPlanes
  // and mark it as no longer joined. Also record a "leave" event.
  const match = getCurrentMatch();
  if (!match) return;

  if (match.matchPlanes.includes(planeId)) {
    plane.isJoined = false;

    updateCurrentMatch((current) => {
      if (!current) return current;

      const matchPlanes = current.matchPlanes.filter((id) => id !== planeId);
      const events = current.events ? [...current.events] : [];

      const leaveEvent: Event = {
        type: "leave",
        planeId,
        timestamp: new Date(),
      };
      events.push(leaveEvent);

      return { ...current, matchPlanes, events };
    });
  }
}

/**
 * Schedule a check after a grace period. If the plane is still offline and
 * in an active match, automatically disqualify it.
 */
export function schedulePlaneDisconnectCheck(planeId: string, delayMs: number): void {
  if (planeDisconnectTimers.has(planeId)) {
    clearTimeout(planeDisconnectTimers.get(planeId)!);
  }

  const timeout = setTimeout(() => {
    planeDisconnectTimers.delete(planeId);
    tryAutoDisqualifyAfterDisconnect(planeId);
  }, delayMs);

  planeDisconnectTimers.set(planeId, timeout);
}

/**
 * Cancel any pending disconnect timer for this plane.
 * Called when the plane successfully reconnects via WebSocket.
 */
export function cancelPlaneDisconnectTimer(planeId: string): void {
  const existing = planeDisconnectTimers.get(planeId);
  if (existing) {
    clearTimeout(existing);
    planeDisconnectTimers.delete(planeId);
  }
}

/**
 * Internal helper: if a plane is still offline after the grace period and the
 * match is active, disqualify it and add a "disqualify" event.
 */
function tryAutoDisqualifyAfterDisconnect(planeId: string): void {
  const match = getCurrentMatch();
  if (!match || match.status !== "active") return;

  const plane = getPlaneById(planeId);
  if (!plane || plane.isOnline || !plane.isJoined || plane.isDisqualified) return;

  console.log(`[match-state] Auto-disqualifying plane ${planeId} after disconnect grace period.`);
  plane.isDisqualified = true;
  plane.isJoined = false;

  // Record event in match.events and remove plane from matchPlanes
  updateCurrentMatch((current) => {
    if (!current) return current;
    const events = current.events ? [...current.events] : [];
    const disqualifyEvent: Event = {
      type: "disqualify",
      planeId,
      timestamp: new Date(),
    };
    events.push(disqualifyEvent);

    const matchPlanes = current.matchPlanes.filter((id) => id !== planeId);

    return { ...current, events, matchPlanes };
  });
}

export function findPlaneById(planeId: string): Plane | undefined {
  return planes.find((p) => p.planeId === planeId);
}
