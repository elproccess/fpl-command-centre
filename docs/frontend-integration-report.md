# Frontend Integration Report

Generated: 2026-06-30

Strict mode used:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_STRICT_BACKEND=true
```

In strict mode, `requestJson` throws an `ApiRequestError` instead of returning fallback data. The error includes the API function name, endpoint, status code when available, and failure detail. Backend-backed routes now render the app error state instead of the Next dev error payload.

## Summary

| Page | API functions | Backend endpoint | Real data? | Mock fallback? | Status | TODO |
| --- | --- | --- | --- | --- | --- | --- |
| `/dashboard` | `getGameweekCommandCentre`, `getProjectionStatus`, `getBackendHealth` | `POST /gameweek-command-centre/dashboard`, `GET /projections/status`, `GET /health` | Yes | No | Loads real data, but first strict run took about 116s. | Backend performance/cache work for command-centre dashboard. |
| `/import` | `importTeam` on form submit | `GET /squad-health/import/{teamId}` | No on page render | No | Page is a future/start state; endpoint mapping exists for submit. | Backend lacks CORS/OPTIONS support for browser-origin import calls. |
| `/squad` | `getSquadHealthDiagnostics`, `getBackendHealth` | `POST /squad-health/analyse`, `GET /health` | Yes | No | Loads real data. | Keep an eye on slow first response, around 30s in strict check. |
| `/squad/health` | `getSquadHealthDiagnostics`, `getBackendHealth` | `POST /squad-health/analyse`, `GET /health` | Yes | No | Loads real data. | Same squad-health latency as `/squad`. |
| `/transfers` | `getTransferDecisionCentre`, `getBackendHealth` | `GET /decision-centre/transfer-decision?out_player_id=119&in_player_id=414`, `GET /health` | Yes | No | Loads real data from decision-centre endpoint. | Add user-selected transfer requests later; current QA uses seeded Mbeumo-to-Foden IDs. |
| `/scenarios` | `analyseScenario`, `getBackendHealth` | `POST /scenario-simulator/analyse`, `GET /health` | Yes | No | Loads real data. | None for mapping. |
| `/planner` | `planMultiGw`, `getBackendHealth` | `POST /multi-gw-planner/plan`, `GET /health` | No in route check | No | Strict route hits timeout and shows frontend error state. Direct backend probe eventually returned 200 in extended test logs. | Backend planner latency; frontend already exposes the real failure. |
| `/captaincy` | `getCaptaincyCentre`, `getBackendHealth` | `POST /gameweek-command-centre/dashboard`, `GET /health` | No in final route check | No | Strict route hits timeout and shows frontend error state. | Backend command-centre latency is inconsistent. |
| `/market` | `getMarketBoard`, `analyseStockMarketSquad`, `getBackendHealth` | `GET /player-stock-market/market`, `POST /player-stock-market/squad`, `GET /health` | No in route check | No | Strict route hits timeout and shows frontend error state. Direct backend probe eventually returned 200 in extended test logs. | Backend market endpoints need latency/caching work. |
| `/compare` | `getPlayerComparison` | `GET /decision-centre/compare?player_ids=119,414` | Yes | No | Loads real data. | None for mapping. |
| `/watchlist` | `getWatchlist` | `TODO /watchlist` | No | No | Correctly marked Future UI preview. | Add watchlist persistence endpoint. |
| `/review` | `getRecommendationReview`, `getBackendHealth` | `GET /recommendation-audit/report`, `GET /health` | Yes | No | Loads real data. | None for mapping. |
| `/trust` | `getModelTrust`, `getProjectionStatus`, `getBackendHealth` | `GET /projections/status`, `GET /health` | Yes | No | Loads real data. | Page also lists future API audit TODOs; data badge is real. |
| `/pricing` | none | none | No | No | Correctly marked Future UI preview. | Add billing/subscription backend when product scope is ready. |
| `/settings` | none | none | No | No | Correctly marked Future UI preview. | Add account/preferences backend when product scope is ready. |

## Route QA Matrix

| Route | Page renders | Real backend used | Mock fallback used | Endpoint(s) called | Failed endpoint(s) | Missing backend route(s) | Data shape mismatch | User-visible error state works |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard` | Yes | Yes | No | `POST /gameweek-command-centre/dashboard`, `GET /projections/status`, `GET /health` | None in final 120s check | None | Adapted command-centre response shape | Yes, via route wrapper if request fails |
| `/import` | Yes | No on render | No | None on render; submit maps `GET /squad-health/import/{teamId}` | Not route-render tested | No route missing; backend CORS/OPTIONS missing | Not checked on submit | Form has error state; browser CORS still needs backend support |
| `/squad` | Yes | Yes | No | `POST /squad-health/analyse`, `GET /health` | None | None | Adapted squad-health response shape | Yes, via route wrapper |
| `/squad/health` | Yes | Yes | No | `POST /squad-health/analyse`, `GET /health` | None | None | Adapted squad-health response shape | Yes, via route wrapper |
| `/transfers` | Yes | Yes | No | `GET /decision-centre/transfer-decision?out_player_id=119&in_player_id=414`, `GET /health` | None | None | Added transfer-decision adapter | Yes, via route wrapper |
| `/scenarios` | Yes | Yes | No | `POST /scenario-simulator/analyse`, `GET /health` | None | None | Existing adapter works | Yes, via route wrapper |
| `/planner` | No data render; error render yes | Attempted | No | `POST /multi-gw-planner/plan`, `GET /health` | `planMultiGw` aborted at strict timeout | None | Added planner adapter; not reached in route pass due timeout | Yes |
| `/captaincy` | No data render; error render yes | Attempted | No | `POST /gameweek-command-centre/dashboard`, `GET /health` | `getCaptaincyCentre` aborted at strict timeout | None | Command-centre adapter exists | Yes |
| `/market` | No data render; error render yes | Attempted | No | `GET /player-stock-market/market?limit=10`, `POST /player-stock-market/squad`, `GET /health` | `getMarketBoard` aborted at strict timeout | None | Existing market adapter works when reached | Yes |
| `/compare` | Yes | Yes | No | `GET /decision-centre/compare?player_ids=119,414` | None | None | Added compare adapter | Yes, via route wrapper |
| `/watchlist` | Yes | No | No | `TODO /watchlist` | None | Watchlist persistence endpoint missing | N/A | N/A |
| `/review` | Yes | Yes | No | `GET /recommendation-audit/report`, `GET /health` | None | None | Review adapter works | Yes, via route wrapper |
| `/trust` | Yes | Yes | No | `GET /projections/status`, `GET /health` | None | None | Trust adapter maps projection status | Yes, via route wrapper |
| `/pricing` | Yes | No | No | None | None | Billing/subscription backend not implemented | N/A | N/A |
| `/settings` | Yes | No | No | None | None | Account/preferences backend not implemented | N/A | N/A |

