import { createClient, type SanityClient } from "@sanity/client";

const API_VERSION = process.env.SANITY_API_VERSION ?? "2026-03-25";

export function getSanityProjectId(): string {
  return (process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "").trim();
}

export function getSanityDataset(): string {
  return (process.env.SANITY_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? "").trim();
}

export function getSanityWriteToken(): string | undefined {
  const t = process.env.SANITY_API_WRITE_TOKEN?.trim();
  return t || undefined;
}

/**
 * Server-only client with write access. Requires SANITY_API_WRITE_TOKEN.
 * Project/dataset fall back to NEXT_PUBLIC_* vars used by the embedded Studio.
 */
export function getSanityWriteClient(): SanityClient {
  const projectId = getSanityProjectId();
  const dataset = getSanityDataset();
  const token = getSanityWriteToken();
  if (!projectId || !dataset || !token) {
    const missing: string[] = [];
    if (!projectId) missing.push("SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_PROJECT_ID");
    if (!dataset) missing.push("SANITY_DATASET or NEXT_PUBLIC_SANITY_DATASET");
    if (!token) missing.push("SANITY_API_WRITE_TOKEN");
    throw new Error(
      `Missing Sanity configuration (${missing.join(", ")}). Add them to .env.local — the write token is required for contributions and password lookup.`
    );
  }
  return createClient({
    projectId,
    dataset,
    token,
    apiVersion: API_VERSION,
    useCdn: false,
  });
}
