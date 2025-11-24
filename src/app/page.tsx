"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import getServerToken from "@/app/getAuth";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  async function startMatch() {
    if (loading)
      return;

    setLoading(true);

    try {
      const token = await getServerToken();

      const response = await fetch("/api/new-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ duration: 450, maxPlayers: 4, serverToken: token })
      });

      const data = await response.json();

      if (response.status === 403) {
        alert("You are not authorized to start a match from here. Try again in the app.");
      } else if (response.status === 409) {
          alert("A match already exists. Try restarting the app to start a new one");
      } else if (!response.ok) {
        alert("An unknown error occurred");
      } else if (data.success === "true") {
        alert("Match open. Scan the QR code or enter the game PIN to enter the match!");
      }

      console.log("Response: " + JSON.stringify(data));
    } catch (err) {
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

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
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
          className={`relative transition-all ${!loading ? 'hover:brightness-110 cursor-pointer' : ''}`}
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
