"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import BandCalendarMonth from "@/src/components/BandCalendarMonth";
import type { Service } from "@/src/lib/sanity/client";
import { formatIsoDateToDDMMYYYY } from "@/src/lib/formatDate";

type AdminBandCalendarManagerProps = {
  authorized: boolean;
};

type ServiceDraft = {
  title: string;
  date: string;
  notes: string;
  variant: "default" | "blue" | "green";
  showBandDetails: boolean;
  uniform: string;
  uniformWomen: string;
  uniformMen: string;
};

type RehearsalItem = {
  _id: string;
  date: string;
  name?: string | null;
  repeatEveryDays?: number | null;
  untilDate?: string | null;
};

type RehearsalDraft = {
  date: string;
  name: string;
  repeatEveryDays: string;
  untilDate: string;
};

type ManagerTab =
  | "calendar"
  | "manage-services"
  | "manage-rehearsals";

const EMPTY_SERVICE_DRAFT: ServiceDraft = {
  title: "",
  date: "",
  notes: "",
  variant: "default",
  showBandDetails: true,
  uniform: "Smart Casual",
  uniformWomen: "",
  uniformMen: "",
};

const EMPTY_REHEARSAL_DRAFT: RehearsalDraft = {
  date: "",
  name: "",
  repeatEveryDays: "",
  untilDate: "",
};

const PAGE_SIZE = 20;
const SORT_HEADER_BUTTON_CLASS =
  "inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors";
const PAGINATION_META_CLASS = "text-zinc-500 dark:text-zinc-400";
const PAGINATION_BUTTON_CLASS =
  "rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-zinc-700 dark:text-zinc-200 disabled:opacity-50";

