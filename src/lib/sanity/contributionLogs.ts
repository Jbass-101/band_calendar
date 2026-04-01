import type { SanityClient } from "@sanity/client";
import { NextResponse } from "next/server";
import type { ContributionLogEventType } from "@/src/lib/contributionLogConstants";
import { CONTRIBUTION_LOG_EVENT_TYPES } from "@/src/lib/contributionLogConstants";

export const CONTRIB_DEVICE_COOKIE = "contrib_device_id";

export type { ContributionLogEventType };
export { CONTRIBUTION_LOG_EVENT_TYPES };

const CLIENT_ALLOWED_EVENTS = new Set<ContributionLogEventType>([
  "statement.download_month",
  "statement.download_ytd",
]);

export function parseDeviceIdFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";").map((s) => s.trim());
  const pair = pairs.find((p) => p.startsWith(`${CONTRIB_DEVICE_COOKIE}=`));
  const v = pair ? decodeURIComponent(pair.split("=")[1] ?? "") : "";
  return v.length > 0 ? v : null;
}

export function randomDeviceId(): string {
  return crypto.randomUUID();
}

export function getDeviceIdForRequest(req: Request): { deviceId: string; needsNewCookie: boolean } {
  const existing = parseDeviceIdFromCookieHeader(req.headers.get("cookie"));
  if (existing) return { deviceId: existing, needsNewCookie: false };
  return { deviceId: randomDeviceId(), needsNewCookie: true };
}

export function applyDeviceCookieToResponse(res: NextResponse, deviceId: string): void {
  res.cookies.set(CONTRIB_DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function extractRequestMeta(req: Request): { ip?: string; userAgent?: string } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip =
    typeof forwarded === "string" && forwarded.trim().length > 0
      ? forwarded.split(",")[0]?.trim()
      : undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;
  return { ip, userAgent };
}

export type WriteContributionLogInput = {
  eventType: ContributionLogEventType | string;
  action: string;
  entityType: string;
  entityId?: string;
  month?: string;
  summary: string;
  details?: string;
  deviceId: string;
  ip?: string;
  userAgent?: string;
  timestamp?: string;
};

export async function writeContributionLog(client: SanityClient, input: WriteContributionLogInput): Promise<void> {
  await client.create({
    _type: "contributionLog",
    timestamp: input.timestamp ?? new Date().toISOString(),
    eventType: input.eventType,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    month: input.month,
    summary: input.summary,
    details: input.details,
    deviceId: input.deviceId,
    ip: input.ip,
    userAgent: input.userAgent,
  });
}

/** Prefer this from API routes so a Sanity outage does not fail the primary action. */
export async function writeContributionLogSafe(
  client: SanityClient,
  input: WriteContributionLogInput
): Promise<void> {
  try {
    await writeContributionLog(client, input);
  } catch (err) {
    console.error("[contributionLog] write failed:", err);
  }
}

export function isClientAllowedEventType(eventType: string): eventType is ContributionLogEventType {
  return CLIENT_ALLOWED_EVENTS.has(eventType as ContributionLogEventType);
}
