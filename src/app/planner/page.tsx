"use client";

import { PlannerContent } from "@/components/planner-content";
import { TabRouteShell } from "@/components/tab-route-shell";

export default function PlannerPage() {
  return (
    <TabRouteShell title="Planner" eyebrow="Plan ahead with confidence. Smarter moves, better returns." route="/planner">
      {(context) => (
        <div className="flex h-full flex-col -mt-4 lg:-mt-6">
          <PlannerContent payload={context.payload} />
        </div>
      )}
    </TabRouteShell>
  );
}
