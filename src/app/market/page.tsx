"use client";

import { useSearchParams } from "next/navigation";
import { MarketContent } from "@/components/market-content";
import { TabRouteShell } from "@/components/tab-route-shell";

export default function MarketPage() {
  const searchParams = useSearchParams();
  const position = searchParams.get("position") ?? "";
  const signal = searchParams.get("signal") ?? "";
  const team = searchParams.get("team") ?? "";
  const maxPrice = Number(searchParams.get("max_price") ?? 0);

  return (
    <TabRouteShell title="Player Market" eyebrow="Projection, value, form and ownership" route="/market">
      {(context) => (
        <MarketContent
          payload={context.payload}
          position={position}
          signal={signal}
          team={team}
          maxPrice={maxPrice}
        />
      )}
    </TabRouteShell>
  );
}