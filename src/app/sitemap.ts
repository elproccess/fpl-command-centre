import type { MetadataRoute } from "next";

const SITE_URL = "https://matchdayfpl.co.uk";

// Only the routes that render something meaningful with no prior session/imported team - the
// rest (planner, squad, transfers, scenarios, captaincy, compare, dashboard, review, settings)
// are personalized to whatever team is already imported, so a crawler visiting cold wouldn't see
// real content there and they're not useful entries for search discovery.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/about",
    "/market",
    "/pricing",
    "/trust",
    "/import",
    "/guides/beginners",
    "/guides/chips",
    "/guides/captaincy",
    "/guides/mistakes",
  ];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1.0 : 0.7,
  }));
}
