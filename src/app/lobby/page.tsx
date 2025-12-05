"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import getServerToken from "@/app/getAuth";
import { useRouter } from "next/navigation";
import type { Plane, MatchState } from "@/types";

export default function LobbyPage() {
  const router = useRouter();

  const [starting, setStarting] = useState(false);
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
        router.push("/match");
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
          "You are not authorized to kick planes from here. Try again in the app.",
        );
      } else if (!response.ok) {
        alert(data.error ?? "Failed to kick plane.");
      } else if (data.success === true || data.success === "true") {
        alert("Plane kicked from lobby.");
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
    };
  }, []);

  const renderPlaneCard = (
    plane: Plane,
    index: number,
    variant: "online" | "joined",
  ) => {
    const iconSrc = getPlaneIcon(index);
    const isKicking = kickingId === plane.planeId;

    return (
      <div
        key={plane.planeId}
        className="w-full rounded-2xl border border-skyblue/30 bg-gradient-to-r from-darkernavy/90 via-darkernavy/70 to-skyblue/25 px-6 py-5 text-lg flex items-center gap-5 shadow-md shadow-navy/60 min-h-[110px]"
      >
        <div className="flex-shrink-0">
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
        </div>

        <div className="flex flex-col flex-1 gap-1.5">
          <div className="flex justify-between items-center gap-3">
            <span className="font-semibold text-skyblue text-lg truncate">
              {plane.playerName ||
                (variant === "joined" ? "Unnamed Pilot" : "Unlinked Plane")}
            </span>

            <div className="flex items-center gap-2">
              {variant === "online" && plane.isJoined && (
                <span className="text-sm text-gold font-semibold px-3 py-1 rounded-full bg-gold/10">
                  Joined
                </span>
              )}

              {variant === "joined" && plane.isDisqualified && (
                <span className="text-xs text-red-400 font-semibold px-3 py-1 rounded-full bg-red-900/40">
                  DQ
                </span>
              )}
            </div>
          </div>

          <span className="text-sm text-skyblue/70 break-all">
            ID: {plane.planeId}
          </span>

          {variant === "online" && plane.esp32Ip && (
            <span className="text-sm text-skyblue/60">
              IP: {plane.esp32Ip}
            </span>
          )}

          {variant === "joined" && (
            <div className="flex justify-between text-sm text-skyblue/80 mt-1">
              <span>Hits: {plane.hits ?? 0}</span>
              <span>Taken: {plane.hitsTaken ?? 0}</span>
            </div>
          )}
        </div>

        {variant === "joined" && (
          <button
            type="button"
            onClick={() => kickPlane(plane.planeId)}
            disabled={isKicking}
            className={`ml-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all ${
              isKicking
                ? "border-red-500/40 bg-red-900/40 text-red-200/70 cursor-not-allowed"
                : "border-red-500/70 bg-red-900/80 text-red-100 hover:bg-red-700 hover:scale-105 shadow-md"
            }`}
          >
            {isKicking ? "Kicking..." : "Kick"}
          </button>
        )}
      </div>
    );
  };

  return (
    <main
      role="main"
      className="w-full px-6 flex flex-col gap-6 min-h-screen"
    >
      <header className="text-center self-center mt-8">
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

      <div className="flex-1 grid grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)_minmax(0,1.6fr)] gap-6 items-stretch">
        {/* Online planes (left) */}
        <section className="bg-navy/80 backdrop-blur-md border-2 border-skyblue/30 rounded-3xl p-4 flex flex-col shadow-lg shadow-navy/50 overflow-hidden">
          <h2 className="text-xl text-white font-bold mb-2 border-b border-skyblue/20 pb-2 text-center">
            Online Planes
          </h2>
          <div className="flex-1 overflow-y-auto w-full pr-1 space-y-4">
            {onlinePlanes.length === 0 && (
              <p className="text-skyblue/60 text-sm text-center mt-4">
                No planes online yet.
              </p>
            )}
            {onlinePlanes.map((plane, index) =>
              renderPlaneCard(plane, index, "online"),
            )}
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
          <div className="flex-1 overflow-y-auto w-full pr-1 space-y-4">
            {joinedPlanes.length === 0 && (
              <p className="text-skyblue/60 text-sm text-center mt-4">
                Waiting for players to join...
              </p>
            )}
            {joinedPlanes.map((plane, index) =>
              renderPlaneCard(plane, index, "joined"),
            )}
          </div>
        </section>
      </div>
    </main>
  );
}