## Endpoint Verification

- `POST /gameweek-command-centre/dashboard`: exists and returned 200 in extended backend probe; frontend `/dashboard` loaded real data under 120s strict timeout. `/captaincy` still timed out in route pass due slow/inconsistent command-centre latency.
- `POST /squad-health/analyse`: exists, returned 200, and backs `/squad` plus `/squad/health`.
- `GET /decision-centre/transfer-decision`: exists, returned 200, and now backs `/transfers`.
- `POST /scenario-simulator/analyse`: exists, returned 200, and backs `/scenarios`.
- `POST /multi-gw-planner/plan`: exists and returned 200 in extended backend probe logs, but `/planner` timed out in strict route pass.
- `GET /player-stock-market/market`: exists and returned 200 in backend probe logs, but `/market` timed out in strict route pass.
- `POST /player-stock-market/squad`: exists and returned 200 in backend probe logs, but `/market` did not complete because the market board request timed out first.
- `GET /recommendation-audit/report`: exists, returned 200, and backs `/review`.
- `GET /projections/status`: exists, returned 200, and backs `/trust` plus dashboard status warnings.

## Notes

- No strict-mode route used mock fallback silently.
- Future UI pages are explicitly badged as Future UI preview rather than mock backend success.
- Backend sample player IDs were aligned with the real database through `api_id`, while display IDs remain stable for UI controls.
- The frontend no longer sends `Content-Type: application/json` on body-less GETs, reducing unnecessary browser preflights. The backend still needs CORS middleware for browser-origin calls such as import form submission.
