"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import getServerToken from "@/app/getAuth";
import type { Plane, MatchState, Event } from "@/types";
import { useRouter } from "next/navigation";

export default function MatchPage() {
  const router = useRouter();

  const [duration, setDuration] = useState(420);
  const [maxPlayers, setMaxPlayers] = useState(2);

  const [planes, setPlanes] = useState<Plane[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [ending, setEnding] = useState(false);

  const timeoutRef = useRef<number | null>(null);

  const onlinePlanes = planes.filter((p) => p.isOnline);
  const joinedPlanes = planes.filter((p) => p.isJoined);

  const displayMinutes = Math.floor(duration / 60);
  const displaySeconds = duration % 60;

  // Scores sorted by hits desc, hitsTaken asc
  const scoreboard = [...joinedPlanes].sort((a, b) => {
    const hitsA = a.hits ?? 0;
    const hitsB = b.hits ?? 0;
    if (hitsB !== hitsA) return hitsB - hitsA;
    const takenA = a.hitsTaken ?? 0;
    const takenB = b.hitsTaken ?? 0;
    return takenA - takenB;
  });

  // Read-only settings (same as lobby)
  const updateDuration = (newMinutes: number, newSeconds: number) => {
    // disabled
  };

  const handlePlayersChange = (increment: number) => {
    // disabled
  };

  // Fetch current match state (duration, maxPlayers, events)
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
        setEvents(match.events ?? []);
      } catch (err) {
        console.error("Failed to load match state", err);
      }
    }

    loadMatch();
    const intervalId = window.setInterval(loadMatch, 2000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  // Poll planes for live scores
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

  async function endMatchEarly() {
    if (ending) return;
    setEnding(true);

    try {
      const token = await getServerToken();

      const response = await fetch("/api/end-match", {
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
          "You are not authorized to end the match from here. Try again in the app.",
        );
      } else if (response.status === 404) {
        alert("No active match to end.");
      } else if (response.status === 409 || response.status === 410) {
        alert(data.error ?? "Match is not in a state that can be ended.");
      } else if (!response.ok) {
        alert("An unknown error occurred while ending the match.");
      } else if (data.success === true || data.success === "true") {
        alert("Match ended.");
        // todo: display final results. Perhaps make a new page for this.
        router.push("/");
      }

      console.log("End match response:", JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("An unknown error occurred while ending the match.");
    }

    timeoutRef.current = window.setTimeout(() => {
      setEnding(false);
    }, 1500);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const formatEvent = (event: Event): string => {
    const time = new Date(event.timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    switch (event.type) {
      case "join":
        return `[${time}] Plane ${event.planeId} joined the match`;
      case "leave":
        return `[${time}] Plane ${event.planeId} left the match`;
      case "hit":
        return `[${time}] Plane ${event.planeId} hit plane ${event.targetId}`;
      case "disqualify":
        return `[${time}] Plane ${event.planeId} was disqualified`;
      default:
        return `[${time}] Event`;
    }
  };

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

      <div className="flex-1 grid grid-cols-[minmax(180px,1fr)_minmax(320px,1.4fr)_minmax(220px,1.1fr)] gap-6 items-stretch">
        {/* Online planes (left) */}
        <section className="bg-navy/80 backdrop-blur-md border-2 border-skyblue/30 rounded-3xl p-4 flex flex-col shadow-lg shadow-navy/50 overflow-hidden">
          <h2 className="text-xl text-white font-bold mb-2 border-b border-skyblue/20 pb-2 text-center">
            Online Planes
          </h2>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {onlinePlanes.length === 0 && (
              <p className="text-skyblue/60 text-sm text-center mt-4">
                No planes online.
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
                      In Match
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

        {/* Center: match settings (read-only) + controls + events */}
        <div className="flex flex-col items-stretch justify-start gap-4 w-full">
          {/* Match Settings (read-only) */}
          <div className="bg-navy/80 backdrop-blur-md border-2 border-skyblue/30 rounded-3xl p-6 w-full flex flex-col gap-4 shadow-lg shadow-navy/50 opacity-90">
            <div className="flex items-center justify-between mb-1 border-b border-skyblue/20 pb-2">
              <h2 className="text-2xl text-white font-bold">Match Settings</h2>
              {/* Admin panel button (disabled for now) */}
              <button
                type="button"
                disabled
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-skyblue/30 text-skyblue/60 bg-darkernavy/60 cursor-not-allowed"
              >
                Admin Panel (coming soon)
              </button>
            </div>

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
              <div className="flex items-center gap-3 bg-darkernavy/50 p-2 rounded-xl border border-skyblue/10 opacity-80">
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

            {/* End match early button */}
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={endMatchEarly}
                disabled={ending}
                className={`px-6 py-3 rounded-2xl text-sm font-semibold border-2 text-white shadow-md transition-all ${
                  ending
                    ? "bg-maroon/70 border-maroon/60 cursor-not-allowed opacity-70"
                    : "bg-red-700 border-maroon hover:bg-red-600 hover:scale-105 cursor-pointer"
                }`}
              >
                {ending ? "Ending match..." : "End Match Early"}
              </button>
            </div>
          </div>

          {/* Events list */}
          <div className="bg-navy/80 backdrop-blur-md border-2 border-skyblue/30 rounded-3xl px-4 py-3 flex flex-col shadow-lg shadow-navy/50 overflow-hidden flex-1 min-h-[220px]">
            <h2 className="text-xl text-white font-bold mb-2 border-b border-skyblue/20 pb-1 text-center">
              Match Events
            </h2>
            <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 text-xs">
              {(!events || events.length === 0) && (
                <p className="text-skyblue/60 text-center mt-4">
                  No events yet.
                </p>
              )}
              {events &&
                events
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() -
                      new Date(b.timestamp).getTime(),
                  )
                  .map((event, idx) => (
                    <div
                      key={`${event.timestamp}-${event.planeId}-${idx}`}
                      className="px-2 py-1 rounded-lg bg-darkernavy/60 border border-skyblue/10 text-skyblue/90"
                    >
                      {formatEvent(event)}
                    </div>
                  ))}
            </div>
          </div>
        </div>

        {/* Right: live scores */}
        <section className="bg-navy/80 backdrop-blur-md border-2 border-skyblue/30 rounded-3xl p-4 flex flex-col shadow-lg shadow-navy/50 overflow-hidden">
          <h2 className="text-xl text-white font-bold mb-2 border-b border-skyblue/20 pb-2 text-center">
            Live Scores
          </h2>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {scoreboard.length === 0 && (
              <p className="text-skyblue/60 text-sm text-center mt-4">
                No players in match.
              </p>
            )}
            {scoreboard.map((plane, index) => (
              <div
                key={plane.planeId}
                className="rounded-xl border border-skyblue/20 bg-darkernavy/60 px-3 py-2 text-sm flex flex-col gap-0.5"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-skyblue">
                    {index + 1}. {plane.playerName || "Unnamed Pilot"}
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
                <div className="flex justify-between text-[11px] text-skyblue/80 mt-1">
                  <span>Hits: {plane.hits ?? 0}</span>
                  <span>Hits Taken: {plane.hitsTaken ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}