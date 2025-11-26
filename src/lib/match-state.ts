import { MatchState, RegisteredPlane } from "@/types";
import is from "@sindresorhus/is";
import undefined = is.undefined;

let currentMatch: MatchState | null = null;

// In-memory auth token store, scoped by matchId + planeId
const planeAuthTokens = new Map<string, string>();
const userAuthTokens = new Map<string, string>();

// Return current match state
export function getCurrentMatch() {
  return currentMatch;
}

// Update match state
export function updateCurrentMatch(
  updater: (match: MatchState | null) => MatchState | null
): MatchState | null {
  const previousMatch = currentMatch;
  currentMatch = updater(currentMatch);

  // If match ended or a new match started, clear all stored auth tokens
  if (
    (!currentMatch && previousMatch) ||
    (currentMatch && previousMatch && currentMatch.matchId !== previousMatch.matchId)
  ) {
    planeAuthTokens.clear();
    userAuthTokens.clear();
  }

  return currentMatch;
}

export function registerHit(planeId: string, targetId: string, timestamp: Date): boolean {
  try {
    if (!currentMatch)
      return false;

    // Record hit event
    if (!currentMatch.events) {
      currentMatch.events = [];
    }
    currentMatch.events.push({
      type: 'hit',
      planeId,
      targetId,
      timestamp
    });

    // Initialize matchPlanes if needed
    if (!currentMatch.matchPlanes) {
      currentMatch.matchPlanes = new Map();
    }

    // Update attacker stats
    if (!currentMatch.matchPlanes.has(planeId)) {
      currentMatch.matchPlanes.set(planeId, {
        hits: 0, hitsTaken: 0
      });
    }

    const attackerStats = currentMatch.matchPlanes.get(planeId)!;
    attackerStats.hits++;

    // Update target stats
    if (!currentMatch.matchPlanes.has(targetId)) {
      currentMatch.matchPlanes.set(targetId, { hits: 0, hitsTaken: 0 });
    }
    const targetStats = currentMatch.matchPlanes.get(targetId)!;
    targetStats.hitsTaken++;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    return false;
  }
  return true;
}

export function registerPlane(matchId: string, planeData: RegisteredPlane): boolean {
  if (!currentMatch || currentMatch.matchId !== matchId)
    return false;
  
  // Check if plane already registered, if so update it
  const existingIndex = currentMatch.onlinePlanes.findIndex(p => p.planeId === planeData.planeId);
  
  if (existingIndex >= 0) {
    currentMatch.onlinePlanes[existingIndex] = {
      ...currentMatch.onlinePlanes[existingIndex],
      ...planeData
    };
  } else {
    currentMatch.onlinePlanes.push(planeData);
  }
  
  return true;
}

// Store/overwrite the auth token for a given plane in a given match
export function setPlaneAuthToken(matchId: string, planeId: string, authToken: string): void {
  const key = `${matchId}:${planeId}`;
  planeAuthTokens.set(key, authToken);
}

// Validate that the provided auth token matches what we stored
export function validatePlaneAuthToken(
  matchId: string,
  planeId: string,
  authToken: string
): boolean {
  const key = `${matchId}:${planeId}`;
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

export function joinPlaneToMatch(gamePin: string, planeId: string, playerName: string): boolean {
  if (!currentMatch || currentMatch.gamePin !== gamePin) return false;

  const planeIndex = currentMatch.onlinePlanes.findIndex(
    (p) => p.planeId === planeId
  );

  // Plane must be registered first (via /api/register)
  if (planeIndex === -1) return false;

  currentMatch.onlinePlanes[planeIndex].playerName = playerName;

  // Trigger WebSocket update here in the future

  return true;
}
