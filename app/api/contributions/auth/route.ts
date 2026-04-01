import { NextResponse } from "next/server";
import {
  getContribAuthCookieName,
  getContribAuthSignature,
  validateContributionsPassword,
} from "@/src/lib/sanity/contributionsAuth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const provided = (body.password ?? "").trim();
  if (!provided) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  try {
    const isValid = await validateContributionsPassword(provided);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const signature = await getContribAuthSignature();
    if (!signature) {
      return NextResponse.json(
        { error: "No contributions password configured in Sanity" },
        { status: 500 }
      );
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(getContribAuthCookieName(), signature, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(getContribAuthCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

