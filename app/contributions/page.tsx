import { cookies } from "next/headers";
import ContributionsManager from "@/src/components/ContributionsManager";
import { getSanityUserFromToken, userHasAllowedRole } from "@/src/lib/sanity/roleAuth";

export const dynamic = "force-dynamic";

export default async function ContributionsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("contrib_sanity_token")?.value ?? "";
  const user = token ? await getSanityUserFromToken(token) : null;
  const authorized = userHasAllowedRole(user);

  return (
    <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <ContributionsManager authorized={authorized} />
    </main>
  );
}

