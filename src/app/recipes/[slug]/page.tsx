// app/recipes/[slug]/page.tsx
import { notFound } from 'next/navigation';
import Script from 'next/script';
import Image from 'next/image';
import Link from 'next/link';
import { asc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  recipes,
  recipeSections,
  recipeIngredients,
  recipeSteps,
  nutrition as nutritionTable,
  recipeTags,
  tags,
  reviews,
} from '@/db/schema';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import IngredientList, { type IngredientSection as UIIngredientSection } from '@/components/recipe/IngredientList';
import StepList, { type StepItem } from '@/components/recipe/StepList';
import { recipeToJsonLd } from '@/lib/jsonld';
import { getSiteUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

export const revalidate = 60; // ISR 60s

type PageProps = { params: { slug: string } };

export default async function RecipeDetailPage({ params }: PageProps) {
  const data = await loadRecipeBySlug(params.slug);
  if (!data) return notFound();

  const {
    core,
    sections,
    steps,
    tags: tagList,
    rating,
    nutrition,
  } = data;

  // JSON-LD
  const jsonLd = recipeToJsonLd(
    {
      slug: core.slug,
      title: core.title,
      description: core.description ?? undefined,
      heroImageUrl: core.heroImageUrl ?? undefined,
      cuisine: core.cuisine ?? undefined,
      category: core.category ?? undefined,
      tags: tagList.map((t) => t.name),
      servings: core.servings ?? undefined,

      prepTimeSec: core.prepTimeSec ?? undefined,
      cookTimeSec: core.cookTimeSec ?? undefined,
      restTimeSec: core.restTimeSec ?? undefined,
      totalTimeSec: core.totalTimeSec ?? undefined,

      sections: sections.map((sec) => ({
        title: sec.title ?? undefined,
        ingredients: sec.items.map((it) => ({
          name: it.name,
          quantity: it.quantity ?? undefined,
          unit: it.unit ?? undefined,
          preparation: it.preparation ?? undefined,
        })),
      })),

      steps: steps.map((s) => ({
        idx: s.idx,
        text: s.text,
        durationSec: s.durationSec ?? undefined,
        imageUrl: s.imageUrl ?? undefined,
      })),

      equipment: core.equipment ?? undefined,

      nutrition: nutrition
        ? {
            calories: nutrition.calories ?? undefined,
            proteinG: nutrition.proteinG ?? undefined,
            fatG: nutrition.fatG ?? undefined,
            carbsG: nutrition.carbsG ?? undefined,
            fiberG: nutrition.fiberG ?? undefined,
            sugarG: nutrition.sugarG ?? undefined,
            sodiumMg: nutrition.sodiumMg ?? undefined,
          }
        : undefined,

      rating: rating
        ? { average: rating.ratingAvg ?? 0, count: rating.ratingCount ?? 0 }
        : undefined,

      createdAt: core.createdAt,
      updatedAt: core.updatedAt,
    },
    { siteUrl: getSiteUrl(), language: 'en' }
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Script id="recipe-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Title + meta */}
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold leading-tight">{core.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {core.cuisine ? <Badge variant="secondary">{core.cuisine}</Badge> : null}
          {core.category ? <Badge variant="outline">{core.category}</Badge> : null}
          {core.difficulty ? <Badge variant="outline">{core.difficulty}</Badge> : null}
          {core.servings ? <span>Servings: <span className="font-medium text-foreground">{core.servings}</span></span> : null}
          {core.totalTimeSec ? (
            <span>• Total: <span className="font-medium text-foreground">{formatDuration(core.totalTimeSec)}</span></span>
          ) : null}
          {rating?.ratingCount ? (
            <span>• Rating: <span className="font-medium text-foreground">{(rating.ratingAvg ?? 0).toFixed(1)} ({rating.ratingCount})</span></span>
          ) : null}
        </div>
        {tagList.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tagList.map((t) => (
              <Badge key={t.slug} variant="outline" className="text-xs">#{t.name}</Badge>
            ))}
          </div>
        ) : null}
      </header>

      {/* Hero */}
      {core.heroImageUrl ? (
        <div className="mt-4 overflow-hidden rounded-xl border">
          <Image
            src={core.heroImageUrl}
            alt={core.title}
            width={1200}
            height={675}
            className="h-auto w-full object-cover"
            priority
          />
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/cook/${core.slug}`}>
          <Button size="sm">Start cooking</Button>
        </Link>
        <Link href="/recipes">
          <Button size="sm" variant="outline">Back to recipes</Button>
        </Link>
      </div>

      {/* Description */}
      {core.description ? (
        <p className="mt-4 text-muted-foreground">{core.description}</p>
      ) : null}

      <Separator className="my-6" />

      {/* Times */}
      <section className={cn('grid gap-4 sm:grid-cols-3', (core.prepTimeSec || core.cookTimeSec || core.restTimeSec) ? '' : 'hidden')}>
        {core.prepTimeSec ? <TimeStat label="Prep" value={formatDuration(core.prepTimeSec)} /> : null}
        {core.cookTimeSec ? <TimeStat label="Cook" value={formatDuration(core.cookTimeSec)} /> : null}
        {core.restTimeSec ? <TimeStat label="Rest" value={formatDuration(core.restTimeSec)} /> : null}
      </section>

      {/* Ingredients + Steps */}
      <section className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-semibold">Ingredients</h2>
          <IngredientList sections={sections as UIIngredientSection[]} recipeKey={core.slug} />
        </div>

        <div>
          <h2 className="mb-3 text-xl font-semibold">Steps</h2>
          <StepList steps={steps as StepItem[]} recipeKey={core.slug} cookHref={`/cook/${core.slug}`} />
        </div>
      </section>

      {/* Equipment */}
      {core.equipment?.length ? (
        <>
          <Separator className="my-6" />
          <section>
            <h3 className="mb-2 text-lg font-semibold">Equipment</h3>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {core.equipment.map((e) => (
                <Badge key={e} variant="outline">{e}</Badge>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {/* Nutrition */}
      {nutrition ? (
        <>
          <Separator className="my-6" />
          <section>
            <h3 className="mb-2 text-lg font-semibold">Nutrition (per serving)</h3>
            <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              {nutrition.calories != null ? <li><span className="font-medium text-foreground">{nutrition.calories}</span> cal</li> : null}
              {nutrition.proteinG != null ? <li><span className="font-medium text-foreground">{nutrition.proteinG}</span> g protein</li> : null}
              {nutrition.fatG != null ? <li><span className="font-medium text-foreground">{nutrition.fatG}</span> g fat</li> : null}
              {nutrition.carbsG != null ? <li><span className="font-medium text-foreground">{nutrition.carbsG}</span> g carbs</li> : null}
              {nutrition.fiberG != null ? <li><span className="font-medium text-foreground">{nutrition.fiberG}</span> g fiber</li> : null}
              {nutrition.sugarG != null ? <li><span className="font-medium text-foreground">{nutrition.sugarG}</span> g sugar</li> : null}
              {nutrition.sodiumMg != null ? <li><span className="font-medium text-foreground">{nutrition.sodiumMg}</span> mg sodium</li> : null}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}

/* =========================
   Data loader
   ========================= */

async function loadRecipeBySlug(slug: string) {
  const row = await db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      title: recipes.title,
      description: recipes.description,
      cuisine: recipes.cuisine,
      category: recipes.category,
      difficulty: recipes.difficulty,
      heroImageUrl: recipes.heroImageUrl,
      servings: recipes.servings,
      prepTimeSec: recipes.prepTimeSec,
      cookTimeSec: recipes.cookTimeSec,
      restTimeSec: recipes.restTimeSec,
      totalTimeSec: recipes.totalTimeSec,
      equipment: recipes.equipment,
      createdAt: recipes.createdAt,
      updatedAt: recipes.updatedAt,
    })
    .from(recipes)
    .where(eq(recipes.slug, slug))
    .limit(1);

  const core = row[0];
  if (!core) return null;

  // Sections
  const secRows = await db
    .select({
      id: recipeSections.id,
      title: recipeSections.title,
      position: recipeSections.position,
    })
    .from(recipeSections)
    .where(eq(recipeSections.recipeId, core.id))
    .orderBy(asc(recipeSections.position));

  const sectionIds = secRows.map((s) => s.id);
  const ingRows = sectionIds.length
    ? await db
        .select({
          id: recipeIngredients.id,
          sectionId: recipeIngredients.sectionId,
          position: recipeIngredients.position,
          name: recipeIngredients.name,
          quantity: recipeIngredients.quantity,
          unit: recipeIngredients.unit,
          preparation: recipeIngredients.preparation,
          optional: recipeIngredients.optional,
          alternatives: recipeIngredients.alternatives,
          measureRaw: recipeIngredients.measureRaw,
        })
        .from(recipeIngredients)
        .where(inArray(recipeIngredients.sectionId, sectionIds))
        .orderBy(asc(recipeIngredients.sectionId), asc(recipeIngredients.position))
    : [];

  const sections: UIIngredientSection[] = secRows.map((s) => ({
    title: s.title ?? undefined,
    items: ingRows
      .filter((i) => i.sectionId === s.id)
      .map((i) => ({
        id: i.id,
        name: i.name,
        quantity: toNum(i.quantity) ?? undefined,
        unit: i.unit ?? undefined,
        preparation: i.preparation ?? undefined,
        optional: i.optional ?? undefined,
        alternatives: (i.alternatives ?? undefined) as string[] | undefined,
        measureRaw: i.measureRaw ?? undefined,
      })),
  }));

  // Steps
  const stepRows = await db
    .select({
      id: recipeSteps.id,
      idx: recipeSteps.idx,
      text: recipeSteps.text,
      durationSec: recipeSteps.durationSec,
      imageUrl: recipeSteps.imageUrl,
    })
    .from(recipeSteps)
    .where(eq(recipeSteps.recipeId, core.id))
    .orderBy(asc(recipeSteps.idx));

  const steps: StepItem[] = stepRows.map((s) => ({
    idx: s.idx,
    text: s.text,
    durationSec: s.durationSec ?? undefined,
    imageUrl: s.imageUrl ?? undefined,
  }));

  // Tags
  const tagRows = await db
    .select({
      name: tags.name,
      slug: tags.slug,
    })
    .from(recipeTags)
    .innerJoin(tags, eq(recipeTags.tagId, tags.id))
    .where(eq(recipeTags.recipeId, core.id));

  // Rating
  const ratingRow = await db
    .select({
      ratingAvg: sql<number | null>`avg(${reviews.stars})`.as('rating_avg'),
      ratingCount: sql<number>`count(${reviews.id})`.as('rating_count'),
    })
    .from(reviews)
    .where(eq(reviews.recipeId, core.id));

  const rating = {
    ratingAvg: toNum(ratingRow[0]?.ratingAvg) ?? null,
    ratingCount: toNum(ratingRow[0]?.ratingCount) ?? null,
  };

  // Nutrition
  const nutRows = await db
    .select({
      calories: nutritionTable.calories,
      proteinG: nutritionTable.proteinG,
      fatG: nutritionTable.fatG,
      carbsG: nutritionTable.carbsG,
      fiberG: nutritionTable.fiberG,
      sugarG: nutritionTable.sugarG,
      sodiumMg: nutritionTable.sodiumMg,
    })
    .from(nutritionTable)
    .where(eq(nutritionTable.recipeId, core.id))
    .limit(1);

  const nutrition = nutRows[0]
    ? {
        calories: nutRows[0].calories ?? null,
        proteinG: toNum(nutRows[0].proteinG),
        fatG: toNum(nutRows[0].fatG),
        carbsG: toNum(nutRows[0].carbsG),
        fiberG: toNum(nutRows[0].fiberG),
        sugarG: toNum(nutRows[0].sugarG),
        sodiumMg: nutRows[0].sodiumMg ?? null,
      }
    : null;

  return {
    core,
    sections,
    steps,
    tags: tagRows,
    rating,
    nutrition,
  };
}

/* =========================
   Helpers
   ========================= */

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h} hr ${m} min`;
  if (h > 0) return `${h} hr`;
  return `${m} min`;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function TimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-medium text-foreground">{value}</div>
    </div>
  );
}