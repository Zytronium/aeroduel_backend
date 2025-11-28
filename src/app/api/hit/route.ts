import { NextResponse } from "next/server";
import {
  getCurrentMatch, getOnlinePlanes, getSessionId,
  registerHit,
  validatePlaneAuthToken
} from "@/lib/match-state";

export async function POST(req: Request) {
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const timestamp = new Date();
  const { authToken, planeId, targetId } = data;

  if (!authToken || !planeId || !targetId) {
    return NextResponse.json(
      { error: "Missing required fields. authToken, planeId, and targetId are required." },
      { status: 400 }
    );
  }

  // Get current match and ensure it exists
  const match = getCurrentMatch();

  if (!match) {
    return NextResponse.json(
      { error: "No match active." },
      { status: 404 }
    );
  }

  // get online planes
  const onlinePlanes = getOnlinePlanes();

  // Validate authToken against the one generated in /api/register
  const isValidToken = validatePlaneAuthToken(getSessionId(), planeId, authToken);
  if (!isValidToken) {
    return NextResponse.json(
      { error: "Invalid auth token for this plane." },
      { status: 401 }
    );
  }

  // Validate targetId is a valid planeId in the current match
  const targetPlane = onlinePlanes.find(p => p.planeId === targetId);
  if (!targetPlane) {
    return NextResponse.json(
      { error: "Target plane is not in this match." },
      { status: 404 }
    );
  }

  // Validate planeId is a valid planeId in the current match and not targetId
  const plane = onlinePlanes.find(p => p.planeId === planeId && p.planeId !== targetId);
  if (!plane) {
    return NextResponse.json(
      { error: "Attacking plane ID is not in this match or is identical to the target plane ID." },
      { status: 404 }
    );
  }

  registerHit(planeId, targetId, timestamp);
  console.log(`Plane ${plane.playerName} hit plane ${targetPlane.playerName} at ${timestamp}`);

  return NextResponse.json({ success: true });
}
