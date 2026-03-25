import { NextResponse } from "next/server";
import { fetchRehearsalsForRange } from "@/src/lib/sanity/client";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");

    if (!fromRaw || !toRaw) {
      return NextResponse.json(
        { error: "Missing required query params: from, to" },
        { status: 400 }
      );
    }

    const from = fromRaw.slice(0, 10);
    const to = toRaw.slice(0, 10);

    const rehearsals = await fetchRehearsalsForRange(from, to);
    return NextResponse.json(rehearsals, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

