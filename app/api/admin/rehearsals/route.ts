import { NextResponse } from "next/server";
import { getContribAuthCookieName, isContribSessionValidFromCookie } from "@/src/lib/sanity/contributionsAuth";
import { fetchRehearsalsForRange } from "@/src/lib/sanity/client";
import { getSanityWriteClient } from "@/src/lib/sanity/sanityWriteClient";

type RehearsalBody = {
  rehearsalId?: string | null;
  date?: string | null;
  name?: string | null;
  repeatEveryDays?: number | null;
  untilDate?: string | null;
};

async function isAuthorizedFromRequest(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookiePairs = cookieHeader.split(";").map((part) => part.trim());
  const cookieName = getContribAuthCookieName();
  const authCookie = cookiePairs.find((pair) => pair.startsWith(`${cookieName}=`));
  const cookieValue = authCookie ? decodeURIComponent(authCookie.split("=")[1] ?? "") : undefined;
  return isContribSessionValidFromCookie(cookieValue);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: unknown): string | null {
  const v = normalizeString(value);
  if (!v) return null;
  const ymd = v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return ymd;
}

function normalizeRepeat(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1) return null;
  return rounded;
}

type RehearsalPayload = {
  date: string;
  name?: string;
  repeatEveryDays?: number;
  untilDate?: string;
};

function buildRehearsalPayload(body: RehearsalBody): { error?: string; value?: RehearsalPayload } {
  const date = normalizeDate(body.date);
  if (!date) return { error: "Date is required (YYYY-MM-DD)." };

  const repeatEveryDays = normalizeRepeat(body.repeatEveryDays);
  const untilDate = normalizeDate(body.untilDate);

  if ((body.repeatEveryDays ?? null) !== null && repeatEveryDays === null) {
    return { error: "repeatEveryDays must be an integer greater than 0." };
  }
  if (repeatEveryDays !== null && !untilDate) {
    return { error: "untilDate is required when repeatEveryDays is set." };
  }

  const payload: RehearsalPayload = { date };
  const name = normalizeString(body.name);
  if (name) payload.name = name;
  if (repeatEveryDays !== null && untilDate) {
    payload.repeatEveryDays = repeatEveryDays;
    payload.untilDate = untilDate;
  }

  return { value: payload };
}

export async function GET(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const from = normalizeDate(url.searchParams.get("from")) ?? "1900-01-01";
    const to = normalizeDate(url.searchParams.get("to")) ?? "2100-12-31";
    const dates = await fetchRehearsalsForRange(from, to);

    const client = getSanityWriteClient();
    const rows = await client.fetch<Array<{ _id: string; date: string; name?: string | null; repeatEveryDays?: number | null; untilDate?: string | null }>>(
      `*[_type == "rehearsal" && date >= $from && date <= $to] | order(date asc){
        _id, date, name, repeatEveryDays, untilDate
      }`,
      { from, to }
    );

    return NextResponse.json({ rehearsals: rows, occurrences: dates }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load rehearsals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as RehearsalBody;
  const validated = buildRehearsalPayload(body);
  if (validated.error || !validated.value) {
    return NextResponse.json({ error: validated.error ?? "Invalid rehearsal payload." }, { status: 400 });
  }

  const client = getSanityWriteClient();
  const created = await client.create({
    _type: "rehearsal",
    ...validated.value,
  });
  return NextResponse.json({ ok: true, rehearsal: { _id: created._id } }, { status: 201 });
}

export async function PATCH(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as RehearsalBody;
  const rehearsalId = normalizeString(body.rehearsalId);
  if (!rehearsalId) {
    return NextResponse.json({ error: "Rehearsal id is required." }, { status: 400 });
  }

  const client = getSanityWriteClient();
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "rehearsal" && _id == $id][0]{ _id }`,
    { id: rehearsalId }
  );
  if (!existing?._id) {
    return NextResponse.json({ error: "Rehearsal not found." }, { status: 404 });
  }

  const patch = client.patch(rehearsalId);
  let touched = false;

  if (body.date !== undefined) {
    const date = normalizeDate(body.date);
    if (!date) return NextResponse.json({ error: "Date must be YYYY-MM-DD." }, { status: 400 });
    patch.set({ date });
    touched = true;
  }
  if (body.name !== undefined) {
    patch.set({ name: normalizeString(body.name) ?? undefined });
    touched = true;
  }

  const repeatProvided = body.repeatEveryDays !== undefined;
  const untilProvided = body.untilDate !== undefined;
  if (repeatProvided || untilProvided) {
    const repeatEveryDays = normalizeRepeat(body.repeatEveryDays);
    const untilDate = normalizeDate(body.untilDate);

    if ((body.repeatEveryDays ?? null) !== null && repeatEveryDays === null) {
      return NextResponse.json(
        { error: "repeatEveryDays must be an integer greater than 0." },
        { status: 400 }
      );
    }
    if (repeatEveryDays !== null && !untilDate) {
      return NextResponse.json(
        { error: "untilDate is required when repeatEveryDays is set." },
        { status: 400 }
      );
    }

    if (repeatEveryDays === null) {
      patch.unset(["repeatEveryDays", "untilDate"]);
    } else {
      patch.set({ repeatEveryDays, untilDate });
    }
    touched = true;
  }

  if (!touched) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  await patch.commit();
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { rehearsalId?: string | null };
  const rehearsalId = normalizeString(body.rehearsalId);
  if (!rehearsalId) {
    return NextResponse.json({ error: "Rehearsal id is required." }, { status: 400 });
  }

  const client = getSanityWriteClient();
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "rehearsal" && _id == $id][0]{ _id }`,
    { id: rehearsalId }
  );
  if (!existing?._id) {
    return NextResponse.json({ error: "Rehearsal not found." }, { status: 404 });
  }

  await client.delete(rehearsalId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
