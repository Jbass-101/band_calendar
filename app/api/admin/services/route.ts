import { NextResponse } from "next/server";
import { getContribAuthCookieName, isContribSessionValidFromCookie } from "@/src/lib/sanity/contributionsAuth";
import { fetchServicesForRange } from "@/src/lib/sanity/client";
import { getSanityWriteClient } from "@/src/lib/sanity/sanityWriteClient";

type ServiceVariant = "default" | "blue" | "green";

type ServiceBody = {
  serviceId?: string | null;
  title?: string | null;
  date?: string | null;
  notes?: string[] | null;
  variant?: ServiceVariant | null;
  showBandDetails?: boolean | null;
  uniform?: string | null;
  uniformWomen?: string | null;
  uniformMen?: string | null;
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

function normalizeNotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function normalizeVariant(value: unknown): ServiceVariant {
  if (value === "blue" || value === "green" || value === "default") return value;
  return "default";
}

export async function GET(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const from = normalizeDate(url.searchParams.get("from")) ?? "1900-01-01";
    const to = normalizeDate(url.searchParams.get("to")) ?? "2100-12-31";
    const services = await fetchServicesForRange(from, to);
    return NextResponse.json({ services }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load services";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as ServiceBody;
  const title = normalizeString(body.title);
  const date = normalizeDate(body.date);
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: "Date is required (YYYY-MM-DD)." }, { status: 400 });
  }

  const client = getSanityWriteClient();
  const created = await client.create({
    _type: "service",
    title,
    date,
    notes: normalizeNotes(body.notes),
    variant: normalizeVariant(body.variant),
    showBandDetails: body.showBandDetails !== false,
    uniform: normalizeString(body.uniform) ?? "Smart Casual",
    uniformWomen: normalizeString(body.uniformWomen) ?? undefined,
    uniformMen: normalizeString(body.uniformMen) ?? undefined,
  });

  return NextResponse.json({ ok: true, service: { _id: created._id } }, { status: 201 });
}

export async function PATCH(req: Request) {
  const isAuthorized = await isAuthorizedFromRequest(req);
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as ServiceBody;
  const serviceId = normalizeString(body.serviceId);
  if (!serviceId) {
    return NextResponse.json({ error: "Service id is required." }, { status: 400 });
  }

  const client = getSanityWriteClient();
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "service" && _id == $id][0]{ _id }`,
    { id: serviceId }
  );
  if (!existing?._id) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  const patch = client.patch(serviceId);
  let touched = false;

  if (body.title !== undefined) {
    const title = normalizeString(body.title);
    if (!title) return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
    patch.set({ title });
    touched = true;
  }
  if (body.date !== undefined) {
    const date = normalizeDate(body.date);
    if (!date) {
      return NextResponse.json({ error: "Date must be YYYY-MM-DD." }, { status: 400 });
    }
    patch.set({ date });
    touched = true;
  }
  if (body.notes !== undefined) {
    patch.set({ notes: normalizeNotes(body.notes) });
    touched = true;
  }
  if (body.variant !== undefined) {
    patch.set({ variant: normalizeVariant(body.variant) });
    touched = true;
  }
  if (body.showBandDetails !== undefined) {
    patch.set({ showBandDetails: body.showBandDetails === true });
    touched = true;
  }
  if (body.uniform !== undefined) {
    const uniform = normalizeString(body.uniform);
    patch.set({ uniform: uniform ?? "Smart Casual" });
    touched = true;
  }
  if (body.uniformWomen !== undefined) {
    patch.set({ uniformWomen: normalizeString(body.uniformWomen) ?? undefined });
    touched = true;
  }
  if (body.uniformMen !== undefined) {
    patch.set({ uniformMen: normalizeString(body.uniformMen) ?? undefined });
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

  const body = (await req.json().catch(() => ({}))) as { serviceId?: string | null };
  const serviceId = normalizeString(body.serviceId);
  if (!serviceId) {
    return NextResponse.json({ error: "Service id is required." }, { status: 400 });
  }

  const client = getSanityWriteClient();
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "service" && _id == $id][0]{ _id }`,
    { id: serviceId }
  );
  if (!existing?._id) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  await client.delete(serviceId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
