"use client";

import { CaptaincyContent } from "@/components/captaincy-content";
import { TabRouteShell } from "@/components/tab-route-shell";

export default function CaptaincyPage() {
  return (
    <TabRouteShell title="Captaincy Centre" eyebrow="Ceiling, safety, and fixture risk" route="/captaincy">
      {(context) => <CaptaincyContent payload={context.payload} />}
    </TabRouteShell>
  );
}
