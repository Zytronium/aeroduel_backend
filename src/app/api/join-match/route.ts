import { NextResponse } from "next/server";
import {
  getCurrentMatch,
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

  const { gamePin, planeId, playerName, userId } = data;
  // TODO: Decide whether to use a custom playerName, generate a name (i.e. Bravo-5 or Player 1), or not use it at all.

  if (!gamePin || !planeId || !userId || !playerName) {
    return NextResponse.json(
      { error: "Missing required fields: gamePin, planeId, userId, and playerName are required." },
      { status: 400 }
    );
  }

  // Validate Game PIN
  const match = getCurrentMatch();
  if (!match || match.gamePin !== gamePin) {
    return NextResponse.json(
      { error: "Invalid Game PIN or no match active." },
      { status: 404 }
    );
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

  if (match.status !== "waiting") {
    return NextResponse.json(
      { error: "Match is already in progress or ended." },
      { status: 409 }
    );
  }

  // Check max players
  const currentPlayers = onlinePlanes.filter(p => p.playerName).length;
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
      { error: "Plane not registered. Please ensure the plane is turned on and connected to WiFi first." },
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
