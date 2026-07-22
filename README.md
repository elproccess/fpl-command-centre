# FPL Command Centre

Premium FPL decision assistant frontend built with Next.js, TypeScript, Tailwind CSS, and the App Router.

## Setup

```bash
npm install
npm run dev
```

Set the backend URL:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Routes

- `/` landing page
- `/import` team import
- `/dashboard` Gameweek Command Centre
- `/squad` squad health and player cards
- `/transfers` transfer route comparison
- `/scenarios` scenario simulator
- `/planner` 3-GW planner
- `/market` Player Stock Market
- `/pricing` Free / Plus / Pro
- `/settings` account and team placeholders

The app currently renders complete mock data through `src/lib/mock.ts` and exposes backend-ready functions in `src/lib/api.ts`. In development, API failures fall back to mock data with friendly handling.

