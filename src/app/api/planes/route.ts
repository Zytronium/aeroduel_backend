import { NextResponse } from 'next/server'
import { getCurrentMatch } from "@/lib/match-state";

export async function GET() {
   return NextResponse.json({
     onlinePlanes: getCurrentMatch()?.onlinePlanes ?? []
   });
}
