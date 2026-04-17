"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Setlist, SetlistStatus, ServicePickerOption, Song } from "@/src/lib/sanity/client";
import { formatIsoDateToDDMMYYYY } from "@/src/lib/formatDate";

type AdminSetlistsManagerProps = {
  authorized: boolean;
  initialSetlists: Setlist[];
  songs: Song[];
  services: ServicePickerOption[];
  embedded?: boolean;
};

type LineDraft = {
  _key: string;
  songId: string;
  section: string;
  note: string;
  keyOverride: string;
  tempoOverride: string;
  expanded: boolean;
};

type SectionDraft = {
  id: string;
  name: string;
  isDefault: boolean;
  collapsed: boolean;
  lines: LineDraft[];
};

const DEFAULT_SECTIONS = ["Prelude", "Praise", "Worship"] as const;

const KEY_OPTIONS = [
  "C (Do)",
  "C# (Di)",
  "D (Re)",
  "D# (Ri)",
  "E (Mi)",
  "F (Fa)",
  "F# (Fi)",
  "G (Sol)",
  "G# (Si)",
  "A (La)",
  "A# (Li)",
  "B (Ti)",
] as const;

const EMPTY_LINE = (section: string): LineDraft => ({
  _key: typeof crypto !== "undefined" ? crypto.randomUUID() : `k-${Date.now()}`,
  songId: "",
  section,
  note: "",
  keyOverride: "",
  tempoOverride: "",
  expanded: true,
});

const STATUS_OPTIONS: { value: SetlistStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "final", label: "Final" },
  { value: "archived", label: "Archived" },
];

function sortSongsForPicker(list: Song[]): Song[] {
  return [...list].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
}

const PAGE_SIZE = 20;
type SetlistSortKey = "service" | "leadVocal" | "status" | "songs";
const SORT_HEADER_BUTTON_CLASS =
  "inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors";
const PAGINATION_META_CLASS = "text-zinc-500 dark:text-zinc-400";
const PAGINATION_BUTTON_CLASS =
  "rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-zinc-700 dark:text-zinc-200 disabled:opacity-50";

