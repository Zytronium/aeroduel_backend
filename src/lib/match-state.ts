import { MatchState, Plane } from "@/types";
import { generateAuthToken, generateMatchId } from "@/lib/utils";

let sessionId = generateMatchId(); // TODO: change this every time a match ENDS in order to invalidate all plane auth tokens after each match
let currentMatch: MatchState | null = null;
export const planes: Plane[] = [];

// In-memory auth token store, scoped by matchId + planeId
const planeAuthTokens = new Map<string, string>();
const userAuthTokens = new Map<string, string>();

// Return current session ID
export function getSessionId() {
  return sessionId;
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
  if (!currentMatch)
    return [];

  return planes.filter(plane => plane.isJoined);
}
// Kicks a player's plane from the match.
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
    return {
      ...match,
      matchPlanes: updatedPlanes
    };
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

  // If match ended or a new match started, clear stored user auth tokens
  if (
    (!currentMatch && previousMatch) ||
    (currentMatch && previousMatch && currentMatch.matchId !== previousMatch.matchId)
  ) {
    userAuthTokens.clear();
  }

  return currentMatch;
}

export function registerHit(planeId: string, targetId: string, timestamp: Date): boolean {
  try {
    // If no current match exists, exit
    if (!currentMatch)
      return false;

    // get attacker plane. If plane does not exist, exit
    const attacker = getPlaneById(planeId);
    if (!attacker)
      return false;

    // get target plane. If plane does not exist, exit
    const target = getPlaneById(targetId);
    if (!target)
      return false;

    // Create an empty events array if it doesn't exist yet
    if (!currentMatch.events) {
      currentMatch.events = [];
    }

    // Record hit event
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

  return true;
}

// Store/overwrite the auth token for a given plane in a given match
export function setPlaneAuthToken(sessionId: string, planeId: string, authToken: string): void {
  const key = `${sessionId}:${planeId}`;
  planeAuthTokens.set(key, authToken);
}

// Validate that the provided auth token matches what we stored
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

// Validate that the provided auth token matches what we stored
export function validateUserAuthToken(
  matchId: string,
  userId: string,
  authToken: string
): boolean {
  const key = `${matchId}:${userId}`;
  return userAuthTokens.get(key) === authToken;
}

export function joinPlaneToMatch(planeId: string, playerName: string): boolean {
  if (!currentMatch)
    return false;

  const planeIndex = planes.findIndex(p => p.planeId === planeId);

  // Plane must be registered first (via /api/register)
  if (planeIndex === -1)
    return false;

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

  // Trigger WebSocket update here in the future

  return true;
}
