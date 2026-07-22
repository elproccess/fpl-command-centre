const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const ENTRY_ID = process.env.SMOKE_ENTRY_ID ?? "3990715";
const EVENT = process.env.SMOKE_EVENT ?? "38";
const ROUTE_TIMEOUT_MS = Number(process.env.SMOKE_ROUTE_TIMEOUT_MS ?? 15000);

const routes = [
  `/dashboard?entry_id=${ENTRY_ID}&event=${EVENT}`,
  "/squad",
  "/squad/health",
  "/transfers",
  "/scenarios",
  "/planner",
  "/captaincy",
  "/market",
  "/compare",
  "/review",
  "/trust",
];

const oldMockNames = ["Mbeumo", "Foden", "Burn", "Guehi", "Muniz", "Doku"];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    assert(response.ok, `${url} returned ${response.status}: ${text.slice(0, 250)}`);
    return { text, duration: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

const importResponse = await fetch(`${BACKEND_URL}/squad-health/import/${ENTRY_ID}?event=${EVENT}`, { cache: "no-store" });
const imported = await importResponse.json();
assert(importResponse.ok, `Import failed with ${importResponse.status}`);
assert(Number(imported.event ?? imported.gameweek ?? imported.resolved_event ?? imported.resolved_gameweek) === Number(EVENT), "Import did not resolve to the expected event");
assert(Array.isArray(imported.squad) && imported.squad.length === 15, "Import did not return a 15-player squad");

const importedNames = imported.squad.map((pick) => pick.web_name).filter(Boolean);
const cookie = `fpl_entry_id=${encodeURIComponent(ENTRY_ID)}; fpl_event=${encodeURIComponent(EVENT)}; matchday_os_entry_id=${encodeURIComponent(ENTRY_ID)}; matchday_os_event=${encodeURIComponent(EVENT)}`;

for (const route of routes) {
  const url = `${FRONTEND_URL}${route}`;
  console.log(`start ${route}`);
  const { text: html, duration } = await fetchText(url, { headers: { cookie } });
  const leakedMockNames = oldMockNames.filter((name) => html.includes(name) && !importedNames.includes(name));
  assert(leakedMockNames.length === 0, `${route} leaked mock player names: ${leakedMockNames.join(", ")}`);
  assert(!html.includes("Using mock fallback"), `${route} rendered a mock fallback banner`);
  assert(!html.includes("event=1"), `${route} contains event=1`);
  console.log(`ok ${route} ${duration}ms`);
}

console.log(`Imported integration smoke passed for entry ${ENTRY_ID}, event ${EVENT}. Imported players: ${importedNames.join(", ")}`);
