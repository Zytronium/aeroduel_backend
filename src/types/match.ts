export interface MatchState {
  matchId: string;
  gamePin: string;
  status: "waiting" | "active" | "ended";
  createdAt: Date;
  matchType: "timed"; // | "scored" | "lives"; // (Stretch goal match types)
  duration: number; // match duration in seconds
  registeredPlanes: RegisteredPlane[];
  maxPlayers: number;
  serverUrl: string;
  wsUrl: string;
}

export interface RegisteredPlane {
  planeId: string;
  esp32Ip?: string;
  playerName?: string;
  registeredAt: Date;
}
