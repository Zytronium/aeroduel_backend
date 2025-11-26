export interface MatchState {
  matchId: string;
  gamePin: string;
  status: "waiting" | "active" | "ended";
  createdAt: Date;
  matchType: "timed"; // | "scored" | "lives"; // (Stretch goal match types)
  duration: number; // match duration in seconds
  onlinePlanes: RegisteredPlane[];
  matchPlanes: Map<string, MatchPlane>;
  maxPlayers: number;
  serverUrl: string;
  wsUrl: string;
  events: Event[];
}

export interface RegisteredPlane {
  planeId: string;
  esp32Ip?: string;
  playerName?: string;
  userId: string;
  registeredAt: Date;
}

export interface MatchPlane {
  // planeId: string;
  // esp32Ip?: string;
  // playerName?: string;
  // userId: string;
  hits: number;
  hitsTaken: number;
}

export interface Event {
  type: "hit";
  planeId: string;
  targetId: string;
  timestamp: Date;
}