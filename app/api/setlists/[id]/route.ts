import { NextResponse } from "next/server";
import { fetchSetlistById } from "@/src/lib/sanity/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const trimmed = id.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Setlist id is required." }, { status: 400 });
  }

  try {
    const detail = await fetchSetlistById(trimmed);
    if (!detail) {
      return NextResponse.json({ error: "Setlist not found." }, { status: 404 });
    }
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
