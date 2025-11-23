"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const timeoutRef = useRef<number | null>(null);

  async function startMatch() {
    if (loading)
      return;

    setLoading(true);
    setLiveMessage("Starting match…");

    try {
      const response = await fetch("/api/new-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "start" })
      });

      const data = await response.json();
      setLiveMessage("Response: " + JSON.stringify(data));
      if (data.success === "true")
        alert("Match open. Scan the QR code or enter the game PIN to enter the match!");
      console.log("Response: " + JSON.stringify(data));
    } catch (err) {
      setLiveMessage("Error contacting server");
      alert("Error contacting server");
    }

    timeoutRef.current = window.setTimeout(() => {
      setLoading(false);
      setLiveMessage("");
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

      <div className="flex flex-1 items-center justify-center">
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
          className="btn"
        >
          {loading ? (
            <svg
              role="img"
              aria-hidden="true"
              className="w-7 h-7 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          ) : null}

          <span aria-hidden={loading ? false : false}>
            {loading ? "Coming Soon..." : "Start Match"}
          </span>
        </button>

        {/* accessible live region (screen-reader only) */}
        <span className="sr-only" aria-live="polite">
          {liveMessage}
        </span>
      </div>
    </main>
  );
}
