import type { ApiAuditEntry } from "./types";

export const apiAudit: ApiAuditEntry[] = [
  {
    feature: "Gameweek Command Centre",
    frontendNeed: "Dashboard briefing, best move, captaincy, checklist, risks, planner, market panels",
    status: "real",
    realEndpoint: "POST /gameweek-command-centre/dashboard",
    note: "Primary BFF-style backend endpoint. UI adapts its panel-shaped response into command-centre cards.",
  },
  {
    feature: "Squad Health Diagnostics",
    frontendNeed: "Full issue diagnostics with severity, affected player, reason, action",
    status: "mapped",
    realEndpoint: "POST /squad-health/analyse",
    oldSpeculativeEndpoint: "POST /squad-health/diagnostics",
    note: "No diagnostics-specific route exists. UI derives the diagnostic sections from analyse response fields.",
  },
  {
    feature: "Captaincy Centre",
    frontendNeed: "Best captain, vice, top options, ceiling/safety, minutes and fixture risk",
    status: "mapped",
    realEndpoint: "POST /gameweek-command-centre/dashboard",
    oldSpeculativeEndpoint: "POST /captaincy/centre",
    note: "No standalone captaincy route exists. UI derives captaincy from the command-centre captaincy panel and projections.",
  },
  {
    feature: "Decision Centre",
    frontendNeed: "Best move, why, alternatives, roll/no-hit state",
    status: "mapped",
    realEndpoint: "POST /gameweek-command-centre/dashboard + GET /decision-centre/recommendations",
    oldSpeculativeEndpoint: "POST /decision-centre/centre",
    note: "Decision overview is built from the command-centre best move panel, with recommendation lists available from decision-centre routes.",
  },
  {
    feature: "Player Compare",
    frontendNeed: "Player A/B comparison and verdict",
    status: "mapped",
    realEndpoint: "GET /decision-centre/compare?player_ids=...",
    oldSpeculativeEndpoint: "POST /player-comparison/compare",
    note: "Backend comparison is query-driven under decision-centre. UI keeps interactive selectors and adapts response when connected.",
  },
  {
    feature: "Player Stock Market Board",
    frontendNeed: "Trading-board market, filters, detail card, owned alerts",
    status: "mapped",
    realEndpoint: "GET /player-stock-market/market + POST /player-stock-market/squad",
    oldSpeculativeEndpoint: "GET /player-stock-market/board",
    note: "No board endpoint exists. UI derives board groupings from market overview and squad market analysis.",
  },
  {
    feature: "Last GW Review",
    frontendNeed: "Recommendation audit and trust-building review",
    status: "mapped",
    realEndpoint: "GET /recommendation-audit/report",
    oldSpeculativeEndpoint: "GET /recommendation-audit/latest",
    note: "Backend exposes report/evaluate/snapshot. UI maps report output into user-facing review cards.",
  },
  {
    feature: "Model Trust",
    frontendNeed: "Active model, fallback, confidence/risk explanation, rollback safety",
    status: "mapped",
    realEndpoint: "GET /projections/status",
    oldSpeculativeEndpoint: "GET /model-trust",
    note: "Projection status is the real source of model/fallback truth. Plain-English trust copy remains frontend-owned.",
  },
  {
    feature: "Watchlist",
    frontendNeed: "Saved players, groups, add/remove actions, alerts",
    status: "future-bff",
    oldSpeculativeEndpoint: "GET /watchlist",
    note: "No backend watchlist persistence route exists yet. Keep as explicit future UI preview until a BFF endpoint is added.",
  },
  {
    feature: "Refresh Projections (dev tool)",
    frontendNeed: "Manually recompute/persist projection rows for a gameweek range from an admin-style action",
    status: "real",
    realEndpoint: "POST /projections/compute",
    note: "Wired into Settings as a visibly-labelled 'Dev tool' since no isAdmin/role gating exists anywhere in the app yet. A full unfiltered run took ~80s locally. Needs a real permission check before this ships publicly.",
  },
  {
    feature: "Create Audit Snapshot",
    frontendNeed: "Manually capture the current recommendation (best move, captaincy) as an auditable snapshot for a gameweek",
    status: "real",
    realEndpoint: "POST /recommendation-audit/snapshot",
    note: "Wired into Review, above the recommendation history cards. Fetches the raw (unnormalized) gameweek-command-centre/dashboard response and forwards it as recommendation_payload so the backend's field lookups (best_move_panel, captaincy_panel, deadline_summary) resolve correctly.",
  },
  {
    feature: "Lightweight Dashboard Load",
    frontendNeed: "Instant paint on first dashboard load, then upgrade to full analysis without a blank reload",
    status: "real",
    realEndpoint: "POST /gameweek-command-centre/dashboard (lightweight: true, then a background full request)",
    note: "Imported dashboard flow already sent lightweight:true for instant paint; the full request now fires automatically in the background afterward instead of waiting for a manual 'Load full Command Centre' click, and merges in without blanking the lightweight view.",
  },
  {
    feature: "Save/Reload Scenario",
    frontendNeed: "Persist a built scenario (transfer, captaincy, hit, bench switch) and reload it later by ID",
    status: "real",
    realEndpoint: "POST /scenario-simulator/save + GET /scenario-simulator/{id}",
    note: "Wired into the Scenario Simulator builder. 'Run scenario' was previously a purely local client-side calculation with no backend call at all (the 'Prepared backend payload' block was just a JSON dump, never sent); 'Save this scenario' now persists that prepared payload for real, and 'Load saved scenario' (or a ?simulation_id= URL param) restores the out/in/captain/vice/hit-cost fields from a saved simulation ID.",
  },
  {
    feature: "Saved Squad Health (historical view)",
    frontendNeed: "View squad health/diagnostics as of a specific past saved gameweek, not just the live squad",
    status: "real",
    realEndpoint: "GET /squad-health/{entry_id}",
    note: "Added to My Squad as a 'Saved / historical view' panel. Genuinely different from POST /squad-health/analyse: analyse only ever sees the live squad the frontend already holds in memory, while this re-runs diagnostics against whatever squad snapshot was actually saved in the DB for a chosen entry_id/gameweek.",
  },
  {
    feature: "Model Training Pipeline (dev tool)",
    frontendNeed: "Active model version, MAE, and full promotion history; manually trigger a retrain",
    status: "real",
    realEndpoint: "GET /projection-training/status + GET /projection-training/models + POST /projection-training/train",
    note: "New page at Settings > Model Training, labelled 'Dev tool' since no isAdmin/role gating exists. The heavy historical_sportmonks candidate-search pipeline that produced the currently-active model was run manually via raw Python, outside this UI, and is intentionally left that way - 'Run training' instead wires the standard /train endpoint (ridge-regression retrain, ~4 min locally over the full dataset) and never forces promotion; a candidate only goes active if it clears the promotion gates. /status's active_trained_model omits metrics entirely, so the header MAE is looked up by matching model_version against the /models list instead.",
  },
  {
    feature: "Backtest Results",
    frontendNeed: "Show how the active projection model performs against real historical gameweek outcomes",
    status: "real",
    realEndpoint: "GET /backtest/status + GET /backtest/runs",
    note: "Added as a new section on the Trust page, directly below Active model status, since both are model-confidence content. Read-only for now (no run-trigger wired) - status/history alone was the ask. MAE is only present on 'projections' backtest_type runs; captaincy/scenarios runs show '-' since their summary shape doesn't carry mean_absolute_error.",
  },
  {
    feature: "Decision Variables Transparency",
    frontendNeed: "Explain which underlying variables actually drive buy/sell/hold scoring",
    status: "real",
    realEndpoint: "GET /decision-centre/variables",
    note: "Added as a new Trust page card, right below Active model status. No overlap anywhere else - nothing previously explained which of the tracked variables are actually used in scoring vs merely tracked.",
  },
  {
    feature: "Player Decision + Projection Breakdown",
    frontendNeed: "Deep 'why' drill-down for a single player: trend/fixture/role/market analysis, evidence, and projection model provenance",
    status: "real",
    realEndpoint: "GET /decision-centre/player/{id} + GET /projections/player/{id}",
    note: "Added as an expandable 'Full breakdown' panel per player on Compare, loaded on demand. Compare's existing card-level fields (via /decision-centre/compare) only ever carry the same lightweight DecisionPlayerCard shown in lists - these two endpoints expose materially deeper data (per-factor trend/fixture/role/market analysis, raw evidence, and which trained model/fallback produced the projection with its holdout MAE) that wasn't surfaced anywhere.",
  },
];

