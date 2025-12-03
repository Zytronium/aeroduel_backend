"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import getServerToken from "@/app/getAuth";
import { useRouter } from "next/navigation";

interface Plane {
  planeId: string;
  userId: string;
  esp32Ip?: string;
  playerName?: string;
  registeredAt: string;
  hits?: number;
  hitsTaken?: number;
  isOnline: boolean;
  isJoined: boolean;
  isDisqualified: boolean;
}

interface MatchState {
  matchId: string;
  status: "waiting" | "active" | "ended";
  matchType: "timed";
  duration: number;
  maxPlayers: number;
}

export default function LobbyPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  const [duration, setDuration] = useState(420);
  const [maxPlayers, setMaxPlayers] = useState(2);

  const [planes, setPlanes] = useState<Plane[]>([]);
  const timeoutRef = useRef<number | null>(null);

  // Derived values
  const onlinePlanes = planes.filter((p) => p.isOnline);
  const joinedPlanes = planes.filter((p) => p.isJoined);

  const displayMinutes = Math.floor(duration / 60);
  const displaySeconds = duration % 60;

  // Match settings are read-only here, so no-op updaters (keep UI identical)
  const updateDuration = (newMinutes: number, newSeconds: number) => {
    // Disabled: do nothing
  };

  const handlePlayersChange = (increment: number) => {
    // Disabled: do nothing
  };

  // Fetch current match to populate duration/maxPlayers for display
  useEffect(() => {
    let active = true;

    async function loadMatch() {
      try {
        const res = await fetch("/api/match");
        if (!res.ok) return;
        const match: MatchState = await res.json();
        if (!active) return;

        setDuration(match.duration);
        setMaxPlayers(match.maxPlayers);
      } catch (err) {
        console.error("Failed to load match state", err);
      }
    }

    loadMatch();
    return () => {
      active = false;
    };
  }, []);

  // Poll planes list for live lobby updates
  useEffect(() => {
    let cancelled = false;

    async function fetchPlanes() {
      try {
        const res = await fetch("/api/planes");
        if (!res.ok) return;
        const data: Plane[] = await res.json();
        if (!cancelled) {
          setPlanes(data);
        }
      } catch (err) {
        console.error("Failed to fetch planes", err);
      }
    }

    fetchPlanes();
    const intervalId = window.setInterval(fetchPlanes, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  async function startMatch() {
    if (starting) return;

    setStarting(true);

    try {
      const token = await getServerToken();

      const response = await fetch("/api/start-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serverToken: token,
        }),
      });

      const data = await response.json();

      if (response.status === 403) {
        alert(
          "You are not authorized to start a match from here. Try again in the app.",
        );
      } else if (response.status === 404) {
        alert("There's no current match. Try creating a new match first.");
      } else if (response.status === 409) {
        alert(
          data.error ??
          "The match is already in progress or cannot be started right now.",
        );
      } else if (!response.ok) {
        alert("An unknown error occurred");
      } else if (data.success === true || data.success === "true") {
        alert("Match started!");
        // In the future we can navigate to /match here
      }

      console.log("Start match response:", JSON.stringify(data));
      setStarting(false);
      await router.push("/match");
    } catch (err) {
      console.error(err);
      setStarting(false);
      alert("An unknown error occurred");
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <main
      role="main"
      className="w-full max-w-6xl mx-auto p-6 flex flex-col gap-6 min-h-screen"
    >
      <header className="text-center mt-8">
        <Image
          src="/logo_text.svg"
          alt="Aeroduel"
          width={493 * 2}
          height={64 * 2}
        />
        <Image
          src="/server-text.svg"
          alt="Server"
          width={270}
          height={45}
          className="mt-4 mb-8 mx-auto"
        />
        <p className="text-skyblue drop-shadow-[0_1.2px_1.2px_var(--color-navy)]">
          Aeroduel match hosting server
        </p>
      </header>

      <div className="flex-1 grid grid-cols-[minmax(180px,1fr)_minmax(320px,1.4fr)_minmax(200px,1fr)] gap-6 items-stretch">
        {/* Online planes (left) */}
        <section className="bg-navy/80 backdrop-blur-md border-2 border-skyblue/30 rounded-3xl p-4 flex flex-col shadow-lg shadow-navy/50 overflow-hidden">
          <h2 className="text-xl text-white font-bold mb-2 border-b border-skyblue/20 pb-2 text-center">
            Online Planes
          </h2>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {onlinePlanes.length === 0 && (
              <p className="text-skyblue/60 text-sm text-center mt-4">
                No planes online yet.
              </p>
            )}
            {onlinePlanes.map((plane) => (
              <div
                key={plane.planeId}
                className="rounded-xl border border-skyblue/20 bg-darkernavy/60 px-3 py-2 text-sm flex flex-col gap-0.5"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-skyblue">
                    {plane.playerName || "Unlinked Plane"}
                  </span>
                  {plane.isJoined && (
                    <span className="text-xs text-gold font-semibold">
                      Joined
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-skyblue/60 break-all">
                  ID: {plane.planeId}
                </span>
                {plane.esp32Ip && (
                  <span className="text-[11px] text-skyblue/60">
                    IP: {plane.esp32Ip}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Center: match settings (read-only) + Start Match button */}
        <div className="flex flex-col items-center justify-center gap-6 w-full">
          {/* Match Settings (read-only) */}
          <div className="bg-navy/80 backdrop-blur-md border-2 border-skyblue/30 rounded-3xl p-8 w-full max-w-md flex flex-col gap-6 shadow-lg shadow-navy/50 opacity-80">
            <h2 className="text-2xl text-white font-bold text-center mb-2 border-b border-skyblue/20 pb-4">
              Match Settings
            </h2>

            {/* Duration Control (disabled) */}
            <div className="flex flex-row items-center justify-between">
              <span className="text-lg text-skyblue font-bold uppercase tracking-wider">
                Match Duration
              </span>
              <div className="flex items-center gap-2 bg-darkernavy/50 p-2 rounded-xl border border-skyblue/10">
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={displayMinutes}
                    disabled
                    onChange={(e) =>
                      updateDuration(Number(e.target.value), displaySeconds)
                    }
                    className="w-16 text-center bg-transparent text-2xl font-mono text-white/70 focus:outline-none appearance-none cursor-not-allowed"
                  />
                  <span className="text-xs text-skyblue/60">MIN</span>
                </div>
                <span className="text-2xl text-skyblue/50 pb-4">:</span>
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={displaySeconds.toString().padStart(2, "0")}
                    disabled
                    onChange={(e) =>
                      updateDuration(displayMinutes, Number(e.target.value))
                    }
                    onBlur={() => updateDuration(displayMinutes, displaySeconds)}
                    className="w-16 text-center bg-transparent text-2xl font-mono text-white/70 focus:outline-none appearance-none cursor-not-allowed"
                  />
                  <span className="text-xs text-skyblue/60">SEC</span>
                </div>
              </div>
            </div>

            {/* Max Players Control (disabled) */}
            <div className="flex flex-row items-center justify-between">
              <span className="text-lg text-skyblue font-bold uppercase tracking-wider">
                Max Players
              </span>
              <div className="flex items-center gap-3 bg-darkernavy/50 p-2 rounded-xl border border-skyblue/10 opacity-70">
                <button
                  onClick={() => handlePlayersChange(-1)}
                  disabled
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-skyblue/10 text-skyblue text-2xl font-bold cursor-not-allowed opacity-40"
                >
                  -
                </button>
                <span className="text-2xl font-mono text-white/80 w-8 text-center">
                  {maxPlayers}
                </span>
                <button
                  onClick={() => handlePlayersChange(1)}
                  disabled
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-skyblue/10 text-skyblue text-2xl font-bold cursor-not-allowed opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Start Match button */}
          <button
            type="button"
            onClick={startMatch}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                startMatch();
              }
            }}
            disabled={starting}
            aria-pressed={starting}
            aria-busy={starting}
            className={`relative transition-all ${
              !starting
                ? "hover:brightness-110 hover:scale-105 cursor-pointer"
                : ""
            }`}
          >
            <Image
              src={starting ? "/starting-btn.svg" : "/start-match-btn.svg"}
              alt={starting ? "Starting match..." : "Start Match"}
              width={444}
              height={102}
              className={starting ? "opacity-60 backdrop-blur-sm" : ""}
            />
          </button>
        </div>

        {/* Joined planes (right) */}
        <section className="bg-navy/80 backdrop-blur-md border-2 border-skyblue/30 rounded-3xl p-4 flex flex-col shadow-lg shadow-navy/50 overflow-hidden">
          <h2 className="text-xl text-white font-bold mb-2 border-b border-skyblue/20 pb-2 text-center">
            Joined Planes
          </h2>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {joinedPlanes.length === 0 && (
              <p className="text-skyblue/60 text-sm text-center mt-4">
                Waiting for players to join...
              </p>
            )}
            {joinedPlanes.map((plane) => (
              <div
                key={plane.planeId}
                className="rounded-xl border border-skyblue/20 bg-darkernavy/60 px-3 py-2 text-sm flex flex-col gap-0.5"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-skyblue">
                    {plane.playerName || "Unnamed Pilot"}
                  </span>
                  {plane.isDisqualified && (
                    <span className="text-[11px] text-red-400 font-semibold">
                      DQ
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-skyblue/60 break-all">
                  ID: {plane.planeId}
                </span>
                <div className="flex justify-between text-[11px] text-skyblue/70 mt-1">
                  <span>Hits: {plane.hits ?? 0}</span>
                  <span>Taken: {plane.hitsTaken ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}