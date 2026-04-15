import { NextResponse } from "next/server";
import { fetchSetlists } from "@/src/lib/sanity/client";

export async function GET() {
  try {
    const setlists = await fetchSetlists();
    return NextResponse.json(setlists, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
