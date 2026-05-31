"use server";

import type { SusenTurn } from "./engine";
import { appendSusenTurn, loadSusenHistory } from "./messages";

/** Server action — load the current user's Susen chat history (24h for non-admins). */
export async function loadSusenHistoryAction(): Promise<SusenTurn[]> {
  return loadSusenHistory();
}

/** Server action — append one turn to the current user's Susen history. */
export async function appendSusenTurnAction(
  role: "user" | "susen",
  text: string,
): Promise<void> {
  return appendSusenTurn(role, text);
}
