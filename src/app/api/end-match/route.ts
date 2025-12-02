import { NextResponse } from "next/server";
import { getCurrentMatch, getJoinedPlanes, updateCurrentMatch } from "@/lib/match-state";
import type { Plane } from "@/types";
import { broadcastMatchEnd } from "@/lib/websocket";

interface MatchScore {
  planeId: string;
  playerName?: string;
  hits: number;
  hitsTaken: number;
  isDisqualified: boolean;
  isWinner: boolean;
}

/**
 * POST /api/end-match
 *
 * Ends the current match early (or finalizes it) and returns final results.
 * This is server-only, protected by SERVER_TOKEN.
 *
 * Designed so that in the future we can persist a full "match record"
 * (including events and final scores) to a database.
 */
export async function POST(req: Request) {
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { serverToken } = data;

  // Validate server token
  if (serverToken !== process.env.SERVER_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check if there's an existing active match
  const match = getCurrentMatch();
  if (!match) {
    return NextResponse.json(
      { error: "No match active." },
      { status: 404 }
    );
  }

  if (match.status === "ended") {
    return NextResponse.json(
      { error: "The current match has already ended." },
      { status: 410 }
    );
  }

  if (match.status === "waiting") {
    return NextResponse.json(
      { error: "The current match has not yet started." },
      { status: 409 }
    )
  }

  // Compute scores for all planes that joined this match
  const joinedPlanes: Plane[] = getJoinedPlanes();

  const scoredPlanes: MatchScore[] = joinedPlanes.map((plane) => ({
    planeId: plane.planeId,
    playerName: plane.playerName,
    hits: plane.hits ?? 0,
    hitsTaken: plane.hitsTaken ?? 0,
    isDisqualified: plane.isDisqualified ?? false,
    isWinner: false, // filled in below
  }));

  // Sort by hits desc, then hitsTaken asc, per scoring rules
  scoredPlanes.sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits;
    if (a.hitsTaken !== b.hitsTaken) return a.hitsTaken - b.hitsTaken;
    return 0;
  });

  // Determine winners according to tie rules
  if (scoredPlanes.length > 0) {
    const top = scoredPlanes[0];
    const topHits = top.hits;
    const topHitsTaken = top.hitsTaken;

    // All planes matching top hits and top hitsTaken share first place (draw)
    for (const s of scoredPlanes) {
      if (s.hits === topHits && s.hitsTaken === topHitsTaken) {
        s.isWinner = true;
      }
    }
  }

  const endedAt = new Date();

  const resultsPayload = {
    winners: scoredPlanes.filter((p) => p.isWinner).map((p) => p.planeId),
    scores: scoredPlanes,
  };

  // Build a match record snapshot suitable for future DB persistence
/*  const matchRecord = {
    ...match,
    status: "ended" as const,
    endedAt,
    results: resultsPayload,
  };*/

  // TODO: Upload matchRecord and match.events to a database (e.g., insert into "matches" and "events" tables/collections)

  // Update in-memory match state to mark it as ended
  const updatedMatch = updateCurrentMatch((current) => {
    if (!current || current.matchId !== match.matchId) {
      return current;
    }

    return {
      ...current,
      status: "ended",
      // We don't store endedAt on MatchState yet, but it's included in the response
      events: current.events ?? [],
    };
  });

  // Notify clients about final scores
  broadcastMatchEnd(resultsPayload);

  return NextResponse.json({
    success: true,
    match: {
      ...match,
      status: "ended",
      endedAt,
    },
    results: resultsPayload,
    // For debugging / future DB verification you might inspect matchRecord
    /*matchRecord,*/
  });
}
