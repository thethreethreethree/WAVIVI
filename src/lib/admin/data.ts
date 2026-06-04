/**
 * Admin console — shared types + mock fixtures.
 *
 * The LIVE dashboard aggregates moved to admin/dashboard.ts so the
 * server-only directive there doesn't poison client pages that still
 * read the moderation / verification / audit / error mocks from this
 * file (e.g. /admin/moderation is "use client"). The split keeps
 * client-side imports working until each of those surfaces gets its
 * own server-side data path.
 *
 * AdminStat lives here because it's used by both the live dashboard
 * (server) and the StatCard component (client) — a type-only import
 * is erased at build time, so either side is safe.
 */

export interface AdminStat {
  label: string;
  value: string;
  /** Percentage change vs. previous period. */
  delta: number;
  hint: string;
}
// --- Moderation -------------------------------------------------------------
export type ReportStatus = "open" | "reviewing" | "resolved";

export interface ModerationReport {
  id: string;
  subject: string;
  reason: string;
  reportedBy: string;
  time: string;
  status: ReportStatus;
}

export const moderationReports: ModerationReport[] = [
  {
    id: "r1",
    subject: "@drifter_92",
    reason: "Spam links in Nightlife in Medellín",
    reportedBy: "Maya Chen",
    time: "12 min ago",
    status: "open",
  },
  {
    id: "r2",
    subject: "@lostpassport",
    reason: "Harassment reported in a group chat",
    reportedBy: "Sarah Mitchell",
    time: "1 hour ago",
    status: "open",
  },
  {
    id: "r3",
    subject: "Beach Bonfire & Music",
    reason: "Event flagged as possibly fake",
    reportedBy: "Alex Rodriguez",
    time: "3 hours ago",
    status: "reviewing",
  },
  {
    id: "r4",
    subject: "@quicktrip",
    reason: "Inappropriate profile photo",
    reportedBy: "Carlos Mendez",
    time: "Yesterday",
    status: "resolved",
  },
];

/** Pending identity-verification requests. */
export interface VerificationRequest {
  id: string;
  name: string;
  username: string;
  submitted: string;
}

export const verificationRequests: VerificationRequest[] = [
  { id: "v1", name: "Emma Rodriguez", username: "emmar", submitted: "2 hours ago" },
  { id: "v2", name: "David Kim", username: "davidk", submitted: "5 hours ago" },
  { id: "v3", name: "Zara Bell", username: "zarab", submitted: "1 day ago" },
];

// Susen monitoring now reads live data — see /admin/susen
// (src/app/(web)/admin/susen/page.tsx) and src/lib/susen/*.

// --- Logs -------------------------------------------------------------------
export interface AuditEntry {
  id: string;
  admin: string;
  action: string;
  time: string;
}

export const auditLog: AuditEntry[] = [
  { id: "a1", admin: "you", action: "Approved verification for @sarahmitchell", time: "18 min ago" },
  { id: "a2", admin: "you", action: "Marked Rooftop Social Night as Wondavu Approved", time: "1 hour ago" },
  { id: "a3", admin: "ops_kelly", action: "Suspended account @drifter_92", time: "3 hours ago" },
  { id: "a4", admin: "ops_kelly", action: "Edited event: Street Food Crawl", time: "Yesterday" },
  { id: "a5", admin: "you", action: "Published announcement: Safety reminder", time: "2 days ago" },
];

export interface ErrorEntry {
  id: string;
  level: "warn" | "error";
  message: string;
  time: string;
}

export const errorLog: ErrorEntry[] = [
  { id: "e1", level: "warn", message: "Geolocation timeout on Vibe Map (3 users)", time: "9 min ago" },
  { id: "e2", level: "error", message: "Image CDN 504 — picsum.photos", time: "47 min ago" },
  { id: "e3", level: "warn", message: "Slow query: group_chat_messages (1.8s)", time: "2 hours ago" },
  { id: "e4", level: "error", message: "Push notification delivery failed (region: Bali)", time: "Yesterday" },
];
