# Setlists Phase 1 Tracker

This document tracks the initial setlist foundation so we can build incrementally.

## Goal

Introduce a reliable first version of setlists that allows:

- defining service date + service type
- selecting ordered songs from the song library
- storing optional setlist and per-item notes
- viewing/searching setlists in the app

## Implemented in Phase 1

- [x] Sanity schema: `setlist`
  - fields: `title`, `date`, `serviceType`, `songs[]`, `notes`, `active`
  - ordered songs via array drag-and-drop
  - each song row supports optional item note
- [x] Schema registration in `sanity/schemaTypes/index.ts`
- [x] Client types and fetch function:
  - `SetlistSongItem`
  - `Setlist`
  - `fetchSetlists()`
- [x] API endpoint: `GET /api/setlists`
- [x] App page: `/setlists`
- [x] UI component: searchable setlist repository view
- [x] Home quick link to Setlists

## Data Shape (Current)

Setlist document:

- `_id`
- `title` (optional)
- `date` (required)
- `serviceType` (`sunday_morning` | `sunday_evening` | `midweek` | `special`)
- `songs[]`:
  - `song` reference (required)
  - `note` (optional)
- `notes` (optional)
- `active` (boolean)

## Known Limits in Phase 1

- No dedicated setlist create/edit UI in app yet (managed in Sanity Studio)
- No duplication action ("copy last setlist")
- No PDF export for setlists yet
- No role-based permissions specific to setlists

## Recommended Phase 2

- Add app-side create/edit flow for setlists
- Add "Duplicate previous setlist" shortcut
- Add setlist print/export view
- Add filters by date range and service type
- Add optional lock/finalize status once rehearsal is complete

## Product Notes Backlog

Captured notes to track after initial setlist foundation:

- **Setlist foundation now (small step)**: Add a setlist document with `date`, `serviceType`, and ordered `songs[]` references. Even basic version unlocks the "song number for setlist" workflow quickly.
- **Song key + tempo fields**: Add `defaultKey` and `tempoBpm` to songs. These are practical rehearsal fields after lyrics.
- **Quick "copy setlist" action**: Ability to duplicate last Sunday's setlist and tweak.
- **Search quality boost**: Add fuzzy matching for names (typos/partials), and optional exact-number quick search (`#23`).
- **Lyrics UX polish**: In modal, add section jump chips at top (`Intro`, `Chorus`, etc.) when sections are long.
- **Tag hygiene guardrails**: Keep `songTheme`/`songTag` curated: mark inactive instead of delete, and hide inactive in pickers.
- **Basic data constraints**: Prevent duplicate song names (or warn), and ensure URLs are valid YouTube/Spotify domains if desired.
- **Performance/safety for growth**: If songs get large, paginate table or lazy-load lyrics modal content only on open.
- **Export option (later)**: "Print setlist sheet" with ordered sections for vocalist + separate compact band view.
