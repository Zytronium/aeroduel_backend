"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import getServerToken from "@/app/getAuth";

export default function Home() {
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
    if (loading)
      return;

    setLoading(true);

    try {
      // Await the token generation
      const token = await getServerToken();

      const response = await fetch("/api/new-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          duration: duration, 
          maxPlayers: maxPlayers, 
          serverToken: token 
        })
      });

      const data = await response.json();

      if (response.status === 403) {
        alert("You are not authorized to start a match from here. Try again in the app.");
      } else if (response.status === 409) {
          alert("A match already exists. Try restarting the app to start a new one");
      } else if (!response.ok) {
        alert("An unknown error occurred");
      } else if (data.success === true || data.success === "true") {
        alert("Match open. Scan the QR code or enter the game PIN to enter the match!");
      }

      console.log("Response: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("An unknown error occurred");
    }

    timeoutRef.current = window.setTimeout(() => {
      setLoading(false);
    }, 1500);
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
      className="w-full max-w-3xl mx-auto p-6 flex flex-col items-center gap-6 min-h-screen"
    >
      <header className="text-center mt-8">
        <Image src="/logo_text.svg" alt="Aeroduel" width={493 * 2} height={64 * 2} />
        <Image src="/server-text.svg" alt="Server" width={270} height={45} className="mt-4 mb-8 mx-auto"/>
        <p className="text-skyblue drop-shadow-[0_1.2px_1.2px_var(--color-navy)]">
          Aeroduel match hosting server
        </p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 w-full">
        
        {/* Match Settings */}
        <div className="bg-navy/80 backdrop-blur-md border-2 border-skyblue/30 rounded-3xl p-8 w-full max-w-md flex flex-col gap-6 shadow-lg shadow-navy/50">
          <h2 className="text-2xl text-white font-bold text-center mb-2 border-b border-skyblue/20 pb-4">Match Settings</h2>

          {/* Duration Control */}
          <div className="flex flex-row items-center justify-between">
            <span className="text-lg text-skyblue font-bold uppercase tracking-wider">Match Duration</span>
            <div className="flex items-center gap-2 bg-darkernavy/50 p-2 rounded-xl border border-skyblue/10">
              <div className="flex flex-col items-center">
                <input 
                  type="number" 
                  min="0" 
                  max="30"
                  value={displayMinutes}
                  onChange={(e) => updateDuration(Number(e.target.value), displaySeconds)}
                  className="w-16 text-center bg-transparent text-2xl font-mono text-white focus:outline-none focus:text-gold appearance-none"
                />
                <span className="text-xs text-skyblue/60">MIN</span>
              </div>
              <span className="text-2xl text-skyblue/50 pb-4">:</span>
              <div className="flex flex-col items-center">
                <input 
                  type="number" 
                  min="0" 
                  max="59"
                  value={displaySeconds.toString().padStart(2, '0')}
                  onChange={(e) => updateDuration(displayMinutes, Number(e.target.value))}
                  onBlur={() => updateDuration(displayMinutes, displaySeconds)} // Force format on blur
                  className="w-16 text-center bg-transparent text-2xl font-mono text-white focus:outline-none focus:text-gold appearance-none"
                />
                <span className="text-xs text-skyblue/60">SEC</span>
              </div>
            </div>
          </div>

          {/* Max Players Control */}
          <div className="flex flex-row items-center justify-between">
            <span className="text-lg text-skyblue font-bold uppercase tracking-wider">Max Players</span>
            <div className="flex items-center gap-3 bg-darkernavy/50 p-2 rounded-xl border border-skyblue/10">
              <button 
                onClick={() => handlePlayersChange(-1)}
                disabled={maxPlayers <= 2}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-skyblue/10 text-skyblue hover:bg-skyblue/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-2xl font-bold"
              >
                -
              </button>
              <span className="text-2xl font-mono text-white w-8 text-center">{maxPlayers}</span>
              <button 
                onClick={() => handlePlayersChange(1)}
                disabled={maxPlayers >= 16}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-skyblue/10 text-skyblue hover:bg-skyblue/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-2xl font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={startMatch}
          onKeyDown={(e) => {
            // support Space/Enter activating the button when focused
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              startMatch();
            }
          }}
          disabled={loading}
          aria-pressed={loading}
          aria-busy={loading}
          className={`relative transition-all ${!loading ? 'hover:brightness-110 hover:scale-105 cursor-pointer' : ''}`}
        >
          <Image
            src={loading ? "/starting-btn.svg" : "/start-match-btn.svg"}
            alt={loading ? "Starting..." : "Start Match"}
            width={444}
            height={102}
            className={loading ? "opacity-60 backdrop-blur-sm" : ""}
          />
        </button>
      </div>
    </main>
  );
}
