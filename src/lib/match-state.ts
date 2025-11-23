import { MatchState } from '@/types';

let currentMatch: MatchState | null = null;

// Return current match state
export function getCurrentMatch() {
  return currentMatch;
}

// Update match state
export function updateCurrentMatch(updater: (match: MatchState | null) => MatchState | null): MatchState | null {
  currentMatch = updater(currentMatch);
  return currentMatch;
}
