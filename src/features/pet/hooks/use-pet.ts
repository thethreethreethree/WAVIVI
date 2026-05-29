"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { PetRow } from "@/types/supabase";

/** Subscribes to live pet updates over Supabase Realtime so reward
 *  toasts, stage evolutions, and stat bumps can render without a
 *  router refresh. Returns the latest snapshot or null while loading. */
export function usePet(userId: string | null): PetRow | null {
  const [pet, setPet] = useState<PetRow | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;

    supabase
      .from("pet")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setPet(data as PetRow);
      });

    const channel = supabase
      .channel(`pet:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pet",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (active) setPet(payload.new as PetRow);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return pet;
}
