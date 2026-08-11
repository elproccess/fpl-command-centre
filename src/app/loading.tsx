import { LoadingState } from "@/components/states";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--surface-2)] p-6 text-[var(--ink)]">
      <div className="mx-auto max-w-3xl">
        <LoadingState label="Loading your FPL command centre" />
      </div>
    </main>
  );
}
