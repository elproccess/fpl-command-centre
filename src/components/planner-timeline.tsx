import type { Player, PlannerStep, TransferCandidate } from "@/lib/types";
import { FixturePill, RiskText } from "./fpl-ui";
import { PlayerVisual } from "./player-visual";

const ACTION_LABEL: Record<string, { label: string; tone: string }> = {
  transfer: { label: "Transfer", tone: "bg-[#6C1DFF]/10 text-[#6C1DFF] ring-[#6C1DFF]/20" },
  multiple_transfers: { label: "Transfers", tone: "bg-[#6C1DFF]/10 text-[#6C1DFF] ring-[#6C1DFF]/20" },
  roll: { label: "Roll", tone: "bg-[#00B8FF]/10 text-[#007AA8] ring-[#00B8FF]/25" },
  hold: { label: "Hold", tone: "bg-[#F1E8FF] text-[#7B688E] ring-[#E8DEF8]" },
};

function ActionBadge({ action }: { action: string }) {
  const entry = ACTION_LABEL[action] ?? { label: action || "Hold", tone: "bg-[#F1E8FF] text-[#7B688E] ring-[#E8DEF8]" };
  return <span className={`shrink-0 rounded-lg px-3 py-1 text-xs font-black ring-1 ${entry.tone}`}>{entry.label}</span>;
}

