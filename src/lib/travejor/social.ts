/**
 * Social notifications.
 *
 * Travejor is group-chat-first by design — there are no private DMs.
 * All traveler-to-traveler interaction happens in shared group chats.
 */

export type NotificationKind = "friend" | "event" | "like" | "group" | "susen";

/** An item in the notifications screen. */
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  emoji: string;
  text: string;
  time: string;
  unread: boolean;
}

export const notifications: AppNotification[] = [
  {
    id: "n1",
    kind: "friend",
    emoji: "👋",
    text: "Marcus Webb sent you a friend request.",
    time: "5 min ago",
    unread: true,
  },
  {
    id: "n2",
    kind: "group",
    emoji: "💬",
    text: "Maya Chen joined Foodies in Bangkok.",
    time: "20 min ago",
    unread: true,
  },
  {
    id: "n3",
    kind: "susen",
    emoji: "🧭",
    text: "Susen: the vibe is rising near Khao San Road — 12 travelers heading out.",
    time: "40 min ago",
    unread: true,
  },
  {
    id: "n4",
    kind: "like",
    emoji: "❤️",
    text: "NomadicLena liked your travel note.",
    time: "1 hour ago",
    unread: false,
  },
  {
    id: "n5",
    kind: "event",
    emoji: "📅",
    text: "Rooftop Social Night starts in 3 hours.",
    time: "2 hours ago",
    unread: false,
  },
  {
    id: "n6",
    kind: "group",
    emoji: "💬",
    text: "New activity in Nightlife in Medellín — plans forming for tonight.",
    time: "Yesterday",
    unread: false,
  },
  {
    id: "n7",
    kind: "event",
    emoji: "🎉",
    text: "Your RSVP to Street Food Crawl is confirmed.",
    time: "2 days ago",
    unread: false,
  },
];
