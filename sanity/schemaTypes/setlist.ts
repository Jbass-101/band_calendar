import { defineArrayMember, defineField, defineType } from "sanity";
import { DocumentTextIcon } from "@sanity/icons";

const STATUS_OPTIONS = [
  { title: "Draft", value: "draft" },
  { title: "Ready", value: "ready" },
  { title: "Final", value: "final" },
  { title: "Archived", value: "archived" },
];

function getRefId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const ref = (value as { _ref?: string })._ref;
  return typeof ref === "string" ? ref : null;
}

type SanityClientLike = {
  fetch: <T>(query: string, params: Record<string, unknown>) => Promise<T>;
};

type ValidationContextLike = {
  document?: { _id?: string };
  getClient: (opts: { apiVersion: string }) => SanityClientLike;
};

export const setlist = defineType({
  name: "setlist",
  title: "Setlist",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: "title",
      title: "Setlist Title",
      type: "string",
      description: "Optional display title. Date and slot come from the linked service.",
    }),
    defineField({
      name: "service",
      title: "Service",
      type: "reference",
      to: [{ type: "service" }],
      description: "Which calendar service this setlist belongs to (one setlist per service).",
      validation: (rule) =>
        rule.required().custom(async (value: unknown, context: ValidationContextLike) => {
          const serviceRef = getRefId(value);
          if (!serviceRef) return true;

          const documentId = context.document?._id;
          if (!documentId) return true;

          const publishedId = documentId.startsWith("drafts.")
            ? documentId.slice("drafts.".length)
            : documentId;
          const draftId = `drafts.${publishedId}`;

          const client = context.getClient({ apiVersion: "2026-03-25" });
          const count = await client.fetch<number>(
            `count(*[
              _type == "setlist" &&
              service._ref == $serviceRef &&
              !(_id in [$draftId, $publishedId])
            ])`,
            { serviceRef, draftId, publishedId }
          );

          if (count > 0) {
            return "A setlist already exists for this service.";
          }
          return true;
        }),
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: STATUS_OPTIONS,
        layout: "radio",
      },
      initialValue: "draft",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "songs",
      title: "Songs (in order)",
      description: "Drag to reorder. Overrides apply for this service only.",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "song",
              title: "Song",
              type: "reference",
              to: [{ type: "song" }],
              options: {
                filter: "active != false",
              },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "note",
              title: "Item Note",
              type: "string",
              description: "Optional transition or arrangement note for this slot.",
            }),
            defineField({
              name: "keyOverride",
              title: "Key override",
              type: "string",
              description: "Live key if different from the song default (e.g. Bb).",
            }),
            defineField({
              name: "capo",
              title: "Capo",
              type: "string",
              description: "Fret position if applicable (e.g. 2).",
            }),
            defineField({
              name: "tempoOverride",
              title: "Tempo override (BPM)",
              type: "number",
              description: "Live tempo if different from the song default.",
              validation: (rule) => rule.min(1).max(400).integer(),
            }),
          ],
          preview: {
            select: {
              title: "song.name",
              number: "song.number",
              note: "note",
              keyOverride: "keyOverride",
            },
            prepare(selection) {
              const songName = selection.title ?? "Song";
              const number = typeof selection.number === "number" ? `#${selection.number}` : "#?";
              const note = typeof selection.note === "string" && selection.note.trim() ? ` • ${selection.note}` : "";
              const key =
                typeof selection.keyOverride === "string" && selection.keyOverride.trim()
                  ? ` • ${selection.keyOverride}`
                  : "";
              return {
                title: `${number} ${songName}${key}${note}`,
              };
            },
          },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "notes",
      title: "Setlist Notes",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "duplicatedFrom",
      title: "Duplicated from",
      type: "reference",
      to: [{ type: "setlist" }],
      description: "Optional reference to the setlist this was copied from.",
    }),
  ],
  preview: {
    select: {
      title: "title",
      serviceTitle: "service.title",
      serviceDate: "service.date",
      status: "status",
    },
    prepare(selection) {
      const dateLabel =
        typeof selection.serviceDate === "string" ? selection.serviceDate : "No date";
      const slot =
        typeof selection.serviceTitle === "string" && selection.serviceTitle.trim()
          ? selection.serviceTitle
          : "Service";
      const status =
        typeof selection.status === "string" ? selection.status.replaceAll("_", " ") : "draft";
      return {
        title: selection.title ?? `Setlist • ${dateLabel}`,
        subtitle: `${dateLabel} • ${slot} • ${status}`,
      };
    },
  },
});
