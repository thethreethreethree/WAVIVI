/**
 * Admin console data.
 *
 * Mocked analytics + operational data for the Wondavu Admin app. Reads
 * counts from the live mock datasets; swap for Supabase aggregate queries
 * once the backend is connected.
 */
import { travejorEvents } from "@/lib/travejor/events";
import { travelGroups } from "@/lib/travejor/groups";
import { members } from "@/lib/travejor/members";
import { vibeSpots } from "@/lib/travejor/vibemap";

export interface AdminStat {
  label: string;
  value: string;
  /** Percentage change vs. previous period. */
  delta: number;
  hint: string;
}

const totalTravelers = members.length * 1184; // mock scale-up
const activeGroups = travelGroups.length;
const liveEvents = travejorEvents.length;
const groupTravelers = travelGroups.reduce((s, g) => s + g.travelerCount, 0);

export const adminStats: AdminStat[] = [
  {
    label: "Travelers",
    value: totalTravelers.toLocaleString(),
    delta: 12.4,
    hint: "Registered accounts",
  },
  {
    label: "Active group chats",
    value: String(activeGroups),
    delta: 8.1,
    hint: `${groupTravelers} travelers chatting`,
  },
  {
    label: "Live events",
    value: String(liveEvents),
    delta: -3.2,
    hint: "Across all regions",
  },
  {
    label: "Vibe activity",
    value: "+37%",
    delta: 37,
    hint: "Social density, last hour",
  },
];

/** Headline numbers for the dashboard hero. */
export const platformPulse = {
  online: 1342,
  meetupsToday: 28,
  reportsOpen: 3,
  susenInterventions: 64,
};

/** Top group chats by live traveler count. */
export const topGroups = [...travelGroups]
  .sort((a, b) => b.travelerCount - a.travelerCount)
  .slice(0, 5);

/** Busiest vibe-map regions. */
export const regionActivity = (() => {
  const map = new Map<string, number>();
  for (const s of vibeSpots) {
    const region = s.location.split(",")[0].trim();
    map.set(region, (map.get(region) ?? 0) + s.travelers);
  }
  return [...map.entries()]
    .map(([region, travelers]) => ({ region, travelers }))
    .sort((a, b) => b.travelers - a.travelers);
})();

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
