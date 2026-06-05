"use server";

import { revalidatePath } from "next/cache";

import {
  deleteOne,
  markRead,
  markAllRead,
} from "@/lib/notifications/server";

/** Per-row dismiss — called from the swipe / × control on a single
 *  notification card. Revalidates the list so the deleted row drops
 *  out without a hard reload. */
export async function dismissNotificationAction(id: string): Promise<void> {
  await deleteOne(id);
  revalidatePath("/notifications");
}

/** Mark a single notification as read. Called by per-row tap-through
 *  links so the unread tint clears even if the user navigates back
 *  here instead of refreshing. */
export async function markReadAction(id: string): Promise<void> {
  await markRead(id);
  revalidatePath("/notifications");
}

/** Mark everything unread → read. Wired to the "Mark all read"
 *  affordance at the top of /notifications, and called automatically
 *  on first paint of the page so a traveler clearing their feed
 *  doesn't have to tap each row individually. */
export async function markAllReadAction(): Promise<void> {
  await markAllRead();
  revalidatePath("/notifications");
}
