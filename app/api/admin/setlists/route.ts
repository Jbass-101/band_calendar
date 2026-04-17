import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getContribAuthCookieName, isContribSessionValidFromCookie } from "@/src/lib/sanity/contributionsAuth";
import { fetchSetlists } from "@/src/lib/sanity/client";
import { getSanityWriteClient } from "@/src/lib/sanity/sanityWriteClient";

type SetlistStatus = "draft" | "ready" | "final" | "archived";

type SongLineBody = {
  _key?: string | null;
  songId?: string | null;
  section?: string | null;
  note?: string | null;
  keyOverride?: string | null;
  tempoOverride?: number | null;
};

type CreateSetlistBody = {
  serviceId?: string | null;
  leadVocal?: string | null;
  status?: SetlistStatus | null;
  notes?: string | null;
  songs?: SongLineBody[] | null;
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

function newLineKey(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

const LEAD_VOCAL_ROLE = "Lead Vocal";

async function findMusicianIdForLeadVocalName(
  client: ReturnType<typeof getSanityWriteClient>,
  name: string
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return client.fetch<string | null>(
    `*[_type == "musician" && lower(name) == lower($name) && $role in roles][0]._id`,
    { name: trimmed, role: LEAD_VOCAL_ROLE }
  );
}

/** Updates the service document’s `leadVocal` references to match the chosen name. */
async function syncServiceLeadVocalAssignment(
  client: ReturnType<typeof getSanityWriteClient>,
  serviceId: string,
  leadVocalName: string
): Promise<{ ok: true } | { error: string }> {
  const musicianId = await findMusicianIdForLeadVocalName(client, leadVocalName);
  if (!musicianId) {
    return {
      error: `No musician with the Lead Vocal role matches "${leadVocalName.trim()}".`,
    };
  }
  const key = randomUUID().replace(/-/g, "").slice(0, 16);
  await client
    .patch(serviceId)
    .set({
      leadVocal: [
        {
          _key: key,
          _type: "reference",
          _ref: musicianId,
        },
      ],
    })
    .commit();
  return { ok: true };
}

function normalizeStatus(value: unknown): SetlistStatus {
  if (value === "draft" || value === "ready" || value === "final" || value === "archived") {
    return value;
  }
  return "draft";
}

function buildSongLines(lines: SongLineBody[] | null | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(lines) || lines.length < 1) {
    throw new Error("At least one song is required.");
  }
  return lines.map((line) => {
    const songId = normalizeString(line.songId);
    if (!songId) {
      throw new Error("Each row needs a song.");
    }
    const section = normalizeString(line.section);
    if (!section) {
      throw new Error("Each row needs a section.");
    }
    const row: Record<string, unknown> = {
      _key: normalizeString(line._key) ?? newLineKey(),
      song: { _type: "reference", _ref: songId },
      section,
    };
    const note = normalizeString(line.note);
    if (note) row.note = note;
    const keyOverride = normalizeString(line.keyOverride);
    if (keyOverride) row.keyOverride = keyOverride;
    if (
      typeof line.tempoOverride === "number" &&
      Number.isFinite(line.tempoOverride) &&
      line.tempoOverride >= 1 &&
      line.tempoOverride <= 400
    ) {
      row.tempoOverride = Math.round(line.tempoOverride);
    }
    return row;
  });
}

export async function GET(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const setlists = await fetchSetlists();
    return NextResponse.json({ setlists }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load setlists";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CreateSetlistBody;
  const serviceId = normalizeString(body.serviceId);
  if (!serviceId) {
    return NextResponse.json({ error: "Service is required." }, { status: 400 });
  }

  let songsPayload: Array<Record<string, unknown>>;
  try {
    songsPayload = buildSongLines(body.songs ?? []);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid songs." },
      { status: 400 }
    );
  }

  const client = getSanityWriteClient();

  const duplicateCount = await client.fetch<number>(
    `count(*[_type == "setlist" && service._ref == $serviceId])`,
    { serviceId }
  );
  if (duplicateCount > 0) {
    return NextResponse.json(
      { error: "A setlist already exists for this service." },
      { status: 409 }
    );
  }

  const serviceMeta = await client.fetch<{ leadVocalNames?: Array<string | null> | null } | null>(
    `*[_type == "service" && _id == $id][0]{
      "leadVocalNames": leadVocal[]->name
    }`,
    { id: serviceId }
  );
  if (!serviceMeta) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }
  const serviceLeadVocal =
    Array.isArray(serviceMeta.leadVocalNames)
      ? serviceMeta.leadVocalNames
          .map((name) => (typeof name === "string" ? name.trim() : ""))
          .find((name) => name.length > 0) ?? null
      : null;
  const leadVocal = normalizeString(body.leadVocal) ?? serviceLeadVocal;
  if (!leadVocal) {
    return NextResponse.json({ error: "Lead vocal is required." }, { status: 400 });
  }

  const sync = await syncServiceLeadVocalAssignment(client, serviceId, leadVocal);
  if ("error" in sync) {
    return NextResponse.json({ error: sync.error }, { status: 400 });
  }

  const doc = {
    _type: "setlist" as const,
    service: { _type: "reference" as const, _ref: serviceId },
    leadVocal,
    status: normalizeStatus(body.status),
    notes: normalizeString(body.notes) ?? undefined,
    songs: songsPayload,
  };

  const created = await client.create(doc);

  return NextResponse.json({ ok: true, setlist: { _id: created._id } }, { status: 201 });
}

