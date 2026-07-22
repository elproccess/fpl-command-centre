import { Suspense } from "react";
import { LoadingState } from "@/components/states";
import { ImportedDashboardFlow } from "@/components/imported-dashboard-flow";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F4F0FA] p-6"><LoadingState label="Loading command centre" /></main>}>
      <ImportedDashboardFlow />
    </Suspense>
  );
}
