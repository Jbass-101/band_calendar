import { NextResponse } from "next/server";
import { fetchSongs } from "@/src/lib/sanity/client";

export async function GET() {
  try {
    const songs = await fetchSongs();
    return NextResponse.json(songs, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
