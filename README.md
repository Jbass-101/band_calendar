# Last Harvest Choir App

Web app for choir and band operations, with public pages for schedule and songs plus authenticated admin tools for contributions and content management.

## Highlights
- Public home page with quick access to `Schedule` and `Songs`
- Dedicated band schedule page with month view and PDF export support
- Unified songs page with repository view and admin management tab (when authenticated)
- Admin dashboard and contributions tooling with centralized login/logout flow
- Top navigation that adapts to public vs authenticated users
- Embedded Sanity Studio for full content management

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
- `/songs` - Song repository (plus manage tab for authenticated users)
- `/login` - Central admin login page
- `/admin` - Admin dashboard (requires auth)
- `/contributions` - Contributions management (requires auth)
- `/setlists` - Setlist repository
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
