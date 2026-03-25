# Last Harvest Instrumentalists – Band Calendar

## What’s included
- Service cards with musician assignments (by role)
- Rehearsal markers (supports repeating rehearsals: repeat every N days + until date)
- Responsive UI: desktop month grid, mobile event list
- Calendar navigation limited to the current month + 1 month ahead (including current month)

## Run locally
1. Install dependencies:
   - `npm install`
2. Configure Sanity (create `.env.local`):
   - `SANITY_PROJECT_ID=...`
   - `SANITY_DATASET=...`
   - `NEXT_PUBLIC_SANITY_PROJECT_ID=...`
   - `NEXT_PUBLIC_SANITY_DATASET=...`
   - Optional: `SANITY_API_VERSION=2026-03-25`
3. Start:
   - `npm run dev`

## Routes
- Calendar: `http://localhost:3000/`
- Sanity Studio (embedded): `http://localhost:3000/studio`

## Expected Sanity document types
- `musician`: `name`, `roles[]`
- `service`: `title`, `date`, and role fields (`leadVocal`, `leadKeyboard`, `auxKeyboard`, `leadGuitar`, `bassGuitar`, `drummer`, `md`)
- `rehearsal`: `date`, optional `name`, optional repeating fields (`repeatEveryDays`, `untilDate`)

## License
MIT — see [LICENSE](LICENSE).
