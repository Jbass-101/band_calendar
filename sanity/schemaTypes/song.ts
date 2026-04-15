import { defineField, defineType } from "sanity";
import { ComposeIcon } from "@sanity/icons";

const GENRE_OPTIONS = [
  { title: "Worship", value: "worship" },
  { title: "Praise", value: "praise" },
  { title: "Other", value: "other" },
];

async function getNextSongNumber(context: { getClient: (opts: { apiVersion: string }) => { fetch: <T>(query: string) => Promise<T> } }) {
  const client = context.getClient({ apiVersion: "2026-03-25" });
  const maxNumber = await client.fetch<number | null>(
    `coalesce(*[_type == "song" && defined(number)] | order(number desc)[0].number, 0)`
  );
  return (typeof maxNumber === "number" ? maxNumber : 0) + 1;
}

function isAllowedHost(hostname: string, allowedHosts: string[]) {
  const host = hostname.toLowerCase();
  return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export const song = defineType({
  name: "song",
  title: "Song",
  type: "document",
  icon: ComposeIcon,
  fields: [
    defineField({
      name: "number",
      title: "Song Number",
      type: "number",
      description: "Unique reference number used when building setlists. Auto-generated on create, but still editable.",
      initialValue: async (_params, context) => getNextSongNumber(context),
      validation: (rule) =>
        rule.required().integer().min(1).custom(async (value, context) => {
          if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return true;

          const documentId = context.document?._id;
          if (!documentId) return true;

          const publishedId = documentId.startsWith("drafts.")
            ? documentId.slice("drafts.".length)
            : documentId;
          const draftId = `drafts.${publishedId}`;

          const client = context.getClient({ apiVersion: "2026-03-25" });
          const duplicateCount = await client.fetch<number>(
            `count(*[
              _type == "song" &&
              number == $number &&
              !(_id in [$draftId, $publishedId])
            ])`,
            { number: value, draftId, publishedId }
          );

          if (duplicateCount > 0) {
            return "Song Number must be unique.";
          }
          return true;
        }),
    }),
    defineField({
      name: "name",
      title: "Song Name",
      type: "string",
      validation: (rule) =>
        rule.required().custom(async (value, context) => {
          const name = typeof value === "string" ? value.trim() : "";
          if (!name) return true;

          const documentId = context.document?._id;
          if (!documentId) return true;

          const publishedId = documentId.startsWith("drafts.")
            ? documentId.slice("drafts.".length)
            : documentId;
          const draftId = `drafts.${publishedId}`;

          const client = context.getClient({ apiVersion: "2026-03-25" });
          const duplicateCount = await client.fetch<number>(
            `count(*[
              _type == "song" &&
              name == $name &&
              !(_id in [$draftId, $publishedId])
            ])`,
            { name, draftId, publishedId }
          );

          if (duplicateCount > 0) {
            return "Song Name already exists. Use a unique name or update the existing song.";
          }
          return true;
        }),
    }),
    defineField({
      name: "genre",
      title: "Genre",
      type: "string",
      options: {
        list: GENRE_OPTIONS,
        layout: "radio",
      },
      validation: (rule) => rule.required(),
      initialValue: "worship",
    }),
    defineField({
      name: "themes",
      title: "Themes",
      description: "Optional predefined themes linked to this song.",
      type: "array",
      of: [
        {
          type: "reference",
          to: [{ type: "songTheme" }],
          options: {
            filter: "active != false",
          },
        },
      ],
    }),
    defineField({
      name: "tags",
      title: "Tags",
      description: "Optional predefined tags for style or occasion.",
      type: "array",
      of: [
        {
          type: "reference",
          to: [{ type: "songTag" }],
          options: {
            filter: "active != false",
          },
        },
      ],
    }),
    defineField({
      name: "youtubeUrl",
      title: "YouTube Link",
      type: "url",
      validation: (rule) =>
        rule
          .uri({ allowRelative: false, scheme: ["http", "https"] })
          .custom((value) => {
            if (typeof value !== "string" || value.trim().length === 0) return true;
            try {
              const url = new URL(value);
              if (isAllowedHost(url.hostname, ["youtube.com", "youtu.be"])) return true;
              return "Use a valid YouTube URL (youtube.com or youtu.be).";
            } catch {
              return "Enter a valid URL.";
            }
          }),
    }),
    defineField({
      name: "spotifyUrl",
      title: "Spotify Link",
      type: "url",
      validation: (rule) =>
        rule
          .uri({ allowRelative: false, scheme: ["http", "https"] })
          .custom((value) => {
            if (typeof value !== "string" || value.trim().length === 0) return true;
            try {
              const url = new URL(value);
              if (isAllowedHost(url.hostname, ["spotify.com"])) return true;
              return "Use a valid Spotify URL (spotify.com).";
            } catch {
              return "Enter a valid URL.";
            }
          }),
    }),
    defineField({
      name: "lyricsSections",
      title: "Lyrics Sections",
      type: "object",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "intro", title: "Intro", type: "text", rows: 4 }),
        defineField({ name: "verse1", title: "Verse 1", type: "text", rows: 6 }),
        defineField({ name: "verse2", title: "Verse 2", type: "text", rows: 6 }),
        defineField({ name: "preChorus", title: "Pre-Chorus", type: "text", rows: 5 }),
        defineField({ name: "chorus", title: "Chorus", type: "text", rows: 6 }),
        defineField({ name: "hook", title: "Hook", type: "text", rows: 5 }),
        defineField({ name: "bridge", title: "Bridge", type: "text", rows: 6 }),
        defineField({ name: "outro", title: "Outro", type: "text", rows: 4 }),
        defineField({ name: "ending", title: "Ending", type: "text", rows: 4 }),
      ],
    }),
    defineField({
      name: "notes",
      title: "Arrangement Notes",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "active",
      title: "Active",
      description: "Disable to archive a song without deleting it.",
      type: "boolean",
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      number: "number",
      title: "name",
      genre: "genre",
    },
    prepare(selection) {
      const number = typeof selection.number === "number" ? `#${selection.number}` : "#?";
      const genre = typeof selection.genre === "string" ? selection.genre : "unknown";
      return {
        title: selection.title ?? "Untitled song",
        subtitle: `${number} • ${genre}`,
      };
    },
  },
});
