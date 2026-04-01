import { NextResponse } from "next/server";
import {
  getContribAuthCookieName,
  getContribAuthSignature,
  validateContributionsPassword,
} from "@/src/lib/sanity/contributionsAuth";
import {
  applyDeviceCookieToResponse,
  extractRequestMeta,
  getDeviceIdForRequest,
  writeContributionLogSafe,
} from "@/src/lib/sanity/contributionLogs";
import { getSanityWriteClient } from "@/src/lib/sanity/sanityWriteClient";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const provided = (body.password ?? "").trim();
  if (!provided) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
  const meta = extractRequestMeta(req);

  try {
    const isValid = await validateContributionsPassword(provided);
    if (!isValid) {
      const client = getSanityWriteClient();
      await writeContributionLogSafe(client, {
        eventType: "auth.unlock_failed",
        action: "auth",
        entityType: "auth",
        summary: "Failed unlock attempt (invalid password)",
        deviceId,
        ...meta,
      });
      const res = NextResponse.json({ error: "Invalid password" }, { status: 401 });
      if (needsNewCookie) applyDeviceCookieToResponse(res, deviceId);
      return res;
    }

    const signature = await getContribAuthSignature();
    if (!signature) {
      return NextResponse.json(
        { error: "No contributions password configured in Sanity" },
        { status: 500 }
      );
    }

    const client = getSanityWriteClient();
    await writeContributionLogSafe(client, {
      eventType: "auth.unlock_success",
      action: "auth",
      entityType: "auth",
      summary: "Unlocked contributions",
      deviceId,
      ...meta,
    });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(getContribAuthCookieName(), signature, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    if (needsNewCookie) applyDeviceCookieToResponse(res, deviceId);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
  const meta = extractRequestMeta(req);
  const client = getSanityWriteClient();
  await writeContributionLogSafe(client, {
    eventType: "auth.sign_out",
    action: "auth",
    entityType: "auth",
    summary: "Signed out of contributions",
    deviceId,
    ...meta,
  });

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(getContribAuthCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  if (needsNewCookie) applyDeviceCookieToResponse(res, deviceId);
  return res;
}

