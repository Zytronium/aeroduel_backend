// Returns aeroduel.local-based URLs by default, with a fallback to the detected local IP.

import { NextResponse } from "next/server";
import { MatchState } from '@/types';
import { getCurrentMatch, updateCurrentMatch } from '@/lib/match-state';
import { generateGamePin, generateMatchId, getLocalIpAddress } from "@/lib/utils";

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

  // Validate server token
  if (data.serverToken !== process.env.SERVER_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Check if there's already an active match on this server
  let currentMatch: MatchState | null = getCurrentMatch();
  if (currentMatch && currentMatch.status !== "ended") {
    return NextResponse.json({
        error: "A match is already in progress",
        existingMatch: {
          matchId: currentMatch.matchId,
          gamePin: currentMatch.gamePin,
          status: currentMatch.status
        }
      },
      { status: 409 }
    );
  }

  // Validate request data
  const {
    duration = 7 * 60, // 7 minutes (420 seconds)
    maxPlayers = 2
  } = data;

  if (typeof duration !== "number" || duration < 30 || duration > 1800) {
    return NextResponse.json(
      { error: "Duration must be a valid number between 30 seconds and 30 minutes (1800 seconds)" },
      { status: 400 }
    );
  }

  if (typeof maxPlayers !== "number" || maxPlayers < 2 || maxPlayers > 16) {
    return NextResponse.json(
      { error: `maxPlayers must be a valid number between 2 and 16${maxPlayers > 25 ? ` (and ${maxPlayers} planes is way too many to safely be in the air at once during a game like this!)` : ""}` },
      { status: 400 }
    );
  }

  // Get local network info
  const localIp = getLocalIpAddress();
  if (!localIp) {
    return NextResponse.json(
      { error: "Could not detect local IP address. Ensure you're connected to WiFi." },
      { status: 500 }
    );
  }

  // Set server URL and WebSocket URL
  const port: string | number = process.env.PORT || 45045; // Port 45045 because it has an extremely low chance of being used by other apps
                                                           // If you change the port, a port in range 45000–48000 is recommended.
  // Prefer mDNS name aeroduel.local for discovery; fall back to local IP when necessary.
  const mdnsName = process.env.MDNS_NAME || "aeroduel.local";
  const serverHost = mdnsName || localIp;

  const serverUrl = `http://${serverHost}:${port}`;
  const wsUrl = `ws://${serverHost}:${port}`;

  // Create new match
  const matchId = generateMatchId();
  const gamePin = generateGamePin();

  currentMatch = updateCurrentMatch(() => ({
    matchId,
    gamePin,
    status: "waiting",
    createdAt: new Date(),
    matchType: "timed",
    duration,
    onlinePlanes: [],
    maxPlayers,
    serverUrl,
    wsUrl,
    localIp, // for clients that cannot resolve mDNS
    matchPlanes: [],
    events: []
  }));

  const qrCodeData = `aeroduel://join?host=${encodeURIComponent(serverHost)}&port=${port}&pin=${gamePin}`;

  return NextResponse.json({
    success: true,
    match: {
      matchId,
      gamePin,
      qrCodeData,
      status: "waiting",
      matchType: "timed",
      duration,
      maxPlayers,
      serverUrl,
      wsUrl,
      matchPlanes: [],
      localIp // useful fallback for diagnostic UI / QR payloads
    }
  });
}
