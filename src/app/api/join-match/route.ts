import { NextResponse } from "next/server";
import {
  getCurrentMatch, getJoinedPlanes,
  getOnlinePlanes,
  joinPlaneToMatch,
  setUserAuthToken
} from "@/lib/match-state";
import { generateAuthToken } from "@/lib/utils";

export async function POST(req: Request) {
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { planeId, playerName, userId } = data;
  // TODO: Decide whether to use a custom playerName, generate a name (i.e. Bravo-5 or Player 1), or not use it at all.

  if (!planeId || !userId || !playerName) {
    return NextResponse.json(
      { error: "Missing required fields: planeId, userId, and playerName are required." },
      { status: 400 }
    );
  }

  // Get current match and ensure it's waiting for players to join
  const match = getCurrentMatch();
  if (!match) {
    return NextResponse.json(
      { error: "No match active." },
      { status: 404 }
    );
  }
  if (match.status === "active") {
    return NextResponse.json(
      { error: "The current match has already started." },
      { status: 409 }
    )
  }
  if (match.status === "ended") {
    return NextResponse.json(
      { error: "The latest match has already ended and a new match waiting room has not been opened yet." },
      { status: 410 }
    )
  }

  // get all online planes
  const onlinePlanes = getOnlinePlanes();

  // Validate userId matches the userId for this plane in current match state
  if (userId !== onlinePlanes.find(p => p.planeId === planeId)?.userId) {
    return NextResponse.json(
      { error: "User ID does not belong to this plane." },
      { status: 400 }
    );
  }

  // Check max players
  const currentPlayers = getJoinedPlanes().length;
  if (currentPlayers >= match.maxPlayers) {
    return NextResponse.json(
      { error: "Match is full." },
      { status: 409 }
    );
  }

  // Generate a new auth token for this session
  const authToken = generateAuthToken();
  const success = joinPlaneToMatch(planeId, playerName);

  if (!success) {
    return NextResponse.json(
      { error: "Plane not registered as online. Please ensure the plane is turned on and connected to the correct WiFi network first." },
      { status: 400 }
    );
  }

  // Store the auth token securely on the server, mapped to matchId + planeId
  setUserAuthToken(match.matchId, userId, authToken);

  return NextResponse.json({
    success: true,
    authToken: authToken,
    matchId: match.matchId,
  });
}
