import type { DataSourceStatus } from "@/lib/types";
import { AppShell } from "./app-shell";
import { ErrorState } from "./states";

const importRequiredState = {
  manager_name: "Manager",
  team_name: "Import required",
  team_id_label: "Not imported",
  gameweek: 1,
  gameweek_label: "GW",
  deadline_label: "Import your FPL team to continue",
  formation: "3-4-3",
  bank: 0,
  free_transfers: 0,
  current_tier: "Free" as const,
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Backend request failed.";
}

export function RouteError({ title, route, error }: { title: string; route: string; error: unknown }) {
  const message = errorMessage(error);
  const importRequired = message.toLowerCase().includes("import required");
  const dataSource: DataSourceStatus = {
    mode: "unavailable",
    label: "Backend unavailable",
    detail: message,
  };

  return (
    <AppShell title={title} eyebrow={`${importRequired ? "Import required" : "Strict backend error"} - ${route}`} state={importRequiredState} dataSource={dataSource}>
      <section className="rounded-2xl border border-[#E8DEF8] bg-white p-6 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
        <h2 className="text-2xl font-black text-[#17002F]">{importRequired ? "Import your FPL team first" : "Could not load this view"}</h2>
        <p className="mt-2 text-sm font-bold text-[#5D4A70]">Route: {route}</p>
        <div className="mt-4">
          <ErrorState message={message} />
        </div>
      </section>
    </AppShell>
  );
}
