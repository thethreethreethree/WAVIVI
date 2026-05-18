import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/** Allows general crawling; keeps auth and personal routes out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/login", "/signup", "/profile", "/auth/"],
    },
    sitemap: new URL("/sitemap.xml", siteConfig.url).toString(),
  };
}
