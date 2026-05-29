import { notFound, redirect } from "next/navigation";

import { BodyText, Heading } from "@/components/text";
import { getMyPet, PetPage } from "@/features/pet";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PetRoute() {
  // Feature is in development. The route 404s for end users until
  // `NEXT_PUBLIC_PET_ENABLED=1` is set in the environment.
  if (!publicEnv.petEnabled) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/pet");

  const { pet, error } = await getMyPet();
  if (!pet) {
    return (
      <section className="px-5 py-8">
        <Heading level={1}>Your pet</Heading>
        <BodyText className="mt-3">
          {error ??
            "We couldn't find your pet right now. Try refreshing — if it sticks, ping support."}
        </BodyText>
      </section>
    );
  }

  return <PetPage pet={pet} />;
}
