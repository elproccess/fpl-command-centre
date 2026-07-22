import { LoadingState } from "@/components/states";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#F4F0FA] p-6 text-[#17002F]">
      <div className="mx-auto max-w-3xl">
        <LoadingState label="Loading your FPL command centre" />
      </div>
    </main>
  );
}
