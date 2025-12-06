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
  const [timeRemaining, setTimeRemaining] = useState(420);

  const [planes, setPlanes] = useState<Plane[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [ending, setEnding] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const timeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const onlinePlanes = planes.filter((p) => p.isOnline);
  const joinedPlanes = planes.filter((p) => p.isJoined);

  const displayMinutes = Math.floor(timeRemaining / 60);
  const displaySeconds = timeRemaining % 60;

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
        
        // Calculate time remaining based on match status and createdAt
        if (match.status === "active" && match.createdAt) {
          const elapsed = Math.floor((Date.now() - new Date(match.createdAt).getTime()) / 1000);
          const remaining = Math.max(0, match.duration - elapsed);
          setTimeRemaining(remaining);
        } else {
          setTimeRemaining(match.duration);
        }
      } catch (err) {
        console.error("Failed to load match state", err);
      }
    }

    loadMatch();
    const intervalId = window.setInterval(loadMatch, 2000);

    // Countdown timer that updates every second
    countdownIntervalRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
      }
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

  // Trigger fade-in animation on mount
  useEffect(() => {
    setIsLoaded(true);
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
        alert("You are not authorized to end the match from here. Try again in the app.");
      } else if (response.status === 404) {
        alert("No active match to end.");
      } else if (response.status === 409 || response.status === 410) {
        alert(data.error ?? "Match is not in a state that can be ended.");
      } else if (!response.ok) {
        alert("An unknown error occurred while ending the match.");
      } else if (data.success === true || data.success === "true") {
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

  async function kickPlane(planeId: string) {
    if (kickingId) return;
    setKickingId(planeId);

    try {
      const token = await getServerToken();

      const response = await fetch("/api/kick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planeId,
          serverToken: token,
        }),
      });

      const data = await response.json();

      if (response.status === 403) {
        alert("You are not authorized to kick or disqualify planes from here. Try again in the app.");
      } else if (!response.ok) {
        alert(data.error ?? "Failed to kick or disqualify plane.");
      } else if (data.success === true || data.success === "true") {
        // Plane kicked/disqualified successfully
      }

      console.log("Kick plane response:", JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("An unknown error occurred while kicking the plane.");
    } finally {
      setKickingId(null);
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  const getEventIcon = (type: string): string => {
    switch (type) {
      case "join":
        return "[JOIN]";
      case "leave":
        return "[LEFT]";
      case "hit":
        return "[HIT]";
      case "disqualify":
        return "[DQ]";
      default:
        return "[•]";
    }
  };

  const getEventColor = (type: string): string => {
    switch (type) {
      case "join":
        return "text-green-400 bg-green-900/30 border-green-500/40";
      case "leave":
        return "text-skyblue/70 bg-skyblue/10 border-skyblue/20";
      case "hit":
        return "text-yellow-300 bg-yellow-900/40 border-yellow-500/50";
      case "disqualify":
        return "text-red-400 bg-red-900/40 border-red-500/50";
      default:
        return "text-skyblue/90 bg-darkernavy/60 border-skyblue/10";
    }
  };

  const formatEvent = (event: Event): { time: string; message: string; icon: string; color: string } => {
    const time = new Date(event.timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    let message = "";
    switch (event.type) {
      case "join":
        message = `Plane ${event.planeId} joined the match`;
        break;
      case "leave":
        message = `Plane ${event.planeId} left the match`;
        break;
      case "hit":
        message = `Plane ${event.planeId} hit plane ${event.targetId}`;
        break;
      case "disqualify":
        message = `Plane ${event.planeId} was disqualified`;
        break;
      default:
        message = "Event";
    }

    return {
      time,
      message,
      icon: getEventIcon(event.type),
      color: getEventColor(event.type),
    };
  };

  const getRankIcon = (rank: number): string => {
    // Return empty string - ranking handled by # badge
    return "";
  };

  const getRankStyle = (rank: number): string => {
    switch (rank) {
      case 1:
        return "border-gold/60 bg-gradient-to-r from-gold/20 via-gold/10 to-transparent shadow-[0_0_20px_rgba(203,163,94,0.5)]";
      case 2:
        return "border-skyblue/50 bg-gradient-to-r from-skyblue/15 via-skyblue/8 to-transparent shadow-[0_0_15px_rgba(153,207,255,0.3)]";
      case 3:
        return "border-orange-400/40 bg-gradient-to-r from-orange-400/10 via-orange-400/5 to-transparent shadow-[0_0_10px_rgba(251,146,60,0.2)]";
      default:
        return "border-skyblue/30 bg-gradient-to-r from-darkernavy/90 via-darkernavy/70 to-skyblue/20";
    }
  };

  const isTimeRunningOut = timeRemaining <= 60;
  const isTimeCritical = timeRemaining <= 30;

  useEffect(() => {
    // Allow scrolling on match page
    document.body.style.overflowY = 'auto';
    return () => {
      document.body.style.overflowY = 'hidden';
    };
  }, []);

  return (
    <main
      role="main"
      className="w-full px-6 flex flex-col gap-6 min-h-screen relative"
    >
      {/* Background overlay - gradient overlay dims the background planes but keeps header visible */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-80"
        style={{
          background: 'linear-gradient(-45deg, #000000, #000000, #ad0000, #ad0000, #000000, #000000)'
        }}
      ></div>
      
      <div className={`flex flex-col justify-center items-center max-w-[1920px] mx-auto w-full py-6 my-auto relative z-10 transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <header className="text-center self-center mb-6 relative z-10">
        <Image
          src="/logo_text.svg"
          alt="Aeroduel"
          width={493 * 2}
          height={64 * 2}
          className="drop-shadow-[0_0_10px_rgba(173,0,0,0.3)]"
          style={{ animation: 'pulse-logo-glow-red 1.5s ease-in-out infinite' }}
        />
        <Image
          src="/server-text.svg"
          alt="Server"
          width={270}
          height={45}
          className="mt-3 mb-4 mx-auto drop-shadow-[0_0_10px_rgba(173,0,0,0.3)]"
          style={{ animation: 'pulse-logo-glow-red 1.5s ease-in-out infinite' }}
        />
        <p className="text-skyblue drop-shadow-[0_1.2px_1.2px_var(--color-navy)] text-sm">
          Aeroduel match hosting server
        </p>
      </header>

      {/* HUD-style Countdown Timer */}
      <div className="flex justify-center mb-2">
        <div
          className={`relative px-8 py-4 rounded-2xl border-2 backdrop-blur-md transition-all duration-300 ${
            isTimeCritical
              ? "bg-red-900/40 border-red-500/70 shadow-[0_0_30px_rgba(184,12,12,0.6)] animate-pulse"
              : isTimeRunningOut
              ? "bg-orange-900/30 border-orange-500/60 shadow-[0_0_20px_rgba(251,146,60,0.4)]"
              : "bg-navy/60 border-skyblue/50 shadow-[0_0_15px_rgba(153,207,255,0.3)]"
          }`}
        >
          <div className="text-center">
            <div className="text-xs text-skyblue/70 uppercase tracking-widest mb-1 font-semibold">
              Time Remaining
            </div>
            <div
              className={`text-6xl font-mono font-bold transition-colors duration-300 ${
                isTimeCritical
                  ? "text-red-300"
                  : isTimeRunningOut
                  ? "text-orange-300"
                  : "text-gold"
              }`}
              style={{ textShadow: "0 0 20px currentColor" }}
            >
              {String(displayMinutes).padStart(2, "0")}:
              {String(displaySeconds).padStart(2, "0")}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full grid grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)_minmax(0,1.6fr)] gap-6 items-stretch relative z-10">
        {/* Online planes (left) */}
        <section 
          className="bg-navy/80 backdrop-blur-md border-2 border-red-500/70 rounded-3xl p-5 flex flex-col shadow-xl overflow-hidden"
          style={{ animation: 'battle-glow-red 1.5s ease-in-out infinite' }}
        >
          <div className="flex items-center justify-center gap-2 mb-3 border-b border-skyblue/20 pb-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
            <h2 className="text-xl text-white font-bold text-center uppercase tracking-wider">
              Active Fleet
            </h2>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {onlinePlanes.length === 0 && (
              <div className="text-center mt-8 py-8">
                <p className="text-skyblue/70 text-sm font-medium mb-1">No planes online</p>
                <p className="text-skyblue/50 text-xs">Waiting for connections...</p>
              </div>
            )}
            {onlinePlanes.map((plane, index) => {
              const iconSrc =
                index % 2 === 0 ? "/plane-right.svg" : "/plane-white-right.svg";

              return (
                <div
                  key={plane.planeId}
                  className="group rounded-2xl border border-skyblue/30 bg-gradient-to-r from-darkernavy/90 via-darkernavy/70 to-skyblue/20 px-5 py-4 text-base flex items-center gap-4 shadow-md shadow-navy/60 min-h-[110px] transition-all duration-300 hover:border-skyblue/50 hover:shadow-lg hover:shadow-skyblue/20"
                >
                  <div className="flex-shrink-0 relative">
                    <Image
                      src={iconSrc}
                      alt="Plane icon"
                      width={64}
                      height={64}
                      className="drop-shadow-[0_0_10px_rgba(153,207,255,0.8)] transition-transform duration-300 group-hover:scale-110"
                    />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-navy shadow-[0_0_6px_rgba(74,222,128,1)] animate-pulse"></div>
                  </div>
                  <div className="flex flex-col flex-1 gap-1.5">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-skyblue text-base truncate">
                        {plane.playerName || "Unlinked Plane"}
                      </span>
                      {plane.isJoined && (
                        <span className="text-xs text-gold font-bold px-2.5 py-1 rounded-full bg-gold/20 border border-gold/40 shadow-[0_0_8px_rgba(203,163,94,0.4)]">
                          IN MATCH
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs text-skyblue/70 break-all font-mono">
                        ID: {plane.planeId}
                      </span>
                      {plane.esp32Ip && (
                        <span className="text-xs text-skyblue/60 font-mono block">
                          IP: {plane.esp32Ip}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Center: controls + events */}
        <div className="flex flex-col items-stretch justify-start gap-4 w-full">
          {/* End match button */}
          <div 
            className="bg-navy/80 backdrop-blur-md border-2 border-red-500/70 rounded-3xl p-5 w-full flex justify-center shadow-xl"
            style={{ animation: 'battle-glow-red 1.5s ease-in-out infinite' }}
          >
            <button
              type="button"
              onClick={endMatchEarly}
              disabled={ending}
              className={`px-8 py-3 rounded-xl text-base font-bold border-2 text-white shadow-lg transition-all duration-200 uppercase tracking-wider focus:outline-none focus:ring-4 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-navy ${
                ending
                  ? "bg-maroon/70 border-maroon/60 cursor-not-allowed opacity-70"
                  : "bg-gradient-to-r from-red-700 to-red-800 border-maroon/80 hover:from-red-600 hover:to-red-700 hover:scale-105 hover:shadow-xl hover:shadow-red-900/50 active:scale-95 cursor-pointer"
              }`}
            >
              {ending ? "Ending Match..." : "End Match"}
            </button>
          </div>

          {/* Events list */}
          <div 
            className="bg-navy/80 backdrop-blur-md border-2 border-red-500/70 rounded-3xl px-4 py-3 flex flex-col shadow-xl overflow-hidden flex-1 min-h-[220px]"
            style={{ animation: 'battle-glow-red 1.5s ease-in-out infinite' }}
          >
            <h2 className="text-lg text-white font-bold mb-3 border-b border-skyblue/20 pb-2 text-center uppercase tracking-wider">
              Match Events
            </h2>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 text-xs">
              {(!events || events.length === 0) && (
                <div className="text-center mt-8 py-8">
                  <p className="text-skyblue/70 text-sm font-medium mb-1">No events yet</p>
                  <p className="text-skyblue/50 text-xs">Match activity will appear here</p>
                </div>
              )}
              {events &&
                events
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.timestamp).getTime() -
                      new Date(a.timestamp).getTime(),
                  )
                  .slice(0, 50) // Limit to last 50 events
                  .map((event, idx) => {
                    const formatted = formatEvent(event);
                    return (
                      <div
                        key={`${event.timestamp}-${event.planeId}-${idx}`}
                        className={`px-3 py-2 rounded-lg border ${formatted.color} transition-all duration-200 hover:scale-[1.01] hover:shadow-sm`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-base font-bold flex-shrink-0">{formatted.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-mono text-skyblue/70">{formatted.time}</span>
                            </div>
                            <div className="text-xs font-medium leading-tight">{formatted.message}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>

        {/* Right: live scores (keep kick button here) */}
        <section 
          className="bg-navy/80 backdrop-blur-md border-2 border-red-500/70 rounded-3xl p-5 flex flex-col shadow-xl overflow-hidden"
          style={{ animation: 'battle-glow-red 1.5s ease-in-out infinite' }}
        >
          <div className="flex items-center justify-center gap-2 mb-3 border-b border-skyblue/20 pb-3">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.8)]"></div>
            <h2 className="text-xl text-white font-bold text-center uppercase tracking-wider">
              Leaderboard
            </h2>
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.8)]"></div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {scoreboard.length === 0 && (
              <div className="text-center mt-8 py-8">
                <p className="text-skyblue/70 text-sm font-medium mb-1">No players in match</p>
                <p className="text-skyblue/50 text-xs">Waiting for participants...</p>
              </div>
            )}
            {scoreboard.map((plane, index) => {
              const rank = index + 1;
              const iconSrc =
                index % 2 === 0 ? "/plane-right.svg" : "/plane-white-right.svg";
              const rankStyle = getRankStyle(rank);

              return (
                <div
                  key={plane.planeId}
                  className={`group rounded-2xl border-2 ${rankStyle} px-5 py-4 text-base flex items-center gap-4 shadow-md min-h-[120px] transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}
                >
                  {/* Rank Badge */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <div className={`text-lg font-bold font-mono ${
                      rank === 1 ? "text-gold" : 
                      rank === 2 ? "text-skyblue" : 
                      rank === 3 ? "text-orange-400" : 
                      "text-skyblue/70"
                    }`}>
                      #{rank}
                    </div>
                  </div>

                  {/* Plane Icon */}
                  <div className="flex-shrink-0 relative">
                    <Image
                      src={iconSrc}
                      alt="Plane icon"
                      width={64}
                      height={64}
                      className={`drop-shadow-[0_0_10px_${
                        rank === 1 ? "rgba(203,163,94,0.8)" :
                        rank === 2 ? "rgba(153,207,255,0.8)" :
                        rank === 3 ? "rgba(251,146,60,0.8)" :
                        "rgba(251,191,36,0.7)"
                      }] transition-transform duration-300 group-hover:scale-110`}
                    />
                  </div>

                  {/* Player Info & Stats */}
                  <div className="flex flex-col flex-1 gap-2 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <span className={`font-bold truncate ${
                        rank === 1 ? "text-gold text-base" :
                        rank === 2 ? "text-skyblue text-base" :
                        rank === 3 ? "text-orange-300 text-base" :
                        "text-skyblue text-sm"
                      }`}>
                        {plane.playerName || "Unnamed Pilot"}
                      </span>
                      {plane.isDisqualified && (
                        <span className="text-xs text-red-400 font-bold px-2 py-1 rounded-full bg-red-900/50 border border-red-500/50 shadow-[0_0_6px_rgba(239,68,68,0.5)]">
                          DQ
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-skyblue/70 break-all font-mono">
                      ID: {plane.planeId}
                    </span>
                    <div className="flex justify-between items-center text-xs font-semibold mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-green-400">Hits: </span>
                        <span className="text-white font-bold text-sm">{plane.hits ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-400">Taken: </span>
                        <span className="text-white font-bold text-sm">{plane.hitsTaken ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Kick Button */}
                  <button
                    type="button"
                    onClick={() => kickPlane(plane.planeId)}
                    disabled={kickingId === plane.planeId}
                    className={`ml-2 px-3 py-2 text-xs font-bold rounded-lg border transition-all duration-200 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
                      kickingId === plane.planeId
                        ? "border-red-500/40 bg-red-900/40 text-red-200/70 cursor-not-allowed"
                        : "border-red-500/70 bg-red-900/70 text-red-100 hover:bg-red-700 hover:scale-105 hover:shadow-lg hover:shadow-red-900/50 active:scale-95 shadow-md"
                    }`}
                  >
                    {kickingId === plane.planeId ? "Kicking..." : "Kick"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      </div>
    </main>
  );
}
