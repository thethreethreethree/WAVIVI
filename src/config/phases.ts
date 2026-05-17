/**
 * WAVIVI delivery roadmap. Drives the Phase 1 status page and serves as the
 * single source of truth for build order.
 */
export type PhaseStatus = "done" | "in-progress" | "planned";

export interface Phase {
  id: number;
  goal: string;
  status: PhaseStatus;
}

export const phases: Phase[] = [
  { id: 1, goal: "Foundation & Architecture", status: "done" },
  { id: 2, goal: "Authentication & Profiles", status: "done" },
  { id: 3, goal: "Live Map System", status: "done" },
  { id: 4, goal: "Traveler Discovery", status: "in-progress" },
  { id: 5, goal: "Group Chat Ecosystem", status: "done" },
  { id: 6, goal: "Events & Meetups", status: "in-progress" },
  { id: 7, goal: "Vibe/Heat System", status: "in-progress" },
  { id: 8, goal: "AI Recommendation Layer", status: "planned" },
  { id: 9, goal: "Partner/Venue System", status: "planned" },
  { id: 10, goal: "PWA Optimization", status: "planned" },
  { id: 11, goal: "Safety & Verification", status: "planned" },
  { id: 12, goal: "Scaling & Optimization", status: "planned" },
];
