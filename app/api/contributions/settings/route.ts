import { NextResponse } from "next/server";
import {
  getContribAuthCookieName,
  isContribSessionValidFromCookie,
} from "@/src/lib/sanity/contributionsAuth";
import {
  currentMonthStartUtc,
  DEFAULT_COMMITTEE_TARGET,
  DEFAULT_NON_COMMITTEE_TARGET,
  ensureTargetHistoryKeys,
  type TargetHistoryRow,
} from "@/src/lib/sanity/contributionTargets";
import {
  applyDeviceCookieToResponse,
  extractRequestMeta,
  getDeviceIdForRequest,
  writeContributionLogSafe,
} from "@/src/lib/sanity/contributionLogs";
import { getSanityWriteClient } from "@/src/lib/sanity/sanityWriteClient";

async function isAuthorized(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const pairs = cookieHeader.split(";").map((s) => s.trim());
  const cookieName = getContribAuthCookieName();
  const pair = pairs.find((p) => p.startsWith(`${cookieName}=`));
  const cookieValue = pair ? decodeURIComponent(pair.split("=")[1] ?? "") : "";
  return isContribSessionValidFromCookie(cookieValue || undefined);
}

const BASELINE_FROM = "1970-01-01";

export async function GET(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const client = getSanityWriteClient();
    const doc = await client.fetch<{
      _id: string;
      nonCommitteeTarget?: number;
      committeeTarget?: number;
      targetHistory?: TargetHistoryRow[] | null;
    } | null>(`*[_type == "contributionAccess"][0]{ _id, nonCommitteeTarget, committeeTarget, targetHistory }`);

    if (!doc?._id) {
      return NextResponse.json({ error: "No contribution access document in Sanity" }, { status: 500 });
    }

    return NextResponse.json(
      {
        nonCommitteeTarget:
          typeof doc.nonCommitteeTarget === "number" ? doc.nonCommitteeTarget : DEFAULT_NON_COMMITTEE_TARGET,
        committeeTarget: typeof doc.committeeTarget === "number" ? doc.committeeTarget : DEFAULT_COMMITTEE_TARGET,
        targetHistory: Array.isArray(doc.targetHistory) ? doc.targetHistory : [],
      },
      { status: 200 }
    );
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

    const body = (await req.json()) as {
      nonCommitteeTarget?: number;
      committeeTarget?: number;
    };

    const non =
      typeof body.nonCommitteeTarget === "number" && !Number.isNaN(body.nonCommitteeTarget)
        ? body.nonCommitteeTarget
        : null;
    const com =
      typeof body.committeeTarget === "number" && !Number.isNaN(body.committeeTarget)
        ? body.committeeTarget
        : null;

    if (non === null || com === null) {
      return NextResponse.json({ error: "nonCommitteeTarget and committeeTarget are required" }, { status: 400 });
    }
    if (non < 0 || com < 0) {
      return NextResponse.json({ error: "Targets must be >= 0" }, { status: 400 });
    }

    const client = getSanityWriteClient();
    const doc = await client.fetch<{
      _id: string;
      nonCommitteeTarget?: number;
      committeeTarget?: number;
      targetHistory?: TargetHistoryRow[] | null;
    } | null>(`*[_type == "contributionAccess"][0]{ _id, nonCommitteeTarget, committeeTarget, targetHistory }`);

    if (!doc?._id) {
      return NextResponse.json({ error: "No contribution access document in Sanity" }, { status: 500 });
    }

    const history: TargetHistoryRow[] = Array.isArray(doc.targetHistory) ? [...doc.targetHistory] : [];

    if (history.length === 0) {
      const baseNon =
        typeof doc.nonCommitteeTarget === "number" && doc.nonCommitteeTarget > 0
          ? doc.nonCommitteeTarget
          : DEFAULT_NON_COMMITTEE_TARGET;
      const baseCom =
        typeof doc.committeeTarget === "number" && doc.committeeTarget > 0
          ? doc.committeeTarget
          : DEFAULT_COMMITTEE_TARGET;
      history.push({
        effectiveFrom: BASELINE_FROM,
        nonCommitteeTarget: baseNon,
        committeeTarget: baseCom,
      });
    }

    const effectiveFrom = currentMonthStartUtc();
    const withoutDup = history.filter((row) => row.effectiveFrom !== effectiveFrom);
    withoutDup.push({
      effectiveFrom,
      nonCommitteeTarget: non,
      committeeTarget: com,
    });
    withoutDup.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

    const targetHistory = ensureTargetHistoryKeys(withoutDup);

    await client
      .patch(doc._id)
      .set({
        nonCommitteeTarget: non,
        committeeTarget: com,
        targetHistory,
      })
      .commit();

    const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
    const meta = extractRequestMeta(req);
    await writeContributionLogSafe(client, {
      eventType: "settings.update",
      action: "update",
      entityType: "settings",
      entityId: doc._id,
      summary: `Updated monthly targets: non-committee R${non.toFixed(2)}, committee R${com.toFixed(2)} (effective ${effectiveFrom})`,
      deviceId,
      ...meta,
    });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    if (needsNewCookie) applyDeviceCookieToResponse(res, deviceId);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
