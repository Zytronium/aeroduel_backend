import { NextResponse } from 'next/server'
import { planes } from "@/lib/match-state";

export async function GET() {
   return NextResponse.json({
     planes
   });
}
