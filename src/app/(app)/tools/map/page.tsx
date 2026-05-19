import type { Metadata } from "next";

import { ToolboxMap } from "@/components/ui/toolbox-map";
import { type CategoryId, isCategoryId } from "@/lib/toolbox/categories";

export const metadata: Metadata = {
  title: "Toolbox Map",
  description:
    "Find ATMs, banks, pharmacies, and other traveler utilities near you.",
};

export default async function ToolboxMapPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const initialCategory: CategoryId | undefined =
    category && isCategoryId(category) ? category : undefined;

  return <ToolboxMap initialCategory={initialCategory} />;
}
