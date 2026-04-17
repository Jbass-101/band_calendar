# Setlists – schema and app integration

This document describes the setlist model, how it links to the band calendar, and export surfaces.

## Goals

- One setlist per **service** (calendar slot), so date and “which service” are unambiguous.
- Ordered songs from the song library, with optional **per-service overrides** (key, tempo, capo).
- **Status** workflow for draft → ready → final → archived.
- **Band** and **media** print/PDF exports.

## Sanity schema

### `setlist`

- **`service`** (reference to `service`, required): anchors the setlist to a calendar service. At most one setlist per service (enforced in Studio validation).
- **`title`** (optional string).
- **`status`**: `draft` | `ready` | `final` | `archived` (default `draft`).
- **`songs`** (ordered array): each item has `song` (reference), optional `note`, `keyOverride`, `capo`, `tempoOverride` (BPM).
- **`notes`** (optional text).
- **`duplicatedFrom`** (optional reference to another `setlist`).

Date and service slot are **not** duplicated on the setlist; they come from `service->date` and `service->title`.

### `song`

- **`defaultKey`** (optional string) and **`tempoBpm`** (optional integer, 1–400): defaults for band sheets; setlist line overrides win when present.

### `service`

No extra field required: setlists reference services. Roster roles (e.g. **Lead vocal**) stay on the service document.

## App behaviour

- **`fetchSetlists()`** (`src/lib/sanity/client.ts`): projects service date/title, lead vocal names, song defaults and line overrides; orders by `service->date` descending.
- **`fetchSetlistById(id)`**: full detail including **lyrics** for media export.
- **`fetchServicesForRange()`**: each service includes **`_id`** and optional **`setlist`** summary `{ _id, title, status }` for the linked setlist.

### Routes

- **`/setlists`**: searchable list (`SetlistRepository`), anchor `id` on each card for deep links (`/setlists#<setlistId>`). Links to band and media export URLs.
- **`/setlists/[id]/export/band`**: band-oriented table (key, tempo, capo, notes); Print + Download PDF.
- **`/setlists/[id]/export/media`**: ordered songs with lyrics sections; Print + Download PDF.

### Schedule page

- **`BandCalendarMonth`**: supports **multiple services on the same day**; each service block can show a **Setlist** link when a linked setlist exists.

## Studio workflow

1. Ensure **service** documents exist for each slot (same day can have multiple services with different titles).
2. Create a **setlist**, choose the **service**, set **status**, order **songs**, add overrides as needed.
3. Open **`/setlists`** or use **Export** links for band/media.

## API

- **`GET /api/setlists`**: returns JSON from `fetchSetlists()` (unchanged pattern).

## Known limits / next steps

- No in-app create/edit for setlists yet (Studio only).
- Optional: duplicate setlist action, finalize lock, richer PDF multi-page layout for very long lyric exports.
