import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { planeId, targetId } = data;

  if (!planeId || !targetId) {
    return NextResponse.json(
      { error: "Missing required fields: planeId and targetId are required." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: "I'm a server, not a fighter jet. You expect ME to fire at that plane? That's like asking a teapot to brew coffee!", },
    { status: 418 }
  );
}
