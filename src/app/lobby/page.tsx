"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import getServerToken from "@/app/getAuth";
import { useRouter } from "next/navigation";
import type { Plane, MatchState } from "@/types";

export default function LobbyPage() {
  const router = useRouter();

  const [starting, setStarting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);

  const [duration, setDuration] = useState(420);
  const [maxPlayers, setMaxPlayers] = useState(2);

  const [planes, setPlanes] = useState<Plane[]>([]);
  const timeoutRef = useRef<number | null>(null);

  // Derived values
  const onlinePlanes = planes.filter((p) => p.isOnline);
  const joinedPlanes = planes.filter((p) => p.isJoined);

  const displayMinutes = Math.floor(duration / 60);
  const displaySeconds = duration % 60;

  const getPlaneIcon = (index: number) =>
    index % 2 === 0 ? "/plane-right.svg" : "/plane-white-right.svg";

  // Read-only settings
  const updateDuration = (newMinutes: number, newSeconds: number) => {
    // disabled
  };

  const handlePlayersChange = (increment: number) => {
    // disabled
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
          "You are not authorized to start a match from here. Try again in the app."
        );
      } else if (response.status === 404) {
        alert("There's no current match. Try creating a new match first.");
      } else if (response.status === 409) {
        alert(
          data.error ??
            "The match is already in progress or cannot be started right now."
        );
      } else if (!response.ok) {
        alert("An unknown error occurred");
      } else if (data.success === true || data.success === "true") {
        // Start fade-out transition
        setIsTransitioning(true);
        // Wait for fade animation, then navigate
        setTimeout(() => {
          router.push("/match");
        }, 500);
        return; // Don't reset starting state during transition
      }

      console.log("Start match response:", JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("An unknown error occurred");
    } finally {
      setStarting(false);
    }
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
        alert(
          "You are not authorized to kick planes from here. Try again in the app."
        );
      } else if (!response.ok) {
        alert(data.error ?? "Failed to kick plane.");
      } else if (data.success === true || data.success === "true") {
        // Plane kicked successfully
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
    // Allow scrolling on lobby page
    document.body.style.overflowY = "auto";
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.body.style.overflowY = "hidden";
    };
  }, []);

  const renderPlaneCard = (
    plane: Plane,
    index: number,
    variant: "online" | "joined"
  ) => {
    const iconSrc = getPlaneIcon(index);
    const isKicking = kickingId === plane.planeId;

    return (
      <div
        key={plane.planeId}
        className="w-full rounded-2xl border border-skyblue/30 bg-gradient-to-r from-darkernavy/90 via-darkernavy/70 to-skyblue/25 px-6 py-5 text-lg flex flex-col gap-3 shadow-md shadow-navy/60 transition-all duration-200 hover:border-skyblue/50 hover:shadow-lg"
      >
        {/* Plane Icon - First */}
        <div className="flex justify-center">
          <div className="relative">
            <Image
              src={iconSrc}
              alt="Plane icon"
              width={64}
              height={64}
              className={
                variant === "joined"
                  ? "drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]"
                  : "drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]"
              }
            />
            {variant === "joined" && plane.isDisqualified && (
              <div className="absolute -top-2 -right-2 bg-red-900/90 border-2 border-red-500/50 rounded-full px-2 py-0.5">
                <span className="text-xs text-red-400 font-bold">DQ</span>
              </div>
            )}
          </div>
        </div>

        {/* Player Info - Below */}
        <div className="flex flex-col gap-2 min-w-0">
          {/* Player Name (Alpha/Bravo) */}
          <div className="text-center">
            <span className="font-semibold text-skyblue text-lg">
              {plane.playerName ||
                (variant === "joined" ? "Unnamed Pilot" : "Unlinked Plane")}
            </span>
          </div>

          {/* Plane ID */}
          <div className="text-center">
            <span className="text-sm text-skyblue/70 break-all font-mono">
              ID: {plane.planeId}
            </span>
          </div>

          {/* IP */}
          {plane.esp32Ip && (
            <div className="text-center">
              <span className="text-sm text-skyblue/60 font-mono break-all">
                IP: {plane.esp32Ip}
              </span>
            </div>
          )}

          {/* Joined Status */}
          {variant === "online" && plane.isJoined && (
            <div className="text-center mt-1">
              <span className="text-sm text-gold font-semibold px-3 py-1 rounded-full bg-gold/20 border border-gold/40 shadow-[0_0_8px_rgba(203,163,94,0.4)] inline-block">
                Joined
              </span>
            </div>
          )}

          {/* Stats for joined planes */}
          {variant === "joined" && (
            <div className="flex justify-between text-sm text-skyblue/80 mt-1">
              <span>Hits: {plane.hits ?? 0}</span>
              <span>Taken: {plane.hitsTaken ?? 0}</span>
            </div>
          )}
        </div>

        {/* Kick Button - At the bottom */}
        {variant === "joined" && (
          <button
            type="button"
            onClick={() => kickPlane(plane.planeId)}
            disabled={isKicking}
            className={`w-full px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
              isKicking
                ? "border-red-500/40 bg-red-900/40 text-red-200/70 cursor-not-allowed"
                : "border-red-500/70 bg-red-900/80 text-red-100 hover:bg-red-700 hover:scale-105 hover:shadow-lg active:scale-95 shadow-md"
            }`}
          >
            {isKicking ? "Kicking..." : "Kick"}
          </button>
        )}
      </div>
    );
  };

  useEffect(() => {
    // Override body background for lobby page - black jet centered at top
    document.body.classList.add("lobby-match-bg");

    return () => {
      document.body.classList.remove("lobby-match-bg");
    };
  }, []);

  return (
    <main
      role="main"
      className="w-full px-6 flex flex-col gap-6 min-h-screen relative"
    >
      {/* Background overlay - blue/purple gradient overlay dims the background planes but keeps header visible */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-80"
        style={{
          background:
            "linear-gradient(-180deg, #110f44, #000000, #000000, #110f44)",
        }}
      ></div>

      <div
        className={`flex flex-col justify-center items-center max-w-[1920px] mx-auto w-full py-6 relative z-10 transition-opacity duration-500 ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        <header className="text-center self-center mb-6 relative z-10">
          <Image
            src="/logo_text.svg"
            alt="Aeroduel"
            width={493 * 2}
            height={64 * 2}
            className="drop-shadow-[0_0_10px_rgba(153,207,255,0.3)]"
            style={{ animation: "pulse-logo-glow 3.5s ease-in-out infinite" }}
          />
          <Image
            src="/server-text.svg"
            alt="Server"
            width={270}
            height={45}
            className="mt-4 mb-8 mx-auto drop-shadow-[0_0_10px_rgba(153,207,255,0.3)]"
            style={{ animation: "pulse-logo-glow 3.5s ease-in-out infinite" }}
          />
          <p className="text-skyblue drop-shadow-[0_1.2px_1.2px_var(--color-navy)]">
            Aeroduel match hosting server
          </p>
        </header>

        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)_minmax(0,1.6fr)] gap-6 items-start relative z-10">
          {/* Match settings (first on small screens, top-aligned on large) */}
          <div className="flex flex-col items-center justify-start gap-6 w-full order-1 lg:order-2">
            {/* Match Settings (read-only) */}
            <div
              className="bg-navy/80 backdrop-blur-md border-2 border-skyblue/30 rounded-3xl p-8 w-full max-w-md flex flex-col gap-6 shadow-xl opacity-90"
              style={{
                boxShadow:
                  "0 0 20px rgba(153,207,255,0.6), 0 0 40px rgba(153,207,255,0.3)",
                animation: "pulse-glow 3.5s ease-in-out infinite",
              }}
            >
              <h2 className="text-2xl text-white font-bold text-center mb-2 border-b border-skyblue/20 pb-4 tracking-wide">
                Match Settings
              </h2>

              {/* Duration Control (disabled) */}
              <div className="flex flex-col gap-2">
                <span className="text-lg text-skyblue font-bold uppercase tracking-wider">
                  Match Duration
                </span>
                <div className="flex items-center justify-center gap-2 bg-darkernavy/50 p-2 rounded-xl border border-skyblue/10">
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
                      onBlur={() =>
                        updateDuration(displayMinutes, displaySeconds)
                      }
                      className="w-16 text-center bg-transparent text-2xl font-mono text-white/70 focus:outline-none appearance-none cursor-not-allowed"
                    />
                    <span className="text-xs text-skyblue/60">SEC</span>
                  </div>
                </div>
              </div>

              {/* Max Players Control (disabled) */}
              <div className="flex flex-col gap-2">
                <span className="text-lg text-skyblue font-bold uppercase tracking-wider">
                  Max Players
                </span>
                <div className="flex items-center justify-center gap-3 bg-darkernavy/50 p-2 rounded-xl border border-skyblue/10 opacity-70">
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
              className={`relative transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-gold/50 focus:ring-offset-2 focus:ring-offset-navy ${
                !starting
                  ? "hover:brightness-110 hover:scale-105 cursor-pointer active:scale-95"
                  : "cursor-not-allowed"
              }`}
            >
              <Image
                src={starting ? "/starting-btn.svg" : "/start-match-btn.svg"}
                alt={starting ? "Starting match..." : "Start Match"}
                width={444}
                height={102}
                className={starting ? "opacity-60 backdrop-blur-sm" : ""}
                style={{
                  filter:
                    "drop-shadow(0 0 15px rgba(173,0,0,0.6)) drop-shadow(0 0 30px rgba(173,0,0,0.4))",
                }}
              />
            </button>
          </div>

          {/* Joined planes (second on small screens, right on large) */}
          <section
            className="bg-navy/80 backdrop-blur-md border-2 border-red-500/60 rounded-3xl p-5 flex flex-col shadow-xl overflow-hidden order-2 lg:order-3"
            style={{ boxShadow: "0 0 15px rgba(173,0,0,0.4)" }}
          >
            <h2 className="text-xl text-white font-bold mb-3 border-b border-skyblue/20 pb-3 text-center tracking-wide">
              Joined Planes
            </h2>
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {joinedPlanes.length === 0 && (
                <div className="text-center mt-8 py-8">
                  <p className="text-skyblue/70 text-sm font-medium">
                    Waiting for players to join
                  </p>
                  <p className="text-skyblue/50 text-xs mt-2">
                    Players will appear here when they join
                  </p>
                </div>
              )}
              {joinedPlanes.map((plane, index) =>
                renderPlaneCard(plane, index, "joined")
              )}
            </div>
          </section>

          {/* Online planes (third on small screens, left on large) */}
          <section
            className="bg-navy/80 backdrop-blur-md border-2 border-red-500/60 rounded-3xl p-5 flex flex-col shadow-xl overflow-hidden order-3 lg:order-1"
            style={{ boxShadow: "0 0 15px rgba(173,0,0,0.4)" }}
          >
            <h2 className="text-xl text-white font-bold mb-3 border-b border-skyblue/20 pb-3 text-center tracking-wide">
              Online Planes
            </h2>
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {onlinePlanes.length === 0 && (
                <div className="text-center mt-8 py-8">
                  <p className="text-skyblue/70 text-sm font-medium">
                    No planes online yet
                  </p>
                  <p className="text-skyblue/50 text-xs mt-2">
                    Waiting for connections...
                  </p>
                </div>
              )}
              {onlinePlanes.map((plane, index) =>
                renderPlaneCard(plane, index, "online")
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
