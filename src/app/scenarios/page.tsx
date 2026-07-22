"use client";

import { ScenariosContent } from "@/components/scenarios-content";
import { TabRouteShell } from "@/components/tab-route-shell";

export default function ScenariosPage() {
  return (
    <TabRouteShell title="Scenario Simulator" eyebrow="Transfer, armband, bench, and hit tests" route="/scenarios">
      {(context) => (
        <ScenariosContent payload={context.payload} players={context.players} entryId={context.appState.team_id_label} />
      )}
    </TabRouteShell>
  );
}
