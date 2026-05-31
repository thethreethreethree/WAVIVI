"use server";

import type { SusenReplyTo, SusenTurn } from "./engine";
import {
  appendSusenLocation,
  appendSusenTurn,
  loadSusenHistory,
} from "./messages";

/** Server action — load the current user's Susen chat history (24h for non-admins). */
export async function loadSusenHistoryAction(): Promise<SusenTurn[]> {
  return loadSusenHistory();
}

/** Server action — append one turn to the current user's Susen history.
 *  Returns the inserted row id (or null for signed-out / failed writes)
 *  so the client can stamp turn.id and use it as a reply target. */
export async function appendSusenTurnAction(
  role: "user" | "susen",
  text: string,
  replyTo: SusenReplyTo | null = null,
): Promise<string | null> {
  return appendSusenTurn(role, text, replyTo);
}

/** Server action — persist a location-pin turn (the user shares "I'm here"
 *  with Susen). No reply target wiring yet; Susen will respond on the next
 *  text turn. */
export async function appendSusenLocationAction(
  lat: number,
  lng: number,
  accuracyM: number | null = null,
  label: string | null = null,
): Promise<string | null> {
  return appendSusenLocation(lat, lng, accuracyM, label);
}
