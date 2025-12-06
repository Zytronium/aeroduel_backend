"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import getServerToken from "@/app/getAuth";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 7 minutes (420 seconds) default, min 30, max 1800
  const [duration, setDuration] = useState(420);
  // 2 players default, min 2, max 16
  const [maxPlayers, setMaxPlayers] = useState(2);

  const timeoutRef = useRef<number | null>(null);

  // Calculate minutes and seconds for display
  const displayMinutes = Math.floor(duration / 60);
  const displaySeconds = duration % 60;

  const updateDuration = (newMinutes: number, newSeconds: number) => {
    let totalSeconds = newMinutes * 60 + newSeconds;

    // Clamp between 30s and 30m (1800s)
    if (totalSeconds > 1800) totalSeconds = 1800;
    if (totalSeconds < 30) totalSeconds = 30;

    setDuration(totalSeconds);
  };

  const handlePlayersChange = (increment: number) => {
    const newValue = maxPlayers + increment;
    if (newValue >= 2 && newValue <= 16) {
      setMaxPlayers(newValue);
    }
  };

  async function startMatch() {
    if (loading) return;

    setLoading(true);

    try {
      // Await the token generation
      const token = await getServerToken();

      const response = await fetch("/api/new-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          duration: duration,
          maxPlayers: maxPlayers,
          serverToken: token,
        }),
      });

      const data = await response.json();

      setLoading(false);
      if (response.status === 403) {
        alert(
          "You are not authorized to start a match from here. Try again in the app."
        );
      } else if (response.status === 409) {
        alert(
          "A match already exists. Try restarting the app to start a new one"
        );
      } else if (!response.ok) {
        alert("An unknown error occurred");
      } else if (response.status === 200) {
        router.push("/lobby");
      }

      console.log("Response: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      setLoading(false);
      alert("An unknown error occurred");
    }
  }

  useEffect(() => {
    // Allow scrolling on home page
    document.body.style.overflowY = "auto";
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.body.style.overflowY = "hidden";
    };
  }, []);

  return (
    <main
      role="main"
      className="w-full p-6 flex flex-col items-center gap-6 min-h-screen relative"
    >
      {/* Background overlay - blue/purple gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-80"
        style={{
          background:
            "linear-gradient(-180deg, #110f44, #000000, #000000, #110f44)",
        }}
      ></div>

      <div className="flex flex-col items-center justify-center flex-1 w-full my-auto relative z-10">
        <header className="text-center relative z-20 mb-4">
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
            className="mt-4 mb-4 mx-auto drop-shadow-[0_0_10px_rgba(153,207,255,0.3)]"
            style={{ animation: "pulse-logo-glow 3.5s ease-in-out infinite" }}
          />
          <p className="text-skyblue drop-shadow-[0_1.2px_1.2px_var(--color-navy)] relative z-20">
            Aeroduel match hosting server
          </p>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 w-full">
          {/* Match Settings */}
          <div
            className="bg-navy/80 backdrop-blur-md border-2 border-skyblue/30 rounded-3xl p-8 w-full max-w-xs flex flex-col gap-6 shadow-xl relative z-10"
            style={{
              boxShadow:
                "0 0 20px rgba(153,207,255,0.6), 0 0 40px rgba(153,207,255,0.3)",
              animation: "pulse-glow 3.5s ease-in-out infinite",
            }}
          >
            <h2 className="text-2xl text-white font-bold text-center mb-2 border-b border-skyblue/20 pb-4 tracking-wide">
              Match Settings
            </h2>

            {/* Duration Control */}
            <div className="flex flex-col gap-3">
              <label className="text-base text-skyblue font-semibold uppercase tracking-wider">
                Match Duration
              </label>
              <div className="flex items-center justify-center gap-2 bg-darkernavy/50 p-3 rounded-xl border border-skyblue/20 shadow-inner">
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={displayMinutes}
                    onChange={(e) =>
                      updateDuration(Number(e.target.value), displaySeconds)
                    }
                    className="w-16 text-center bg-transparent text-2xl font-mono text-white focus:outline-none focus:ring-2 focus:ring-gold/50 focus:text-gold rounded-md transition-all duration-200 appearance-none"
                    style={{
                      fontFamily:
                        'monospace, "Courier New", Courier, sans-serif',
                    }}
                    aria-label="Minutes"
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
                    onChange={(e) =>
                      updateDuration(displayMinutes, Number(e.target.value))
                    }
                    onBlur={() =>
                      updateDuration(displayMinutes, displaySeconds)
                    }
                    className="w-16 text-center bg-transparent text-2xl font-mono text-white focus:outline-none focus:ring-2 focus:ring-gold/50 focus:text-gold rounded-md transition-all duration-200 appearance-none"
                    style={{
                      fontFamily:
                        'monospace, "Courier New", Courier, sans-serif',
                    }}
                    aria-label="Seconds"
                  />
                  <span className="text-xs text-skyblue/60">SEC</span>
                </div>
              </div>
            </div>

            {/* Max Players Control */}
            <div className="flex flex-col gap-3">
              <label className="text-base text-skyblue font-semibold uppercase tracking-wider">
                Max Players
              </label>
              <div className="flex items-center justify-center gap-3 bg-darkernavy/50 p-3 rounded-xl border border-skyblue/20 shadow-inner">
                <button
                  onClick={() => handlePlayersChange(-1)}
                  disabled={maxPlayers <= 2}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-skyblue/10 text-skyblue hover:bg-skyblue/20 hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-skyblue/50"
                  aria-label="Decrease max players"
                >
                  -
                </button>
                <span
                  className="text-2xl font-mono text-white w-10 text-center font-semibold"
                  style={{
                    fontFamily: 'monospace, "Courier New", Courier, sans-serif',
                  }}
                >
                  {maxPlayers}
                </span>
                <button
                  onClick={() => handlePlayersChange(1)}
                  disabled={maxPlayers >= 16}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-skyblue/10 text-skyblue hover:bg-skyblue/20 hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-skyblue/50"
                  aria-label="Increase max players"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={startMatch}
            disabled={loading}
            aria-pressed={loading}
            aria-busy={loading}
            className={`relative transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-gold/50 focus:ring-offset-2 focus:ring-offset-navy ${
              !loading
                ? "hover:brightness-110 hover:scale-105 cursor-pointer active:scale-95"
                : "cursor-not-allowed"
            }`}
          >
            <Image
              src={loading ? "/starting-btn.svg" : "/new-match-btn.svg"}
              alt={loading ? "Creating new match..." : "New Match"}
              width={355}
              height={82}
              className={loading ? "opacity-60 backdrop-blur-sm" : ""}
              style={{
                filter:
                  "drop-shadow(0 0 15px rgba(173,0,0,0.6)) drop-shadow(0 0 30px rgba(173,0,0,0.4))",
              }}
            />
          </button>
        </div>
      </div>
    </main>
  );
}
