import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Grab the URL object that Next.js builds for you
  const url = request.nextUrl   // instance of URL

  // Or get all params as a plain object
  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })

  console.log('Query params:', query)

  // You can still log the request itself, but don’t try to read a body on GET
  // (browsers typically drop it and many servers ignore it).
  // console.log('Request body:', await request.json().catch(() => ({})))

  return NextResponse.json({
    message: 'Test endpoint reached',
    receivedQuery: query,
  });
}
