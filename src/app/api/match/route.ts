import { NextResponse } from "next/server";
import { getCurrentMatch } from "@/lib/match-state";

export async function GET() {
  const match = getCurrentMatch();

  if (!match) {
    return NextResponse.json(
      { error: "No match active." },
      { status: 404 }
    );
  }

  return NextResponse.json(match);
}
