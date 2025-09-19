// app/cook/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { recipes, recipeSteps } from "@/db/schema";
import CookMode from "@/components/recipe/CookMode";

export const revalidate = 60;

// Prevent indexing of cook pages
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const row = await db
    .select({ title: recipes.title })
    .from(recipes)
    .where(eq(recipes.slug, params.slug))
    .limit(1);

  const title = row[0]?.title
    ? `Cook: ${row[0].title} • SourKimchi`
    : "Cook • SourKimchi";
  return {
    title,
    robots: { index: false, follow: false },
  };
}

export default async function CookPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await loadCookData(params.slug);
  if (!data) return notFound();

  const { recipeId, slug, baseServings, equipment, steps } = data;

  return (
    <CookMode
      steps={steps}
      recipeId={recipeId}
      slug={slug}
      baseServings={baseServings}
      equipment={equipment}
      enableVoice={true}
    />
  );
}

/* =========================
   Data loader
   ========================= */

async function loadCookData(slug: string) {
  const rows = await db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      title: recipes.title,
      servings: recipes.servings,
      equipment: recipes.equipment,
    })
    .from(recipes)
    .where(eq(recipes.slug, slug))
    .limit(1);

  const rec = rows[0];
  if (!rec) return null;

  const stepRows = await db
    .select({
      idx: recipeSteps.idx,
      text: recipeSteps.text,
      durationSec: recipeSteps.durationSec,
      imageUrl: recipeSteps.imageUrl,
    })
    .from(recipeSteps)
    .where(eq(recipeSteps.recipeId, rec.id))
    .orderBy(asc(recipeSteps.idx));

  const steps = stepRows.map((s) => ({
    idx: s.idx,
    text: s.text,
    durationSec: s.durationSec ?? undefined,
    imageUrl: s.imageUrl ?? undefined,
  }));

  return {
    recipeId: rec.id,
    slug: rec.slug,
    baseServings: rec.servings ?? null,
    equipment: rec.equipment ?? [],
    steps,
  };
}
