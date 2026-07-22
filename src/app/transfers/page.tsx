"use client";

import { DecisionCentreContent } from "@/components/decision-centre-content";
import { TabRouteShell } from "@/components/tab-route-shell";

export default function TransfersPage() {
  return (
    <TabRouteShell title="Decision Centre" eyebrow="Best move, roll case, and alternatives" route="/transfers">
      {(context) => (
        <DecisionCentreContent
          payload={context.payload}
          appState={context.appState}
          squadPlayers={context.players}
          availablePlayers={context.players}
        />
      )}
    </TabRouteShell>
  );
}
