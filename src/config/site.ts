/** Global site/app metadata. */
export const siteConfig = {
  name: "Wondavu",
  tagline: "Find your people, wherever you wander.",
  description:
    "A live social map for travelers — discover nearby travelers, join group chats, find events, and feel the vibe of every place.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  themeColor: "#f7941d",
} as const;

export type SiteConfig = typeof siteConfig;
