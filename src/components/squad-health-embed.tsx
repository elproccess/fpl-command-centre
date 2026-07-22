"use client";

import { SquadHealthContent } from "@/components/squad-health-content";
import { useImportedPageContext } from "@/lib/use-imported-page-context";

/**
 * Lets /squad/page.tsx (a server component) embed the full Squad Health diagnostics inline
 * instead of linking out to the separate /squad/health tab - "My Team" and "Squad Health" are
 * now one combined tab. Deliberately not TabRouteShell (which renders its own AppShell chrome)
 * since /squad/page.tsx already provides that; this only resolves the client-side imported-team
 * context SquadHealthContent needs. Renders nothing if the import context isn't ready yet
 * (should be near-instant here - the server page already rendered real squad data, so the same
 * localStorage-backed import this reads is already present).
 */
export function SquadHealthEmbed() {
  const state = useImportedPageContext();
  if (state.status !== "ready") return null;
  return <SquadHealthContent payload={state.context.payload} />;
}
