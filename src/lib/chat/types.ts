/** A group chat room, usually tied to a place or travel topic. */
export interface ChatRoom {
  id: string;
  name: string;
  /** Free-text location or scope, e.g. "Lisbon, Portugal". */
  place: string;
  /** One-line description shown in the room list. */
  topic: string;
  emoji: string;
  memberCount: number;
}

/** A single message within a chat room. */
export interface ChatMessage {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  body: string;
  /** ISO 8601 timestamp. */
  sentAt: string;
}

/** The signed-in user, mocked until Supabase auth is wired in. */
export interface ChatIdentity {
  id: string;
  name: string;
  initials: string;
}