function notesToArray(notesText: string): string[] {
  return notesText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function serviceToDraft(service: Service): ServiceDraft {
  return {
    title: service.title,
    date: service.date,
    notes: service.notes.join("\n"),
    variant: service.variant,
    showBandDetails: service.showBandDetails,
    uniform: service.uniform,
    uniformWomen: service.uniformWomen ?? "",
    uniformMen: service.uniformMen ?? "",
  };
}

function rehearsalToDraft(rehearsal: RehearsalItem): RehearsalDraft {
  return {
    date: rehearsal.date,
    name: rehearsal.name ?? "",
    repeatEveryDays:
      rehearsal.repeatEveryDays != null && Number.isFinite(rehearsal.repeatEveryDays)
        ? String(rehearsal.repeatEveryDays)
        : "",
    untilDate: rehearsal.untilDate ?? "",
  };
}

function getLeadVocalNames(service: Service): string {
  const lead = service.assignments.find((item) => item.role === "Lead Vocal");
  const names = lead?.musicianNames ?? [];
  if (names.length < 1) return "—";
  return names.join(", ");
}

export default function AdminBandCalendarManager({ authorized }: AdminBandCalendarManagerProps) {
  void authorized;

  const [activeTab, setActiveTab] = useState<ManagerTab>("calendar");
  const [calendarKey, setCalendarKey] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [rehearsals, setRehearsals] = useState<RehearsalItem[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createServiceDraft, setCreateServiceDraft] = useState<ServiceDraft>(EMPTY_SERVICE_DRAFT);
  const [createServiceBusy, setCreateServiceBusy] = useState(false);
  const [createServiceModalOpen, setCreateServiceModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editServiceDraft, setEditServiceDraft] = useState<ServiceDraft>(EMPTY_SERVICE_DRAFT);
  const [serviceQuery, setServiceQuery] = useState("");
  const [servicePage, setServicePage] = useState(1);
  const [serviceSortKey, setServiceSortKey] = useState<"date" | "service" | "leadVocal">("date");
  const [serviceSortDirection, setServiceSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedServiceMonth, setSelectedServiceMonth] = useState("");

  const [createRehearsalDraft, setCreateRehearsalDraft] = useState<RehearsalDraft>(EMPTY_REHEARSAL_DRAFT);
  const [createRehearsalBusy, setCreateRehearsalBusy] = useState(false);
  const [createRehearsalModalOpen, setCreateRehearsalModalOpen] = useState(false);
  const [editingRehearsalId, setEditingRehearsalId] = useState<string | null>(null);
  const [editRehearsalDraft, setEditRehearsalDraft] = useState<RehearsalDraft>(EMPTY_REHEARSAL_DRAFT);
  const [rehearsalPage, setRehearsalPage] = useState(1);
  const [rehearsalSortKey, setRehearsalSortKey] = useState<"date" | "name" | "recurrence">("date");
  const [rehearsalSortDirection, setRehearsalSortDirection] = useState<"asc" | "desc">("desc");

  const listRange = useMemo(() => {
    const now = new Date();
    const from = `${now.getFullYear() - 1}-01-01`;
    const to = `${now.getFullYear() + 2}-12-31`;
    return { from, to };
  }, []);

  const refreshLists = useCallback(async () => {
    setLoadingLists(true);
    setErrorMessage(null);
    try {
      const [servicesRes, rehearsalsRes] = await Promise.all([
        fetch(
          `/api/admin/services?from=${encodeURIComponent(listRange.from)}&to=${encodeURIComponent(listRange.to)}`,
          { credentials: "include" }
        ),
        fetch(
          `/api/admin/rehearsals?from=${encodeURIComponent(listRange.from)}&to=${encodeURIComponent(listRange.to)}`,
          { credentials: "include" }
        ),
      ]);
      const servicesPayload = (await servicesRes.json().catch(() => ({}))) as {
        error?: string;
        services?: Service[];
      };
      if (!servicesRes.ok) throw new Error(servicesPayload.error ?? "Failed to load services.");
      const rehearsalsPayload = (await rehearsalsRes.json().catch(() => ({}))) as {
        error?: string;
        rehearsals?: RehearsalItem[];
      };
      if (!rehearsalsRes.ok) throw new Error(rehearsalsPayload.error ?? "Failed to load rehearsals.");

      setServices(
        (servicesPayload.services ?? []).sort(
          (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)
        )
      );
      setRehearsals((rehearsalsPayload.rehearsals ?? []).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load admin calendar data.");
    } finally {
      setLoadingLists(false);
    }
  }, [listRange.from, listRange.to]);

  const serviceMonthOptions = useMemo(() => {
    const months = new Set<string>();
    for (const service of services) {
      months.add(service.date.slice(0, 7));
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [services]);

  useEffect(() => {
    if (selectedServiceMonth && serviceMonthOptions.includes(selectedServiceMonth)) return;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (serviceMonthOptions.includes(currentMonth)) {
      setSelectedServiceMonth(currentMonth);
      return;
    }
    setSelectedServiceMonth(serviceMonthOptions[0] ?? "");
  }, [selectedServiceMonth, serviceMonthOptions]);

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    return services.filter((service) => {
      if (selectedServiceMonth && !service.date.startsWith(selectedServiceMonth)) return false;
      if (!q) return true;
      const haystack = `${service.title} ${getLeadVocalNames(service)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [selectedServiceMonth, serviceQuery, services]);

  const sortedServices = useMemo(() => {
    const factor = serviceSortDirection === "asc" ? 1 : -1;
    return [...filteredServices].sort((a, b) => {
      if (serviceSortKey === "service") return factor * a.title.localeCompare(b.title);
      if (serviceSortKey === "leadVocal") return factor * getLeadVocalNames(a).localeCompare(getLeadVocalNames(b));
      return factor * a.date.localeCompare(b.date);
    });
  }, [filteredServices, serviceSortDirection, serviceSortKey]);

  const serviceTotalPages = Math.max(1, Math.ceil(sortedServices.length / PAGE_SIZE));
  const safeServicePage = Math.min(servicePage, serviceTotalPages);
  const pagedServices = useMemo(() => {
    const start = (safeServicePage - 1) * PAGE_SIZE;
    return sortedServices.slice(start, start + PAGE_SIZE);
  }, [safeServicePage, sortedServices]);

  const sortedRehearsals = useMemo(() => {
    const factor = rehearsalSortDirection === "asc" ? 1 : -1;
    return [...rehearsals].sort((a, b) => {
      if (rehearsalSortKey === "name") return factor * (a.name ?? "").localeCompare(b.name ?? "");
      if (rehearsalSortKey === "recurrence") return factor * ((a.repeatEveryDays ?? 0) - (b.repeatEveryDays ?? 0));
      return factor * a.date.localeCompare(b.date);
    });
  }, [rehearsalSortDirection, rehearsalSortKey, rehearsals]);

  const rehearsalTotalPages = Math.max(1, Math.ceil(sortedRehearsals.length / PAGE_SIZE));
  const safeRehearsalPage = Math.min(rehearsalPage, rehearsalTotalPages);
  const pagedRehearsals = useMemo(() => {
    const start = (safeRehearsalPage - 1) * PAGE_SIZE;
    return sortedRehearsals.slice(start, start + PAGE_SIZE);
  }, [safeRehearsalPage, sortedRehearsals]);

  function serviceSortIcon(key: "date" | "service" | "leadVocal") {
    if (serviceSortKey !== key) return "△";
    return serviceSortDirection === "asc" ? "▲" : "▼";
  }

  function rehearsalSortIcon(key: "date" | "name" | "recurrence") {
    if (rehearsalSortKey !== key) return "△";
    return rehearsalSortDirection === "asc" ? "▲" : "▼";
  }

  useEffect(() => {
    void refreshLists();
  }, [refreshLists]);

  async function createService(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateServiceBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: createServiceDraft.title,
          date: createServiceDraft.date,
          notes: notesToArray(createServiceDraft.notes),
          variant: createServiceDraft.variant,
          showBandDetails: createServiceDraft.showBandDetails,
          uniform: createServiceDraft.uniform,
          uniformWomen: createServiceDraft.uniformWomen || null,
          uniformMen: createServiceDraft.uniformMen || null,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to create service.");
      setCreateServiceDraft(EMPTY_SERVICE_DRAFT);
      setCreateServiceModalOpen(false);
      setStatusMessage("Service created.");
      await refreshLists();
      setCalendarKey((key) => key + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create service.");
    } finally {
      setCreateServiceBusy(false);
    }
  }

  async function saveServiceEdit() {
    if (!editingServiceId) return;
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await fetch("/api/admin/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        serviceId: editingServiceId,
        title: editServiceDraft.title,
        date: editServiceDraft.date,
        notes: notesToArray(editServiceDraft.notes),
        variant: editServiceDraft.variant,
        showBandDetails: editServiceDraft.showBandDetails,
        uniform: editServiceDraft.uniform,
        uniformWomen: editServiceDraft.uniformWomen || null,
        uniformMen: editServiceDraft.uniformMen || null,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(payload.error ?? "Failed to update service.");
    setEditingServiceId(null);
    setStatusMessage("Service updated.");
    await refreshLists();
    setCalendarKey((key) => key + 1);
  }

  async function deleteService(serviceId: string, title: string) {
    if (!window.confirm(`Delete "${title}" service?`)) return;
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await fetch("/api/admin/services", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ serviceId }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setErrorMessage(payload.error ?? "Failed to delete service.");
      return;
    }
    setStatusMessage("Service deleted.");
    await refreshLists();
    setCalendarKey((key) => key + 1);
  }

  async function createRehearsal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateRehearsalBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const repeatValue = createRehearsalDraft.repeatEveryDays.trim();
      const repeatEveryDays = repeatValue === "" ? null : Number.parseInt(repeatValue, 10);
      const res = await fetch("/api/admin/rehearsals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: createRehearsalDraft.date,
          name: createRehearsalDraft.name || null,
          repeatEveryDays,
          untilDate: createRehearsalDraft.untilDate || null,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to create rehearsal.");
      setCreateRehearsalDraft(EMPTY_REHEARSAL_DRAFT);
      setCreateRehearsalModalOpen(false);
      setStatusMessage("Rehearsal created.");
      await refreshLists();
      setCalendarKey((key) => key + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create rehearsal.");
    } finally {
      setCreateRehearsalBusy(false);
    }
  }

  async function saveRehearsalEdit() {
    if (!editingRehearsalId) return;
    setErrorMessage(null);
    setStatusMessage(null);
    const repeatValue = editRehearsalDraft.repeatEveryDays.trim();
    const repeatEveryDays = repeatValue === "" ? null : Number.parseInt(repeatValue, 10);
    const res = await fetch("/api/admin/rehearsals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        rehearsalId: editingRehearsalId,
        date: editRehearsalDraft.date,
        name: editRehearsalDraft.name || null,
        repeatEveryDays,
        untilDate: editRehearsalDraft.untilDate || null,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(payload.error ?? "Failed to update rehearsal.");
    setEditingRehearsalId(null);
    setStatusMessage("Rehearsal updated.");
    await refreshLists();
    setCalendarKey((key) => key + 1);
  }

  async function deleteRehearsal(rehearsalId: string, date: string) {
    if (!window.confirm(`Delete rehearsal on ${date}?`)) return;
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await fetch("/api/admin/rehearsals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ rehearsalId }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setErrorMessage(payload.error ?? "Failed to delete rehearsal.");
      return;
    }
    setStatusMessage("Rehearsal deleted.");
    await refreshLists();
    setCalendarKey((key) => key + 1);
  }

  return (
    <section className="space-y-4">
      <div className="section-panel rounded-xl border p-4 sm:p-5">
        <h1 className="section-accent-text text-lg sm:text-xl font-semibold">
          Admin Band Calendar
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Manage services and rehearsals, then review updates directly in the calendar.
        </p>
      </div>

      {statusMessage ? (
        <div className="rounded-lg border border-[color:var(--section-default)] bg-[color:var(--section-soft)] px-3 py-2 text-sm text-[color:var(--section-strong)]">
          {statusMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-2 sm:p-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "calendar", label: "Calendar" },
            { id: "manage-services", label: "Manage Services" },
            { id: "manage-rehearsals", label: "Manage Rehearsals" },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ManagerTab)}
                className={[
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-[color:var(--section-default)] bg-[color:var(--section-soft)] text-[color:var(--section-strong)]"
                    : "border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/50 text-zinc-700 dark:text-zinc-200 hover:border-[color:var(--section-default)]",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "manage-services" ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Services</h3>
            <button
              type="button"
              onClick={() => setCreateServiceModalOpen(true)}
              className="section-accent-button rounded-md px-3 py-1.5 text-xs font-medium"
            >
              Create service
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              Year:Month
              <select
                value={selectedServiceMonth}
                onChange={(e) => {
                  setSelectedServiceMonth(e.target.value);
                  setServicePage(1);
                }}
                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
              >
                {serviceMonthOptions.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-600 dark:text-zinc-300 md:col-span-2">
              Filter by service name or lead vocal
              <input
                type="text"
                value={serviceQuery}
                onChange={(e) => {
                  setServiceQuery(e.target.value);
                  setServicePage(1);
                }}
                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
                placeholder="Search..."
              />
            </label>
          </div>
          {loadingLists ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Loading...</p>
          ) : filteredServices.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">No services found.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="py-2 px-3">
                      <button type="button" className={SORT_HEADER_BUTTON_CLASS} onClick={() => {
                        if (serviceSortKey === "date") setServiceSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                        else { setServiceSortKey("date"); setServiceSortDirection("desc"); }
                        setServicePage(1);
                      }}>Date {serviceSortIcon("date")}</button>
                    </th>
                    <th className="py-2 pr-3">
                      <button type="button" className={SORT_HEADER_BUTTON_CLASS} onClick={() => {
                        if (serviceSortKey === "service") setServiceSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                        else { setServiceSortKey("service"); setServiceSortDirection("asc"); }
                        setServicePage(1);
                      }}>Service {serviceSortIcon("service")}</button>
                    </th>
                    <th className="py-2 pr-3">
                      <button type="button" className={SORT_HEADER_BUTTON_CLASS} onClick={() => {
                        if (serviceSortKey === "leadVocal") setServiceSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                        else { setServiceSortKey("leadVocal"); setServiceSortDirection("asc"); }
                        setServicePage(1);
                      }}>Lead vocal {serviceSortIcon("leadVocal")}</button>
                    </th>
                    <th className="py-2 pr-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedServices.map((service) => (
                    <tr key={service._id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                      <td className="py-2 px-3 text-zinc-800 dark:text-zinc-100">
                        {formatIsoDateToDDMMYYYY(service.date)}
                      </td>
                      <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{service.title}</td>
                      <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                        {getLeadVocalNames(service)}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingServiceId(service._id);
                            setEditServiceDraft(serviceToDraft(service));
                          }}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs mr-1"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteService(service._id, service.title)}
                          className="rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-2 py-1 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sortedServices.length > PAGE_SIZE ? (
            <div className="mt-3 flex items-center justify-between gap-2 text-xs sm:text-sm">
              <div className={PAGINATION_META_CLASS}>
                Showing {(safeServicePage - 1) * PAGE_SIZE + 1}-{Math.min(safeServicePage * PAGE_SIZE, sortedServices.length)} of {sortedServices.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setServicePage((p) => Math.max(1, p - 1))}
                  disabled={safeServicePage <= 1}
                  className={PAGINATION_BUTTON_CLASS}
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setServicePage((p) => Math.min(serviceTotalPages, p + 1))}
                  disabled={safeServicePage >= serviceTotalPages}
                  className={PAGINATION_BUTTON_CLASS}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "manage-rehearsals" ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Rehearsals</h3>
            <button
              type="button"
              onClick={() => setCreateRehearsalModalOpen(true)}
              className="section-accent-button rounded-md px-3 py-1.5 text-xs font-medium"
            >
              Create rehearsal
            </button>
          </div>
          {loadingLists ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Loading...</p>
          ) : rehearsals.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">No rehearsals found.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="py-2 px-3">
                      <button type="button" className={SORT_HEADER_BUTTON_CLASS} onClick={() => {
                        if (rehearsalSortKey === "date") setRehearsalSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                        else { setRehearsalSortKey("date"); setRehearsalSortDirection("desc"); }
                        setRehearsalPage(1);
                      }}>Date {rehearsalSortIcon("date")}</button>
                    </th>
                    <th className="py-2 pr-3">
                      <button type="button" className={SORT_HEADER_BUTTON_CLASS} onClick={() => {
                        if (rehearsalSortKey === "name") setRehearsalSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                        else { setRehearsalSortKey("name"); setRehearsalSortDirection("asc"); }
                        setRehearsalPage(1);
                      }}>Name {rehearsalSortIcon("name")}</button>
                    </th>
                    <th className="py-2 pr-3">
                      <button type="button" className={SORT_HEADER_BUTTON_CLASS} onClick={() => {
                        if (rehearsalSortKey === "recurrence") setRehearsalSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                        else { setRehearsalSortKey("recurrence"); setRehearsalSortDirection("asc"); }
                        setRehearsalPage(1);
                      }}>Recurrence {rehearsalSortIcon("recurrence")}</button>
                    </th>
                    <th className="py-2 pr-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRehearsals.map((rehearsal) => (
                    <tr key={rehearsal._id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                      <td className="py-2 px-3 text-zinc-800 dark:text-zinc-100">
                        {formatIsoDateToDDMMYYYY(rehearsal.date)}
                      </td>
                      <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                        {rehearsal.name || "—"}
                      </td>
                      <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                        {rehearsal.repeatEveryDays
                          ? `Every ${rehearsal.repeatEveryDays} day(s) until ${rehearsal.untilDate ? formatIsoDateToDDMMYYYY(rehearsal.untilDate) : "-"}`
                          : "One-time"}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRehearsalId(rehearsal._id);
                            setEditRehearsalDraft(rehearsalToDraft(rehearsal));
                          }}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs mr-1"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteRehearsal(rehearsal._id, rehearsal.date)}
                          className="rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-2 py-1 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sortedRehearsals.length > PAGE_SIZE ? (
            <div className="mt-3 flex items-center justify-between gap-2 text-xs sm:text-sm">
              <div className={PAGINATION_META_CLASS}>
                Showing {(safeRehearsalPage - 1) * PAGE_SIZE + 1}-{Math.min(safeRehearsalPage * PAGE_SIZE, sortedRehearsals.length)} of {sortedRehearsals.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRehearsalPage((p) => Math.max(1, p - 1))}
                  disabled={safeRehearsalPage <= 1}
                  className={PAGINATION_BUTTON_CLASS}
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setRehearsalPage((p) => Math.min(rehearsalTotalPages, p + 1))}
                  disabled={safeRehearsalPage >= rehearsalTotalPages}
                  className={PAGINATION_BUTTON_CLASS}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "calendar" ? <BandCalendarMonth key={calendarKey} /> : null}

      {createServiceModalOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create service"
          onClick={() => setCreateServiceModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">Create service</h3>
            <form className="mt-4 space-y-3" onSubmit={createService}>
              <input
                type="text"
                value={createServiceDraft.title}
                onChange={(e) => setCreateServiceDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Service title"
                required
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={createServiceDraft.date}
                onChange={(e) => setCreateServiceDraft((prev) => ({ ...prev, date: e.target.value }))}
                required
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <textarea
                rows={3}
                value={createServiceDraft.notes}
                onChange={(e) => setCreateServiceDraft((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes (one line per bullet)"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateServiceModalOpen(false)}
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createServiceBusy}
                  className="section-accent-button rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-60"
                >
                  {createServiceBusy ? "Saving..." : "Create service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingServiceId ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit service"
          onClick={() => setEditingServiceId(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">Edit service</h3>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={editServiceDraft.title}
                onChange={(e) => setEditServiceDraft((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={editServiceDraft.date}
                onChange={(e) => setEditServiceDraft((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <textarea
                rows={3}
                value={editServiceDraft.notes}
                onChange={(e) => setEditServiceDraft((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingServiceId(null)}
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void saveServiceEdit().catch((e: unknown) =>
                      setErrorMessage(e instanceof Error ? e.message : "Failed to update service.")
                    )
                  }
                  className="section-accent-button rounded-md px-4 py-1.5 text-sm font-medium"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {createRehearsalModalOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create rehearsal"
          onClick={() => setCreateRehearsalModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">Create rehearsal</h3>
            <form className="mt-4 space-y-3" onSubmit={createRehearsal}>
              <input
                type="date"
                value={createRehearsalDraft.date}
                onChange={(e) => setCreateRehearsalDraft((prev) => ({ ...prev, date: e.target.value }))}
                required
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={createRehearsalDraft.name}
                onChange={(e) => setCreateRehearsalDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Name (optional)"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  value={createRehearsalDraft.repeatEveryDays}
                  onChange={(e) =>
                    setCreateRehearsalDraft((prev) => ({ ...prev, repeatEveryDays: e.target.value }))
                  }
                  placeholder="Repeat every days"
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={createRehearsalDraft.untilDate}
                  onChange={(e) => setCreateRehearsalDraft((prev) => ({ ...prev, untilDate: e.target.value }))}
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateRehearsalModalOpen(false)}
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRehearsalBusy}
                  className="section-accent-button rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-60"
                >
                  {createRehearsalBusy ? "Saving..." : "Create rehearsal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingRehearsalId ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit rehearsal"
          onClick={() => setEditingRehearsalId(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">Edit rehearsal</h3>
            <div className="mt-4 space-y-3">
              <input
                type="date"
                value={editRehearsalDraft.date}
                onChange={(e) => setEditRehearsalDraft((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={editRehearsalDraft.name}
                onChange={(e) => setEditRehearsalDraft((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                placeholder="Name"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  value={editRehearsalDraft.repeatEveryDays}
                  onChange={(e) =>
                    setEditRehearsalDraft((prev) => ({ ...prev, repeatEveryDays: e.target.value }))
                  }
                  placeholder="Repeat every days"
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={editRehearsalDraft.untilDate}
                  onChange={(e) => setEditRehearsalDraft((prev) => ({ ...prev, untilDate: e.target.value }))}
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRehearsalId(null)}
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void saveRehearsalEdit().catch((e: unknown) =>
                      setErrorMessage(e instanceof Error ? e.message : "Failed to update rehearsal.")
                    )
                  }
                  className="section-accent-button rounded-md px-4 py-1.5 text-sm font-medium"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
