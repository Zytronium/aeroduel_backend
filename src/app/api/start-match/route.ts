// Returns aeroduel.local-based URLs by default, with a fallback to the detected local IP.

import { NextResponse } from "next/server";
import { MatchState } from '@/types';
import { getCurrentMatch, updateCurrentMatch } from '@/lib/match-state';
import { broadcastMatchUpdate } from "@/lib/websocket";
import { scheduleMatchEndTimer } from "@/lib/match-timer";

export async function POST(req: Request) {
  let data;

  try {
    data = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // TODO:
  //  - send websocket update to clients to say the match has begun
  //  - start a timer to end the match after the specified duration (note: this may be difficult as we can't run code after returning a response... can we?)

  const { serverToken } = data;

  // Validate server token
  if (serverToken !== process.env.SERVER_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Check if there's already an active match on this server
  let currentMatch: MatchState | null = getCurrentMatch();
  if (!currentMatch) {
    return NextResponse.json(
      { error: "There's no current match." },
      { status: 404 }
    )
  }
  if (currentMatch.status !== "waiting") {
    return NextResponse.json({
        error: currentMatch.status === "active" ? "The match is already in progress." : "The current match has already ended. Please create a new match and allow players to join first.",
      },
      { status: 409 }
    );
  }

  if (currentMatch.matchPlanes.length < 2) {
    return NextResponse.json(
      { error: "There must be at least 2 joined players to start the match."},
      { status: 409 }
    )
  }

  // We could double-check that match params like duration & max players are inside their limits, but that would be redundant. If you figured out a way around the restrictions, then you win. After all, we built Aeroduel to be hacked on.


    // Schedule automatic end of match after its duration
    const endsAt = scheduleMatchEndTimer(
        currentMatch!.matchId,
        currentMatch!.duration,
    );

  currentMatch = updateCurrentMatch(() => ({
    matchId: currentMatch!.matchId,
    status: "active",
    createdAt: currentMatch!.createdAt,
    endsAt,
    matchType: currentMatch!.matchType,
    duration: currentMatch!.duration,
    matchPlanes: currentMatch!.matchPlanes,
    maxPlayers: currentMatch!.maxPlayers,
    serverUrl: currentMatch!.serverUrl,
    wsUrl: currentMatch!.wsUrl,
    events: currentMatch!.events,
  }));

  // Notify all connected mobiles about the new match status/scores
  broadcastMatchUpdate();

  return NextResponse.json({
    success: true,
    endsAt,
  });
}
