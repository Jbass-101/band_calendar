import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/src/components/LoginForm";
import { BRANDING } from "@/src/lib/branding";
import {
  getContribAuthCookieName,
  isContribSessionValidFromCookie,
} from "@/src/lib/sanity/contributionsAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login | Last Harvest Choir",
  description: "Sign in to access the Last Harvest Choir admin dashboard.",
  alternates: {
    canonical: "/login",
  },
};

export default async function LoginPage() {
  const cookieStore = await cookies();
  const cookieName = getContribAuthCookieName();
  const cookieValue = cookieStore.get(cookieName)?.value;
  const authorized = await isContribSessionValidFromCookie(cookieValue);

  if (authorized) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100/80 dark:bg-black">
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2">
        <section className="hidden lg:flex min-h-full bg-zinc-900 text-white items-end p-10">
          <div className="max-w-md">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-300">Admin Access</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{BRANDING.main.title}</h1>
            <p className="mt-4 text-sm text-zinc-300 leading-relaxed">
              Placeholder visual panel. This space can later hold ministry imagery or a branded
              illustration for the admin login experience.
            </p>
          </div>
        </section>

        <section className="min-h-full flex items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-6 sm:p-8 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Welcome back
            </p>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Admin login
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Use the current admin password to access the dashboard. Signed-in users will be sent
              directly to the admin portal automatically.
            </p>
            <LoginForm />
          </div>
        </section>
      </main>

      <footer className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 pb-3 bg-white/70 dark:bg-zinc-950/40 backdrop-blur-sm">
        Powered by{" "}
        <a
          href="https://extrabrains.co.za/"
          className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded-sm"
        >
          Extra Brains
        </a>
      </footer>
    </div>
  );
}

