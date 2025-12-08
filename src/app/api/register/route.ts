import { NextResponse } from "next/server";
import {
  getCurrentMatch,
  getSessionId,
  registerPlane,
  setPlaneAuthToken
} from "@/lib/match-state";
import { generateAuthToken } from "@/lib/utils";
import { broadcastPlanePowerOn } from "@/lib/websocket";

export async function POST(req: Request) {
    let data;
    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { planeId, esp32Ip, userId } = data;
    // note: esp32Ip may not be needed

    if (!planeId/* || !esp32Ip || !userId*/) {
        return NextResponse.json(
            { error: "Missing required field: planeId is required." },
            { status: 400 }
        );
    }

  // Get current match if it exists (may be null)
  const match = getCurrentMatch();

  // Generate a new auth token for this session
  const authToken = generateAuthToken();

  // Register/update the plane in our in-memory plane store
  const success = registerPlane({
    hits: 0,
    hitsTaken: 0,
    isDisqualified: false,
    isJoined: false,
    isOnline: true,
    playerName: "",
    planeId,
    esp32Ip, // todo: we can assume this from requester's IP address if not provided
    userId,
    registeredAt: new Date()
  });

  if (!success) {
    return NextResponse.json(
      { error: "Failed to register plane." },
      { status: 500 }
    );
  }

  // Associate this plane's auth token with that match
  setPlaneAuthToken(getSessionId(), planeId, authToken);

  // Notify mobile clients in the current match that this plane has powered on.
  // Use provided userId when available; fall back to an empty string if not present.
  broadcastPlanePowerOn(planeId, userId ?? "");

  return NextResponse.json({
    success: true,
    authToken,
    matchId: match?.matchId ?? null,
  });
}
