const SANITY_API_VERSION = process.env.SANITY_API_VERSION ?? "2026-03-25";

type SanityRole =
  | string
  | {
      name?: string;
      title?: string;
      _id?: string;
      [key: string]: unknown;
    };

type SanityMeResponse = {
  id?: string;
  name?: string;
  email?: string;
  roles?: SanityRole[];
};

export type SanityUserProfile = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

function normalizeRole(role: SanityRole): string | null {
  if (typeof role === "string") return role.trim().toLowerCase();
  const candidate = role.name ?? role.title ?? role._id;
  if (typeof candidate !== "string") return null;
  return candidate.trim().toLowerCase();
}

export function getAllowedSanityRoles(): string[] {
  const raw = process.env.SANITY_CONTRIBUTIONS_ALLOWED_ROLES ?? "administrator";
  return raw
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

export async function getSanityUserFromToken(token: string): Promise<SanityUserProfile | null> {
  const projectId = process.env.SANITY_PROJECT_ID;
  if (!projectId) return null;
  const urls = [
    `https://${projectId}.api.sanity.io/${SANITY_API_VERSION}/users/me`,
    `https://api.sanity.io/${SANITY_API_VERSION}/users/me`,
  ];

  for (const url of urls) {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) continue;

    const body = (await res.json()) as SanityMeResponse;
    const roles = Array.isArray(body.roles)
      ? body.roles.map(normalizeRole).filter((r): r is string => Boolean(r))
      : [];

    return {
      id: body.id ?? "",
      name: body.name ?? "",
      email: body.email ?? "",
      roles,
    };
  }

  return null;
}

export function userHasAllowedRole(user: SanityUserProfile | null): boolean {
  if (!user) return false;
  const allowed = getAllowedSanityRoles();
  if (allowed.length === 0) return false;
  return user.roles.some((role) => allowed.includes(role));
}

