import type { MetadataRoute } from "next";

import { navLinks } from "@/config/nav";
import { siteConfig } from "@/config/site";

/** Static sitemap covering the home page and all primary routes. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["/", ...navLinks.map((l) => l.href)];

  return routes.map((path) => ({
    url: new URL(path, siteConfig.url).toString(),
    lastModified: now,
    changeFrequency: "daily",
    priority: path === "/" ? 1 : 0.7,
  }));
}
