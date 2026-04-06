import { NextResponse } from "next/server";
import {
  getContribAuthCookieName,
  isContribSessionValidFromCookie,
} from "@/src/lib/sanity/contributionsAuth";
import {
  applyDeviceCookieToResponse,
  extractRequestMeta,
  getDeviceIdForRequest,
  writeContributionLogSafe,
} from "@/src/lib/sanity/contributionLogs";
import { getSanityWriteClient } from "@/src/lib/sanity/sanityWriteClient";
import { normalizeWhatsappForStorage } from "@/src/lib/whatsappNumber";

async function isAuthorized(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const pairs = cookieHeader.split(";").map((s) => s.trim());
  const cookieName = getContribAuthCookieName();
  const pair = pairs.find((p) => p.startsWith(`${cookieName}=`));
  const cookieValue = pair ? decodeURIComponent(pair.split("=")[1] ?? "") : "";
  return isContribSessionValidFromCookie(cookieValue || undefined);
}

export async function PATCH(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      memberId?: string;
      whatsapp?: string | null;
    };

    const memberId = body.memberId?.trim();
    if (!memberId) {
      return NextResponse.json({ error: "Missing memberId" }, { status: 400 });
    }

    const raw =
      body.whatsapp === null || body.whatsapp === undefined
        ? ""
        : typeof body.whatsapp === "string"
          ? body.whatsapp
          : "";

    const normalized = normalizeWhatsappForStorage(raw);
    if (raw.trim().length > 0 && normalized === null) {
      return NextResponse.json(
        { error: "Invalid WhatsApp number. Use country code and 8–15 digits (e.g. 27821234567)." },
        { status: 400 }
      );
    }

    const client = getSanityWriteClient();
    const foundId = await client.fetch<string | null>(
      `*[_type == "musician" && _id == $id][0]._id`,
      { id: memberId }
    );
    if (!foundId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (normalized === null) {
      await client.patch(memberId).unset(["whatsapp"]).commit();
    } else {
      await client.patch(memberId).set({ whatsapp: normalized }).commit();
    }

    const memberName = await client.fetch<string | null>(
      `*[_type == "musician" && _id == $id][0].name`,
      { id: memberId }
    );

    const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
    const meta = extractRequestMeta(req);
    await writeContributionLogSafe(client, {
      eventType: "musician.whatsapp_update",
      action: "update",
      entityType: "musician",
      entityId: memberId,
      summary: `${normalized === null ? "Cleared" : "Updated"} WhatsApp for ${memberName ?? memberId}`,
      details: normalized === null ? undefined : normalized,
      deviceId,
      ...meta,
    });

    const res = NextResponse.json({ ok: true, whatsapp: normalized }, { status: 200 });
    if (needsNewCookie) applyDeviceCookieToResponse(res, deviceId);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