export default function AdminSetlistsManager({
  authorized,
  initialSetlists,
  songs,
  services,
  embedded = false,
}: AdminSetlistsManagerProps) {
  void authorized;

  const router = useRouter();
  const [setlists, setSetlists] = useState<Setlist[]>(initialSetlists);

  useEffect(() => {
    setSetlists(initialSetlists);
  }, [initialSetlists]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SetlistSortKey>("service");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [serviceDate, setServiceDate] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [leadVocal, setLeadVocal] = useState("");
  const [leadVocalDirty, setLeadVocalDirty] = useState(false);
  const [status, setStatus] = useState<SetlistStatus>("draft");
  const [notes, setNotes] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>([]);
  const [newSectionName, setNewSectionName] = useState("");

  const sortedSongs = useMemo(() => sortSongsForPicker(songs.filter((s) => s.active)), [songs]);
  const songNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const song of sortedSongs) {
      map.set(song._id, `#${song.number} ${song.name}`);
    }
    return map;
  }, [sortedSongs]);

  const refreshSetlists = useCallback(async () => {
    const res = await fetch("/api/admin/setlists", { credentials: "include" });
    const payload = (await res.json().catch(() => ({}))) as { error?: string; setlists?: Setlist[] };
    if (!res.ok) throw new Error(payload.error ?? "Failed to load setlists");
    setSetlists(payload.setlists ?? []);
    router.refresh();
  }, [router]);

  const availableServices = useMemo(() => {
    const taken = new Set(
      setlists.filter((sl) => sl._id !== editingId).map((sl) => sl.serviceId)
    );
    return services.filter((s) => !taken.has(s._id) || s._id === serviceId);
  }, [services, setlists, editingId, serviceId]);

  const servicesByDate = useMemo(() => {
    const grouped = new Map<string, ServicePickerOption[]>();
    for (const svc of availableServices) {
      const list = grouped.get(svc.date) ?? [];
      list.push(svc);
      grouped.set(svc.date, list);
    }
    return grouped;
  }, [availableServices]);

  const availableServiceDates = useMemo(
    () => Array.from(servicesByDate.keys()).sort((a, b) => a.localeCompare(b)),
    [servicesByDate]
  );

  const servicesForDate = useMemo(() => servicesByDate.get(serviceDate) ?? [], [servicesByDate, serviceDate]);
  const selectedService = useMemo(
    () => availableServices.find((svc) => svc._id === serviceId) ?? null,
    [availableServices, serviceId]
  );

  function createDefaultSections(): SectionDraft[] {
    return DEFAULT_SECTIONS.map((name, idx) => ({
      id: `default-${idx}-${name.toLowerCase()}`,
      name,
      isDefault: true,
      collapsed: false,
      lines: [],
    }));
  }

  function hydrateSectionsFromSetlist(sl: Setlist): SectionDraft[] {
    const map = new Map<string, SectionDraft>();
    for (const name of DEFAULT_SECTIONS) {
      map.set(name, {
        id: `default-${name.toLowerCase()}`,
        name,
        isDefault: true,
        collapsed: false,
        lines: [],
      });
    }

    for (const row of sl.songs) {
      const sectionName = row.section?.trim() || "Worship";
      if (!map.has(sectionName)) {
        map.set(sectionName, {
          id: `custom-${typeof crypto !== "undefined" ? crypto.randomUUID() : Date.now()}`,
          name: sectionName,
          isDefault: false,
          collapsed: false,
          lines: [],
        });
      }
      const target = map.get(sectionName);
      if (!target) continue;
      target.lines.push({
        _key: row._key,
        songId: row.songId ?? "",
        section: sectionName,
        note: row.note ?? "",
        keyOverride: row.keyOverride ?? "",
        tempoOverride: row.tempoOverride != null ? String(row.tempoOverride) : "",
        expanded: true,
      });
    }

    return Array.from(map.values());
  }

  function allLines(): LineDraft[] {
    return sections.flatMap((section) => section.lines.map((line) => ({ ...line, section: section.name })));
  }

  function openCreate() {
    setEditingId(null);
    setServiceDate("");
    setServiceId("");
    setLeadVocal("");
    setLeadVocalDirty(false);
    setStatus("draft");
    setNotes("");
    setSections(createDefaultSections());
    setNewSectionName("");
    setModalOpen(true);
  }

  function openEdit(sl: Setlist) {
    setEditingId(sl._id);
    setServiceDate(sl.serviceDate);
    setServiceId(sl.serviceId);
    setLeadVocal(sl.assignedLeadVocal ?? sl.leadVocalNames[0] ?? "");
    setLeadVocalDirty(true);
    setStatus(sl.status);
    setNotes(sl.notes ?? "");
    setSections(hydrateSectionsFromSetlist(sl));
    setNewSectionName("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
  }

  function addSection() {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    if (sections.some((section) => section.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("That section already exists.");
      return;
    }
    setSections((prev) => [
      ...prev,
      {
        id: `custom-${typeof crypto !== "undefined" ? crypto.randomUUID() : Date.now()}`,
        name: trimmed,
        isDefault: false,
        collapsed: false,
        lines: [],
      },
    ]);
    setNewSectionName("");
  }

  function removeSection(sectionIdx: number) {
    const section = sections[sectionIdx];
    if (!section || section.isDefault) return;
    const filledCount = section.lines.filter((line) => line.songId.trim()).length;
    if (filledCount > 0) {
      const ok = window.confirm(`Delete section "${section.name}" and its ${filledCount} song(s)?`);
      if (!ok) return;
    }
    setSections((prev) => prev.filter((_, idx) => idx !== sectionIdx));
  }

  function toggleSectionCollapsed(sectionIdx: number) {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === sectionIdx ? { ...section, collapsed: !section.collapsed } : section
      )
    );
  }

  function addLine(sectionIdx: number) {
    setSections((prev) =>
      prev.map((section, idx) =>
        idx === sectionIdx ? { ...section, lines: [...section.lines, EMPTY_LINE(section.name)] } : section
      )
    );
  }

  function removeLine(sectionIdx: number, lineIdx: number) {
    setSections((prev) =>
      prev.map((section, idx) => {
        if (idx !== sectionIdx) return section;
        return { ...section, lines: section.lines.filter((_, i) => i !== lineIdx) };
      })
    );
  }

  function moveLine(sectionIdx: number, lineIdx: number, dir: -1 | 1) {
    setSections((prev) =>
      prev.map((section, idx) => {
        if (idx !== sectionIdx) return section;
        const next = lineIdx + dir;
        if (next < 0 || next >= section.lines.length) return section;
        const copy = [...section.lines];
        const t = copy[lineIdx];
        copy[lineIdx] = copy[next]!;
        copy[next] = t!;
        return { ...section, lines: copy };
      })
    );
  }

  function updateLine(sectionIdx: number, lineIdx: number, patch: Partial<LineDraft>) {
    setSections((prev) =>
      prev.map((section, idx) => {
        if (idx !== sectionIdx) return section;
        return {
          ...section,
          lines: section.lines.map((line, i) => (i === lineIdx ? { ...line, ...patch } : line)),
        };
      })
    );
  }

  function moveSection(sectionIdx: number, dir: -1 | 1) {
    setSections((prev) => {
      const next = sectionIdx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const t = copy[sectionIdx];
      copy[sectionIdx] = copy[next]!;
      copy[next] = t!;
      return copy;
    });
  }

  useEffect(() => {
    if (!modalOpen) return;
    if (!serviceDate) {
      if (serviceId) setServiceId("");
      return;
    }
    const choices = servicesByDate.get(serviceDate) ?? [];
    if (choices.length === 0) {
      setServiceId("");
      return;
    }
    if (choices.length === 1) {
      setServiceId(choices[0]!._id);
      return;
    }
    const exists = choices.some((svc) => svc._id === serviceId);
    if (!exists) setServiceId("");
  }, [servicesByDate, serviceDate, serviceId, modalOpen]);

  useEffect(() => {
    if (!modalOpen || !serviceDate) return;
    if (availableServiceDates.includes(serviceDate)) return;
    setServiceDate("");
    setServiceId("");
  }, [availableServiceDates, modalOpen, serviceDate]);

  useEffect(() => {
    if (!modalOpen || !selectedService) return;
    if (leadVocalDirty) return;
    setLeadVocal(selectedService.leadVocalNames[0] ?? "");
  }, [modalOpen, selectedService, leadVocalDirty]);

  const filteredSetlists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return setlists;
    return setlists.filter((sl) => {
      const hay = [
        sl.serviceDate,
        sl.serviceTitle,
        sl.status,
        sl.notes ?? "",
        sl.leadVocalNames.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [setlists, query]);

  const sortedSetlists = useMemo(() => {
    const factor = sortDirection === "asc" ? 1 : -1;
    return [...filteredSetlists].sort((a, b) => {
      if (sortKey === "leadVocal") {
        return factor * (a.leadVocalNames.join(", ").localeCompare(b.leadVocalNames.join(", ")));
      }
      if (sortKey === "status") return factor * a.status.localeCompare(b.status);
      if (sortKey === "songs") return factor * (a.songs.length - b.songs.length);
      return factor * a.serviceDate.localeCompare(b.serviceDate);
    });
  }, [filteredSetlists, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedSetlists.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSetlists = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedSetlists.slice(start, start + PAGE_SIZE);
  }, [safePage, sortedSetlists]);

  function toggleSort(nextKey: SetlistSortKey) {
    setPage(1);
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "service" ? "desc" : "asc");
  }

  function sortIcon(key: SetlistSortKey) {
    if (sortKey !== key) return "△";
    return sortDirection === "asc" ? "▲" : "▼";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!serviceId) {
      toast.error("Choose a service.");
      return;
    }
    const trimmedLeadVocal = leadVocal.trim();
    if (!trimmedLeadVocal) {
      toast.error("Select or enter a lead vocal.");
      return;
    }
    const filledLines = allLines().filter((l) => l.songId.trim());
    if (filledLines.length === 0) {
      toast.error("Add at least one song.");
      return;
    }

    const songsPayload = filledLines.map((l) => {
      const tempoTrim = l.tempoOverride.trim();
      let tempoOverride: number | undefined = undefined;
      if (tempoTrim !== "") {
        const n = Number.parseInt(tempoTrim, 10);
        if (Number.isFinite(n) && n >= 1 && n <= 400) tempoOverride = n;
      }
      return {
        _key: l._key,
        songId: l.songId.trim(),
        section: l.section.trim() || "Worship",
        note: l.note.trim() || null,
        keyOverride: l.keyOverride.trim() || null,
        tempoOverride: tempoOverride ?? null,
      };
    });

    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch("/api/admin/setlists", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            setlistId: editingId,
            serviceId,
            leadVocal: trimmedLeadVocal,
            status,
            notes: notes.trim() || null,
            songs: songsPayload,
          }),
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Failed to update setlist");
        toast.success("Setlist updated");
      } else {
        const res = await fetch("/api/admin/setlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            serviceId,
            leadVocal: trimmedLeadVocal,
            status,
            notes: notes.trim() || null,
            songs: songsPayload,
          }),
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Failed to create setlist");
        toast.success("Setlist created");
      }
      try {
        await refreshSetlists();
      } catch {
        // Preserve successful create/update even if the immediate refresh request fails.
        router.refresh();
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sl: Setlist) {
    const ok = window.confirm(
      `Delete this setlist for ${formatIsoDateToDDMMYYYY(sl.serviceDate)} (${sl.serviceTitle})? This cannot be undone.`
    );
    if (!ok) return;
    try {
      const res = await fetch("/api/admin/setlists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ setlistId: sl._id }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to delete");
      toast.success("Setlist deleted");
      await refreshSetlists();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section className="space-y-4">
      {!embedded ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
          <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Setlists Admin
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Create and edit setlists linked to calendar services.
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Manage setlists</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Total: {setlists.length}</p>
          </div>
          <button
            type="button"
            onClick={() => openCreate()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium"
          >
            Create setlist
          </button>
        </div>

        <label className="block mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Search
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            placeholder="Filter by title, date, service..."
          />
        </label>

        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2 px-3">
                  <button type="button" onClick={() => toggleSort("service")} className={SORT_HEADER_BUTTON_CLASS}>
                    Service {sortIcon("service")}
                  </button>
                </th>
                <th className="py-2 pr-3">
                  <button type="button" onClick={() => toggleSort("leadVocal")} className={SORT_HEADER_BUTTON_CLASS}>
                    Lead vocal {sortIcon("leadVocal")}
                  </button>
                </th>
                <th className="py-2 pr-3">
                  <button type="button" onClick={() => toggleSort("status")} className={SORT_HEADER_BUTTON_CLASS}>
                    Status {sortIcon("status")}
                  </button>
                </th>
                <th className="py-2 pr-3">
                  <button type="button" onClick={() => toggleSort("songs")} className={SORT_HEADER_BUTTON_CLASS}>
                    Songs {sortIcon("songs")}
                  </button>
                </th>
                <th className="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedSetlists.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 px-3 text-zinc-500">
                    No setlists match.
                  </td>
                </tr>
              ) : (
                pagedSetlists.map((sl) => (
                  <tr key={sl._id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                    <td className="py-2 px-3 text-zinc-800 dark:text-zinc-100">
                      <div className="font-medium">{formatIsoDateToDDMMYYYY(sl.serviceDate)}</div>
                      <div className="text-zinc-500 dark:text-zinc-400">{sl.serviceTitle}</div>
                    </td>
                    <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                      {sl.leadVocalNames.join(", ") || "—"}
                    </td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">{sl.status}</td>
                    <td className="py-2 pr-3">{sl.songs.length}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(sl)}
                        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs mr-1"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(sl)}
                        className="rounded-md border border-red-300 dark:border-red-800 px-2 py-1 text-xs text-red-700 dark:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedSetlists.length > PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-between gap-2 text-xs sm:text-sm">
            <div className={PAGINATION_META_CLASS}>
              Showing {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, sortedSetlists.length)} of {sortedSetlists.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className={PAGINATION_BUTTON_CLASS}
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className={PAGINATION_BUTTON_CLASS}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Edit setlist" : "Create setlist"}
          onClick={() => closeModal()}
        >
          <div
            className="w-full max-w-3xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {editingId ? "Edit setlist" : "Create setlist"}
              </h3>
              <button
                type="button"
                onClick={() => closeModal()}
                disabled={saving}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Service date
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (!next || availableServiceDates.includes(next)) {
                      setServiceDate(next);
                      return;
                    }
                    toast.error("That date has no available service.");
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  required
                />
              </label>
              {serviceDate && servicesForDate.length > 1 ? (
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Service
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Choose service…</option>
                    {servicesForDate.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Only dates with available services can be used. Available: {availableServiceDates.length}.
              </p>
              {serviceDate && servicesForDate.length === 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  No service available on this date.
                </p>
              ) : null}

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Lead vocal
                <input
                  type="text"
                  value={leadVocal}
                  onChange={(e) => {
                    setLeadVocal(e.target.value);
                    setLeadVocalDirty(true);
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  placeholder="e.g. Jane Doe"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SetlistStatus)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Notes
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              </label>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Sections and songs</p>
                  <div className="flex gap-2">
                    <input
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="Special section name"
                      className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={addSection}
                      className="text-sm font-medium text-emerald-600 dark:text-emerald-400"
                    >
                      + Add section
                    </button>
                  </div>
                </div>
                <div className="mt-2 space-y-3">
                  {sections.map((section, sectionIdx) => (
                    <div
                      key={section.id}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-2"
                    >
                      <div className="flex flex-wrap gap-2 justify-between items-center">
                        <button
                          type="button"
                          onClick={() => toggleSectionCollapsed(sectionIdx)}
                          className="text-sm font-semibold text-zinc-700 dark:text-zinc-200"
                        >
                          {section.collapsed ? "▶" : "▼"} {section.name} ({section.lines.length})
                        </button>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="text-xs border rounded px-1.5 py-0.5"
                            onClick={() => moveSection(sectionIdx, -1)}
                            disabled={sectionIdx === 0}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            className="text-xs border rounded px-1.5 py-0.5"
                            onClick={() => moveSection(sectionIdx, 1)}
                            disabled={sectionIdx === sections.length - 1}
                          >
                            Down
                          </button>
                          {!section.isDefault ? (
                            <button
                              type="button"
                              className="text-xs border border-red-300 rounded px-1.5 py-0.5 text-red-700"
                              onClick={() => removeSection(sectionIdx)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {!section.collapsed ? (
                        <>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => addLine(sectionIdx)}
                              className="text-sm font-medium text-emerald-600 dark:text-emerald-400"
                            >
                              + Add song to {section.name}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {section.lines.length === 0 ? (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                No songs in this section yet.
                              </p>
                            ) : (
                              section.lines.map((line, idx) => (
                                <div
                                  key={line._key}
                                  className="rounded border border-zinc-200 dark:border-zinc-800 p-2 space-y-2"
                                >
                                  <div className="flex flex-wrap justify-between items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateLine(sectionIdx, idx, { expanded: !line.expanded })
                                      }
                                      className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                                    >
                                      {line.expanded ? "▼" : "▶"} Slot {idx + 1}
                                      {line.songId
                                        ? ` - ${songNameById.get(line.songId) ?? "Selected song"}`
                                        : " - No song selected"}
                                    </button>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        className="text-xs border rounded px-1.5 py-0.5"
                                        onClick={() => moveLine(sectionIdx, idx, -1)}
                                        disabled={idx === 0}
                                      >
                                        Up
                                      </button>
                                      <button
                                        type="button"
                                        className="text-xs border rounded px-1.5 py-0.5"
                                        onClick={() => moveLine(sectionIdx, idx, 1)}
                                        disabled={idx === section.lines.length - 1}
                                      >
                                        Down
                                      </button>
                                      <button
                                        type="button"
                                        className="text-xs border border-red-300 rounded px-1.5 py-0.5 text-red-700"
                                        onClick={() => removeLine(sectionIdx, idx)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                  {line.expanded ? (
                                    <>
                                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                        Song
                                        <select
                                          value={line.songId}
                                          onChange={(e) =>
                                            updateLine(sectionIdx, idx, { songId: e.target.value })
                                          }
                                          className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
                                        >
                                          <option value="">Choose…</option>
                                          {sortedSongs.map((s) => (
                                            <option key={s._id} value={s._id}>
                                              #{s.number} {s.name}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <label className="block text-xs text-zinc-600 dark:text-zinc-300">
                                          Note
                                          <input
                                            value={line.note}
                                            onChange={(e) =>
                                              updateLine(sectionIdx, idx, { note: e.target.value })
                                            }
                                            className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm"
                                          />
                                        </label>
                                        <label className="block text-xs text-zinc-600 dark:text-zinc-300">
                                          Key override
                                          <select
                                            value={line.keyOverride}
                                            onChange={(e) =>
                                              updateLine(sectionIdx, idx, { keyOverride: e.target.value })
                                            }
                                            className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm bg-white dark:bg-zinc-900"
                                          >
                                            <option value="">Use song default</option>
                                            {KEY_OPTIONS.map((opt) => (
                                              <option key={opt} value={opt}>
                                                {opt}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <label className="block text-xs text-zinc-600 dark:text-zinc-300">
                                          Tempo (BPM)
                                          <input
                                            value={line.tempoOverride}
                                            onChange={(e) =>
                                              updateLine(sectionIdx, idx, { tempoOverride: e.target.value })
                                            }
                                            className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm"
                                            placeholder="Override"
                                          />
                                        </label>
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  disabled={saving}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-70"
                >
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create setlist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