export async function PATCH(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CreateSetlistBody & { setlistId?: string | null };
  const setlistId = normalizeString(body.setlistId);
  if (!setlistId) {
    return NextResponse.json({ error: "Setlist id is required." }, { status: 400 });
  }

  const client = getSanityWriteClient();
  const existingSetlist = await client.fetch<{ _id: string; serviceRef: string | null } | null>(
    `*[_type == "setlist" && _id == $id][0]{ _id, "serviceRef": service._ref }`,
    { id: setlistId }
  );
  if (!existingSetlist?._id) {
    return NextResponse.json({ error: "Setlist not found." }, { status: 404 });
  }

  const patch = client.patch(setlistId);
  let touched = false;

  if (body.serviceId !== undefined) {
    const nextService = normalizeString(body.serviceId);
    if (!nextService) {
      return NextResponse.json({ error: "Service cannot be empty." }, { status: 400 });
    }
    const dup = await client.fetch<number>(
      `count(*[_type == "setlist" && service._ref == $sid && _id != $id])`,
      { sid: nextService, id: setlistId }
    );
    if (dup > 0) {
      return NextResponse.json(
        { error: "Another setlist already uses this service." },
        { status: 409 }
      );
    }
    const svcCount = await client.fetch<number>(`count(*[_type == "service" && _id == $id])`, {
      id: nextService,
    });
    if (!svcCount) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }
    patch.set({ service: { _type: "reference", _ref: nextService } });
    touched = true;
  }

  if (body.leadVocal !== undefined) {
    const leadVocal = normalizeString(body.leadVocal);
    if (!leadVocal) {
      return NextResponse.json({ error: "Lead vocal cannot be empty." }, { status: 400 });
    }
    const targetServiceId =
      body.serviceId !== undefined ? normalizeString(body.serviceId) : existingSetlist.serviceRef;
    if (!targetServiceId) {
      return NextResponse.json(
        { error: "Cannot sync lead vocal: setlist has no linked service." },
        { status: 400 }
      );
    }
    const sync = await syncServiceLeadVocalAssignment(client, targetServiceId, leadVocal);
    if ("error" in sync) {
      return NextResponse.json({ error: sync.error }, { status: 400 });
    }
    patch.set({ leadVocal });
    touched = true;
  }

  if (body.status !== undefined) {
    patch.set({ status: normalizeStatus(body.status) });
    touched = true;
  }

  if (body.notes !== undefined) {
    patch.set({ notes: normalizeString(body.notes) ?? undefined });
    touched = true;
  }

  if (body.songs !== undefined) {
    let songsPayload: Array<Record<string, unknown>>;
    try {
      songsPayload = buildSongLines(body.songs);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid songs." },
        { status: 400 }
      );
    }
    patch.set({ songs: songsPayload });
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

  const body = (await req.json().catch(() => ({}))) as { setlistId?: string | null };
  const setlistId = normalizeString(body.setlistId);
  if (!setlistId) {
    return NextResponse.json({ error: "Setlist id is required." }, { status: 400 });
  }

  const client = getSanityWriteClient();
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "setlist" && _id == $id][0]{ _id }`,
    { id: setlistId }
  );
  if (!existing?._id) {
    return NextResponse.json({ error: "Setlist not found." }, { status: 404 });
  }

  await client.delete(setlistId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
