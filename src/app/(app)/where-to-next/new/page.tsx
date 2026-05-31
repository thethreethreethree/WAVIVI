import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Questionnaire } from "@/features/where-to-next/questionnaire";
import { getCurrentProfile } from "@/lib/profiles";

export const metadata: Metadata = { title: "Plan a new trip" };
export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/where-to-next/new");

  return <Questionnaire />;
}
