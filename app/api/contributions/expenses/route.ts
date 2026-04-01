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

async function isAuthorized(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const pairs = cookieHeader.split(";").map((s) => s.trim());
  const cookieName = getContribAuthCookieName();
  const pair = pairs.find((p) => p.startsWith(`${cookieName}=`));
  const cookieValue = pair ? decodeURIComponent(pair.split("=")[1] ?? "") : "";
  return isContribSessionValidFromCookie(cookieValue || undefined);
}

function normalizeMonth(input: string): string {
  if (/^\d{4}-\d{2}$/.test(input)) return `${input}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m] = input.split("-");
    return `${y}-${m}-01`;
  }
  throw new Error("Invalid month format. Use YYYY-MM.");
}

export async function POST(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      date?: string;
      month?: string;
      amount?: number;
      description?: string;
      notes?: string | null;
    };

    if ((!body.date && !body.month) || typeof body.amount !== "number" || !body.description?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: date/month, amount, description" },
        { status: 400 }
      );
    }

    const monthInput = body.month ?? body.date?.slice(0, 7);
    if (!monthInput) {
      return NextResponse.json({ error: "Missing date/month" }, { status: 400 });
    }
    const month = normalizeMonth(monthInput);
    const amount = Number(body.amount);
    if (amount < 0 || Number.isNaN(amount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const client = getSanityWriteClient();
    const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
    const meta = extractRequestMeta(req);
    const created = await client.create({
      _type: "contributionExpense",
      date: body.date,
      month,
      amount,
      description: body.description.trim(),
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined,
    });

    await writeContributionLogSafe(client, {
      eventType: "expense.create",
      action: "create",
      entityType: "expense",
      entityId: created._id,
      month,
      summary: `Created expense R${amount.toFixed(2)} — ${body.description.trim()}`,
      deviceId,
      ...meta,
    });

    const res = NextResponse.json({ ok: true, id: created._id }, { status: 200 });
    if (needsNewCookie) applyDeviceCookieToResponse(res, deviceId);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      id?: string;
      date?: string;
      amount?: number;
      description?: string;
      notes?: string | null;
    };

    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const client = getSanityWriteClient();
    const existing = await client.fetch<{
      _id: string;
      date?: string | null;
      month?: string;
      amount?: number;
      description?: string;
      notes?: string | null;
    } | null>(
      `*[_type == "contributionExpense" && _id == $id][0]{ _id, date, month, amount, description, notes }`,
      { id }
    );

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const date =
      typeof body.date === "string" && body.date.trim().length > 0
        ? body.date.trim()
        : existing.date ?? null;
    if (!date) {
      return NextResponse.json({ error: "Expense date is required" }, { status: 400 });
    }

    const month = normalizeMonth(date.slice(0, 7));
    const amount =
      typeof body.amount === "number" && !Number.isNaN(body.amount) ? body.amount : existing.amount ?? NaN;
    if (Number.isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const description =
      typeof body.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : existing.description ?? "";
    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    let patchBuilder = client.patch(id).set({
      date,
      month,
      amount,
      description,
    });

    if (typeof body.notes === "string") {
      const t = body.notes.trim();
      if (t.length > 0) {
        patchBuilder = patchBuilder.set({ notes: t });
      } else {
        patchBuilder = patchBuilder.unset(["notes"]);
      }
    }

    await patchBuilder.commit();

    const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
    const meta = extractRequestMeta(req);
    await writeContributionLogSafe(client, {
      eventType: "expense.update",
      action: "update",
      entityType: "expense",
      entityId: id,
      month,
      summary: `Updated expense R${amount.toFixed(2)} — ${description}`,
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

export async function DELETE(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing id query param" }, { status: 400 });
    }

    const client = getSanityWriteClient();
    const existing = await client.fetch<{
      _id: string;
      month?: string;
      amount?: number;
      description?: string;
    } | null>(
      `*[_type == "contributionExpense" && _id == $id][0]{ _id, month, amount, description }`,
      { id }
    );
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await client.delete(id);

    const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
    const meta = extractRequestMeta(req);
    const amt = typeof existing.amount === "number" ? existing.amount : 0;
    await writeContributionLogSafe(client, {
      eventType: "expense.delete",
      action: "delete",
      entityType: "expense",
      entityId: id,
      month: existing.month,
      summary: `Deleted expense R${amt.toFixed(2)} — ${existing.description ?? id}`,
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
