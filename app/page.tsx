import BandCalendarMonth from "../src/components/BandCalendarMonth";

export default function Home() {
  return (
    <div className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Church Band Calendar
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Month view is driven by Sanity service events and role assignments.
          </p>
        </header>
        <BandCalendarMonth />
      </main>
    </div>
  );
}
