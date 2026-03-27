import { NextResponse } from "next/server";
import { getSanityUserFromToken, userHasAllowedRole } from "@/src/lib/sanity/roleAuth";

const COOKIE_NAME = "contrib_sanity_token";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const provided = (body.token ?? "").trim();
  if (!provided) {
    return NextResponse.json({ error: "Sanity token is required" }, { status: 400 });
  }

  const user = await getSanityUserFromToken(provided);
  if (!user) {
    return NextResponse.json({ error: "Invalid Sanity token" }, { status: 401 });
  }
  if (!userHasAllowedRole(user)) {
    return NextResponse.json({ error: "Insufficient Sanity role" }, { status: 403 });
  }

  const res = NextResponse.json(
    { ok: true, user: { name: user.name, email: user.email, roles: user.roles } },
    { status: 200 }
  );
  res.cookies.set(COOKIE_NAME, provided, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

