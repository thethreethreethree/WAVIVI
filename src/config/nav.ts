/** Primary routes, used by the sitemap and robots config. */
export interface NavLink {
  href: string;
  label: string;
}

export const navLinks: NavLink[] = [
  { href: "/map", label: "Map" },
  { href: "/feed", label: "Feed" },
  { href: "/tools", label: "Tools" },
  { href: "/meet", label: "Meet Travelers" },
  { href: "/events", label: "Events" },
  { href: "/eat", label: "Where to Eat" },
  { href: "/stay", label: "Where to Stay" },
  { href: "/todo", label: "Things To Do" },
  { href: "/profile", label: "Profile" },
];
