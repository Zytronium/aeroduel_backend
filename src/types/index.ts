export interface MatchState {
  matchId: string;
  gamePin: string;
  status: "waiting" | "active" | "ended";
  createdAt: Date;
  matchType: "timed"; // | "scored" | "lives"; // (Stretch goal match types)
  duration: number;      // match duration in seconds
  matchPlanes: string[]; // planeIds of planes that have joined the match
  maxPlayers: number;
  serverUrl: string;
  wsUrl: string;
  events: Event[];
}

export interface Plane {
  /* Registration info */
  esp32Ip?: string;
  planeId: string;
  userId: string;
  playerName?: string;
  registeredAt: Date;

  /* Match info */
  hits?: number;
  hitsTaken?: number;

  /* Misc booleans */
  isOnline: boolean;
  isJoined: boolean;
  isDisqualified: boolean;
}

export interface Event {
  type: "join" | "leave" | "hit" | "disqualify";
  planeId: string;
  targetId?: string; // for hit events
  timestamp: Date;
}
