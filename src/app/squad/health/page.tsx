import { redirect } from "next/navigation";

// Squad Health is no longer its own tab - it's embedded directly inside "My Team" (see
// SquadHealthEmbed in app/squad/page.tsx). This route redirects rather than 404s for anyone
// with an old link/bookmark pointed at /squad/health.
export default function SquadHealthPage() {
  redirect("/squad");
}
