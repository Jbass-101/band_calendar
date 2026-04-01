import { NextResponse } from "next/server";
import {
  getContribAuthCookieName,
  isContribSessionValidFromCookie,
} from "@/src/lib/sanity/contributionsAuth";
import {
  applyDeviceCookieToResponse,
  extractRequestMeta,
  getDeviceIdForRequest,
  isClientAllowedEventType,
  writeContributionLogSafe,
  type ContributionLogEventType,
} from "@/src/lib/sanity/contributionLogs";
import { getSanityWriteClient } from "@/src/lib/sanity/sanityWriteClient";

export type ContributionLogRow = {
  _id: string;
  timestamp: string;
  eventType: string;
  action: string;
  entityType: string;
  entityId?: string;
  month?: string;
  summary: string;
  details?: string;
  deviceId: string;
  ip?: string;
  userAgent?: string;
};

async function isAuthorized(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const pairs = cookieHeader.split(";").map((s) => s.trim());
  const cookieName = getContribAuthCookieName();
  const pair = pairs.find((p) => p.startsWith(`${cookieName}=`));
  const cookieValue = pair ? decodeURIComponent(pair.split("=")[1] ?? "") : "";
  return isContribSessionValidFromCookie(cookieValue || undefined);
}

export async function GET(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
    const url = new URL(req.url);
    const typeParam = url.searchParams.get("type") ?? "all";
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(200, Math.max(1, Number.parseInt(limitRaw ?? "50", 10) || 50));

    const client = getSanityWriteClient();
    const filterAll = typeParam === "all";

    const rows = await client.fetch<ContributionLogRow[]>(
      `*[_type == "contributionLog" && ($filterAll == true || eventType == $eventType)]
        | order(timestamp desc) [0...$limit] {
          _id,
          timestamp,
          eventType,
          action,
          entityType,
          entityId,
          month,
          summary,
          details,
          deviceId,
          ip,
          userAgent
        }`,
      {
        filterAll,
        eventType: typeParam,
        limit,
      }
    );

    const res = NextResponse.json({ logs: rows }, { status: 200 });
    if (needsNewCookie) {
      applyDeviceCookieToResponse(res, deviceId);
    }
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
    const meta = extractRequestMeta(req);
    const body = (await req.json()) as {
      eventType?: string;
      summary?: string;
      month?: string;
      details?: string;
    };

    const eventType = body.eventType?.trim();
    if (!eventType || !isClientAllowedEventType(eventType)) {
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
    }

    const summary = typeof body.summary === "string" && body.summary.trim().length > 0 ? body.summary.trim() : "—";
    const month =
      typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month.trim())
        ? `${body.month.trim()}-01`
        : undefined;
    const details = typeof body.details === "string" ? body.details : undefined;

    const client = getSanityWriteClient();
    const evt = eventType as ContributionLogEventType;
    await writeContributionLogSafe(client, {
      eventType: evt,
      action: "download",
      entityType: "statement",
      month,
      summary,
      details,
      deviceId,
      ...meta,
    });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    if (needsNewCookie) {
      applyDeviceCookieToResponse(res, deviceId);
    }
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
