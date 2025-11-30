import { NextResponse } from "next/server";
import {
  getCurrentMatch,
  getJoinedPlanes,
  kickPlayer
} from "@/lib/match-state";

export async function POST(req: Request) {
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { planeId, serverToken } = data;

  // Validate server token
  if (serverToken !== process.env.SERVER_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!planeId) {
    return NextResponse.json(
      { error: "Missing required field: planeId" },
      { status: 400 }
    );
  }

  // Get current match and ensure it's not ended
  const match = getCurrentMatch();
  if (!match) {
    return NextResponse.json({ error: "No match active." }, { status: 404 });
  }
  if (match.status === "ended") {
    return NextResponse.json(
      { error: "Cannot kick planes from an ended match." },
      { status: 410 }
    );
  }

  // Check if plane is in the match
  if (!getJoinedPlanes().find(p => p.planeId === planeId)) {
    return NextResponse.json(
      { error: "Plane is not in the current match." },
      { status: 404 }
    );
  }

  try {
    // Disqualify if match is active, otherwise just kick
    const disqualified = match.status === "active";
    kickPlayer(planeId, disqualified);

  return NextResponse.json({
    success: true
  });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to kick plane." },
      { status: 500 }
    );
  }
}