// Explicitly evaluated and skipped as redundant (not wired):
// - GET /scenario-simulator/from-entry/{id}: the frontend already holds the full imported
//   squad in memory by the time /scenarios loads (via loadImportedContext), so it builds
//   /scenario-simulator/analyse requests directly. from-entry exists to re-derive squad/bank/
//   free_transfers from a DB-saved copy for callers who only have an entry_id - the frontend
//   is never in that position, so wiring it would just be a second, more stale path to the
//   same analysis.
// - GET /squad-health/{entry_id}/recommendations: its fields (top_actions, captaincy,
//   starting_xi, transfer_priorities, replacement_suggestions, transfer_strategy,
//   risks_to_monitor) are a strict subset of what GET /squad-health/{entry_id} already
//   returns and already renders via the historical-view panel above, so a separate call
//   would just refetch data already on screen.
// - GET /decision-centre/players: a filterable/sortable/paginated all-players list with a
//   decision label + score + reason per player - the same practical "browse and filter every
//   player with a recommendation" capability the Market page already provides via
//   /player-stock-market/market (rising/falling, top signals, owned alerts, position/team/
//   price filters). Different scoring engine, same UX job; adding a second full player-browser
//   page would just fragment where users go to answer "who should I look at."
// - GET /player-stock-market/player/{id}: returns the same _market_card fields already present
//   in each row of /player-stock-market/market's response (both are built from the same card
//   function) - for any player already in the loaded market list, this is an extra network
//   call for data already in memory. Would only earn its keep if the UI grew a "view full
//   market detail for a player outside the current loaded page" flow, which doesn't exist yet.
// - GET /projections/audit-report: answers the same question ("how accurate is the projection
//   model") as the Backtest Results section added above, via a different, always-recomputed
//   (not persisted-run-based) path scoped to the formula model. Adding it as a third accuracy
//   section on the same Trust page would be the exact redundancy this phase asked to avoid.
// - GET /projections/gameweek/{gw} and GET /projections/horizon: bulk raw-projection list
//   endpoints. Every number they'd add is already baked into the bulk views Market, Squad,
//   and Planner already render (projected_points_horizon per player, captain/vice projections,
//   planner gameweek steps) - a bare "list of raw projections" view would just be a thinner
//   duplicate of those.

export const futureBffTodos = apiAudit.filter((entry) => entry.status === "future-bff");