function formatProj(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

function TransferMoveRow({ transfersOut, transfersIn, squadPoints }: { transfersOut: Player[]; transfersIn: Player[]; squadPoints?: number | null }) {
  const pairCount = Math.max(transfersOut.length, transfersIn.length);
  const pairs = Array.from({ length: pairCount }, (_, index) => ({
    out: transfersOut[index],
    in: transfersIn[index],
  }));

  return (
    <div className="rounded-xl border border-[#E8DEF8] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7B688E]">Transfer this gameweek</p>
        {squadPoints != null ? (
          <span className="rounded-lg bg-[#EFFFF5] px-2 py-0.5 text-[10px] font-black text-[#00A85A]">{squadPoints.toFixed(1)} pts</span>
        ) : null}
      </div>
      <div className="mt-2 space-y-2">
        {pairs.map((pair, index) => (
          <div key={pair.out?.id ?? pair.in?.id ?? index} className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {pair.out ? <PlayerVisual player={pair.out} size="sm" /> : null}
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-[0.08em] text-[#E90052]">Out</p>
                <p className="truncate text-sm font-black text-[#17002F]">{pair.out?.name ?? "TBC"}</p>
              </div>
            </div>
            <span className="shrink-0 text-lg font-black text-[#8B7A9B]">&rarr;</span>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {pair.in ? <PlayerVisual player={pair.in} size="sm" /> : null}
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-[0.08em] text-[#00A844]">In</p>
                <p className="truncate text-sm font-black text-[#17002F]">{pair.in?.name ?? "TBC"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Reuses the same Out/In player-photo treatment as the main TransferMoveRow above, at a smaller
// scale, so "also considered" reads as a lighter-weight sibling of the real move rather than a
// visually unrelated list. hadRealTransfer controls the framing text: a transfer week's runner-
// ups genuinely lost a comparison, but a hold week's candidates were real options that simply
// didn't clear the bar to justify using a transfer - stating that honestly (not "should have
// happened") matches the transparency standard set by Projection Provenance/Decision Variables.
function ConsideredCandidateRow({ candidate, hadRealTransfer }: { candidate: TransferCandidate; hadRealTransfer: boolean }) {
  const gainLabel = candidate.net_projected_gain > 0 ? `+${candidate.net_projected_gain}` : `${candidate.net_projected_gain}`;
  const verdict = hadRealTransfer ? "Runner-up" : "Didn't beat holding";
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#E8DEF8] bg-white p-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <PlayerVisual player={candidate.out_player} size="sm" />
        <span className="shrink-0 text-xs font-black text-[#8B7A9B]">&rarr;</span>
        <PlayerVisual player={candidate.in_player} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black text-[#17002F]">
          {candidate.out_player.name} &rarr; {candidate.in_player.name}
        </p>
        <p className="text-[10px] font-bold text-[#7B688E]">
          {gainLabel} pts &middot; {verdict}
        </p>
      </div>
    </div>
  );
}

function ConsideredCandidates({
  candidates,
  hadRealTransfer,
  isBaselineRoute,
}: {
  candidates: TransferCandidate[];
  hadRealTransfer: boolean;
  isBaselineRoute?: boolean;
}) {
  if (!candidates.length) {
    // The pure roll/baseline route only evaluates alternatives for GW1 (reusing that same
    // top-level scan every other route's GW1 already ran) - later gameweeks genuinely have no
    // runner-up data because the baseline deliberately never re-runs a fresh scenario search
    // every week (that's what keeps it a cheap, stable reference point). Saying so explicitly
    // stops an empty section from reading as missing/broken data.
    if (isBaselineRoute) {
      return (
        <div className="mt-3 rounded-xl border border-dashed border-[#E8DEF8] bg-[#FBFAFF] p-3">
          <p className="text-[10px] font-semibold text-[#7B688E]">
            No alternatives evaluated for this hold week - the baseline route only re-checks transfer options once for the whole horizon (GW1).
          </p>
        </div>
      );
    }
    return null;
  }
  return (
    <div className="mt-3 rounded-xl border border-[#E8DEF8] bg-[#FBFAFF] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7B688E]">
        {hadRealTransfer ? "Also considered this week" : "Transfers considered but didn't beat holding"}
      </p>
      <div className="mt-2 space-y-1.5">
        {candidates.map((candidate) => (
          <ConsideredCandidateRow key={`${candidate.out_player.id}-${candidate.in_player.id}`} candidate={candidate} hadRealTransfer={hadRealTransfer} />
        ))}
      </div>
    </div>
  );
}

export function PlannerTimeline({ steps, isBaselineRoute }: { steps: PlannerStep[]; isBaselineRoute?: boolean }) {
  // Grid column count matches the real step count (3-6) instead of a hardcoded 3, so a genuine
  // 5-GW plan lays out as one clean row on desktop instead of wrapping 3+2 with a connector bar
  // trailing off into nothing.
  const columns = Math.max(1, steps.length);
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };

  return (
    <div className="rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="mb-6 grid gap-2" style={gridStyle}>
        {steps.map((step, index) => (
          <div key={step.gw} className="flex items-center gap-2">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${index === 0 ? "bg-[#6C1DFF] text-white" : "bg-[#F1E8FF] text-[#6C1DFF]"}`}>{step.gw.replace("GW", "")}</span>
            {index < steps.length - 1 ? <span className={`h-1 flex-1 rounded-full ${index === 0 ? "bg-[#6C1DFF]" : "bg-[#E8DEF8]"}`} /> : null}
          </div>
        ))}
      </div>
      {/* items-stretch (grid's own default, made explicit here) makes every card in a row match
          the row's tallest card - content that's shorter (e.g. a hold week with less reasoning
          text) just leaves blank space at the bottom rather than the row looking jagged. h-full
          on the card itself is needed too: without it, a grid item stretches but a flex-column
          child inside can still size to its own content and leave the stretch unused. */}
      <div className="grid items-stretch gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))` }}>
        {steps.map((step) => {
          if (step.__pending) {
            return (
              <article
                key={step.gw}
                className="gw-placeholder-pulse flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#E8DEF8] bg-white/70 p-5 text-center"
              >
                <p className="text-xl font-black text-[#6C1DFF]">{step.gw}</p>
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#6C1DFF] border-t-transparent" aria-hidden />
                <p className="text-sm font-black text-[#6C1DFF]">Calculating...</p>
              </article>
            );
          }
          const hasTransfers = Boolean(step.transfers_out?.length || step.transfers_in?.length);
          const reasoning = step.reasoning?.length ? step.reasoning : step.warning ? [step.warning] : [];
          return (
            <article key={step.gw} className="gw-pop-in flex h-full flex-col rounded-xl border border-[#E8DEF8] bg-[#FBFAFF] p-5">
              {/* Header: GW number, fixture, action */}
              <div className="flex items-center justify-between gap-2">
                <p className="text-2xl font-black text-[#6C1DFF]">{step.gw}</p>
                <div className="flex items-center gap-2">
                  <FixturePill fixture={step.fixture} difficulty={step.fixture_difficulty} />
                  <ActionBadge action={step.action} />
                </div>
              </div>

              {/* Visual section: captain, plus the transfer this gameweek if there was one */}
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-[#E8DEF8] bg-white p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7B688E]">Captain</p>
                  <div className="mt-2 flex items-center gap-3">
                    {step.captain ? <PlayerVisual player={step.captain} size="sm" /> : null}
                    <div className="min-w-0">
                      <p className="truncate font-black text-[#17002F]">{step.captain?.name ?? "TBC"}</p>
                      <p className="text-xs font-bold text-[#5D4A70]">{step.captain ? `${step.captain.team} / ${step.captain.position}` : "Captain model pending"}</p>
                    </div>
                  </div>
                </div>
                {hasTransfers ? <TransferMoveRow transfersOut={step.transfers_out ?? []} transfersIn={step.transfers_in ?? []} squadPoints={step.projected_points} /> : null}
                <ConsideredCandidates candidates={step.transfer_candidates_considered ?? []} hadRealTransfer={hasTransfers} isBaselineRoute={isBaselineRoute} />
              </div>

              {/* Squad points / risk */}
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7B688E]">Squad points</p>
                  <span className="text-3xl font-black text-[#00A844]">{step.projected_points ?? "—"}</span>
                </div>
                <RiskText value={step.risk} />
              </div>

              {step.data_quality_warning ? (
                <div className="mt-3 rounded-lg border border-[#E90052]/25 bg-[#E90052]/8 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#C80046]">Data confidence</p>
                  <p className="mt-1 text-xs font-bold text-[#8A0038]">{step.data_quality_warning}</p>
                </div>
              ) : null}

              {/* Reasoning: its own clearly separated block, not mixed into the visual section */}
              {reasoning.length ? (
                <div className="mt-4 rounded-xl bg-[#F1E8FF]/50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7B688E]">Why</p>
                  <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-5 text-[#3C2752]">
                    {reasoning.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
