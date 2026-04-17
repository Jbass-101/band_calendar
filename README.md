# Last Harvest Choir App

Last Harvest Choir App helps choir and band leaders plan services, prepare teams, and keep ministry operations organized in one place.

## What Users Can Do
- View upcoming services and rehearsals in a clear monthly calendar.
- See who is assigned for each service, along with notes and dress/uniform guidance.
- Open setlists directly from the calendar to quickly review song order.
- Browse a shared song library with lyrics and reference links for practice.
- Print or download clean PDF plans for band members, singers, and media teams.

## What Leaders/Admins Can Do
- Sign in to a secure admin area with quick access to Calendar, Songs, Setlists, Contributions, and Studio.
- Add and manage songs and setlists from built-in management tabs.
- Track monthly giving with simple overviews, entries, expenses, and activity logs.
- Generate monthly and year-to-date contribution statements as PDFs.
- Use embedded Sanity Studio for full record and content management.

## Tech Stack
- Next.js (App Router)
- TypeScript + React
- Tailwind CSS
- Sanity CMS

## Local Setup
1. Install dependencies:
   - `npm install`
2. Create `.env.local` and configure Sanity/auth values:
   - `SANITY_PROJECT_ID=...`
   - `SANITY_DATASET=...`
   - `NEXT_PUBLIC_SANITY_PROJECT_ID=...`
   - `NEXT_PUBLIC_SANITY_DATASET=...`
   - `SANITY_API_VERSION=2026-03-25` (optional)
   - `CONTRIB_PASSWORD=...` (admin password used by `/api/contributions/auth`)
3. Start development server:
   - `npm run dev`
4. Open:
   - `http://localhost:3000`

## Main Routes
- `/` - Public landing page (`Last Harvest Choir`)
- `/schedule` - Band schedule (`Last Harvest Instrumentalists`)
- `/calendar` - Band schedule alias/entry used from admin
- `/songs` - Song repository (plus manage tab for authenticated users)
- `/setlists` - Setlist repository (plus manage tab for authenticated users)
- `/setlists/[id]/export/band` - Band-friendly setlist export
- `/setlists/[id]/export/media` - Media/lyrics setlist export
- `/login` - Central admin login page
- `/admin` - Admin dashboard (requires auth)
- `/contributions` - Contributions management (requires auth)
- `/studio` - Embedded Sanity Studio

## Auth Flow
- Public users clicking `Admin` are directed to `/login`
- Valid login redirects to `/admin`
- Authenticated users visiting `/` are redirected to `/admin`
- Logout clears auth and redirects to `/`

## Sanity Models Used
- `musician`
- `service`
- `rehearsal`
- `song`
- `setlist`
- Contribution-related documents used by the contributions module

## License
MIT - see [LICENSE](LICENSE).
