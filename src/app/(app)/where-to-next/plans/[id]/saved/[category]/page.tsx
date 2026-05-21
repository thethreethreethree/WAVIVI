import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ManageSavedList } from "@/features/where-to-next/manage-saved-list";
import { VerificationGate } from "@/features/where-to-next/verification-gate";
import type { SavedItemList } from "@/features/where-to-next/actions";
import { getCurrentProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import type { SavedTravelItem, TravelPlanRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

type Slug = "stay" | "eat" | "do" | "events";

interface CategoryMeta {
  title: string;
  emptyHint: string;
  addPlaceholder: string;
  column: SavedItemList;
  /** Optional discoverability link (e.g. browse stays). */
  browseHref?: string;
  browseLabel?: string;
}

const META: Record<Slug, CategoryMeta> = {
  stay: {
    title: "Places I'll stay",
    emptyHint:
      "Add a hotel or hostel by tapping Save to my trip from any listing, or type one in below.",
    addPlaceholder: "Add a place to stay…",
    column: "saved_hotels",
    browseHref: "/stay",
    browseLabel: "Browse Where to Stay",
  },
  eat: {
    title: "Where I will eat",
    emptyHint:
      "Type a restaurant you want to try — add notes about the dish you're going for.",
    addPlaceholder: "Add a restaurant…",
    column: "saved_restaurants",
    browseHref: "/eat",
    browseLabel: "Browse Where to Eat",
  },
  do: {
    title: "What I will do",
    emptyHint:
      "Activities, sights, experiences — anything you don't want to forget about for the trip.",
    addPlaceholder: "Add an activity…",
    column: "saved_activities",
    browseHref: "/todo",
    browseLabel: "Browse Things to Do",
  },
  events: {
    title: "Saved events",
    emptyHint:
      "Save events from the Events list, or add one by hand if it's not in the system yet.",
    addPlaceholder: "Add an event…",
    column: "saved_events",
    browseHref: "/events",
    browseLabel: "Browse Events",
  },
};

function isSlug(v: string): v is Slug {
  return v === "stay" || v === "eat" || v === "do" || v === "events";
}

type Params = Promise<{ id: string; category: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isSlug(category)) return { title: "Saved" };
  return { title: META[category].title };
}

export default async function ManageSavedPage({
  params,
}: {
  params: Params;
}) {
  const { id, category } = await params;
  if (!isSlug(category)) notFound();
  const meta = META[category];

  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=/where-to-next/plans/${id}/saved/${category}`);
  if (!profile.instagram_verified) return <VerificationGate />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("travel_plans")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const plan = data as TravelPlanRow | null;
  if (!plan) notFound();

  const items =
    ((plan as unknown as Record<string, SavedTravelItem[]>)[meta.column]) ?? [];

  return (
    <ManageSavedList
      planId={plan.id}
      list={meta.column}
      title={meta.title}
      emptyHint={meta.emptyHint}
      addPlaceholder={meta.addPlaceholder}
      browseHref={meta.browseHref}
      browseLabel={meta.browseLabel}
      initialItems={items}
    />
  );
}
