import { createClient } from "@sanity/client";
import { NextResponse } from "next/server";
import { getSanityUserFromToken, userHasAllowedRole } from "@/src/lib/sanity/roleAuth";

type ContributionRecord = {
  _id: string;
  month: string;
  amount: number;
  paid: boolean;
  paidDate?: string | null;
  notes?: string | null;
  member: { _ref: string } | null;
  memberName: string | null;
};

type MemberOption = {
  _id: string;
  name: string;
  roles?: string[];
};

function getWriteClient(token: string) {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET;
  if (!projectId || !dataset || !token) {
    throw new Error("Missing SANITY_PROJECT_ID/SANITY_DATASET/token");
  }
  return createClient({
    projectId,
    dataset,
    token,
    apiVersion: process.env.SANITY_API_VERSION ?? "2026-03-25",
    useCdn: false,
  });
}

async function getAuthorizedToken(req: Request): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const pairs = cookieHeader.split(";").map((s) => s.trim());
  const pair = pairs.find((p) => p.startsWith("contrib_sanity_token="));
  const token = pair ? decodeURIComponent(pair.split("=")[1] ?? "") : "";
  if (!token) return null;

  const user = await getSanityUserFromToken(token);
  if (!userHasAllowedRole(user)) return null;
  return token;
}

function normalizeMonth(input: string): string {
  // Accept YYYY-MM and convert to YYYY-MM-01.
  if (/^\d{4}-\d{2}$/.test(input)) return `${input}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m] = input.split("-");
    return `${y}-${m}-01`;
  }
  throw new Error("Invalid month format. Use YYYY-MM.");
}

export async function GET(req: Request) {
  try {
    const token = await getAuthorizedToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const monthRaw = url.searchParams.get("month");
    if (!monthRaw) {
      return NextResponse.json({ error: "Missing month query param" }, { status: 400 });
    }
    const month = normalizeMonth(monthRaw);

    const client = getWriteClient(token);
    const [contributions, members] = await Promise.all([
      client.fetch<ContributionRecord[]>(
        `*[_type == "contribution" && month == $month] | order(member->name asc) {
          _id,
          month,
          amount,
          paid,
          paidDate,
          notes,
          member,
          "memberName": member->name
        }`,
        { month }
      ),
      client.fetch<MemberOption[]>(
        `*[_type == "musician"] | order(name asc) {
          _id,
          name,
          roles
        }`
      ),
    ]);

    return NextResponse.json({ month, contributions, members }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const token = await getAuthorizedToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      memberId?: string;
      month?: string;
      amount?: number;
      paid?: boolean;
      paidDate?: string | null;
      notes?: string | null;
    };

    if (!body.memberId || !body.month || typeof body.amount !== "number") {
      return NextResponse.json(
        { error: "Missing required fields: memberId, month, amount" },
        { status: 400 }
      );
    }

    const month = normalizeMonth(body.month);
    const amount = Number(body.amount);
    const paid = Boolean(body.paid);
    const paidDate = paid && body.paidDate ? body.paidDate : null;
    const notes = typeof body.notes === "string" ? body.notes : null;

    const client = getWriteClient(token);
    const existing = await client.fetch<Array<{ _id: string }>>(
      `*[_type == "contribution" && member._ref == $memberId && month == $month][0...1]{ _id }`,
      { memberId: body.memberId, month }
    );

    const patch = {
      member: { _type: "reference", _ref: body.memberId },
      month,
      amount,
      paid,
      paidDate,
      notes,
    };

    if (existing.length > 0) {
      await client.patch(existing[0]._id).set(patch).commit();
    } else {
      await client.create({
        _type: "contribution",
        ...patch,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

