import { createHash } from "crypto";
import { getSanityWriteClient } from "@/src/lib/sanity/sanityWriteClient";

const COOKIE_NAME = "contrib_auth";
const ACCESS_DOC_QUERY = `*[_type == "contributionAccess"] | order(_updatedAt desc)[0]{ password }`;

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function getContribAuthCookieName() {
  return COOKIE_NAME;
}

export async function getContributionsPassword(): Promise<string | null> {
  const client = getSanityWriteClient();
  const access = await client.fetch<{ password?: string } | null>(ACCESS_DOC_QUERY);
  const password = access?.password;
  if (typeof password !== "string" || password.trim().length === 0) return null;
  return password.trim();
}

export async function validateContributionsPassword(password: string): Promise<boolean> {
  const current = await getContributionsPassword();
  if (!current) return false;
  return password.trim() === current;
}

export async function getContribAuthSignature(): Promise<string | null> {
  const password = await getContributionsPassword();
  if (!password) return null;
  return hashPassword(password);
}

export async function isContribSessionValidFromCookie(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const signature = await getContribAuthSignature();
  if (!signature) return false;
  return cookieValue === signature;
}

