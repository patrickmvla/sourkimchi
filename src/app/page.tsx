/* eslint-disable @typescript-eslint/no-explicit-any */
// app/page.tsx
import Link from "next/link";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { recipes, reviews } from "@/db/schema";
import {
  creators,
  creatorCollections,
  collectionCreators,
} from "@/db/creator-schema";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RecipeCard from "@/components/recipe/RecipeCard";
import CreatorCollectionSection from "@/components/discover/CreatorCollectionSection";
import CreatorSpotlightCard from "@/components/discover/CreatorSpotlightCard";

export const runtime = "nodejs";
export const revalidate = 60;

export default async function Home() {
  // Run in parallel but don’t let one failure crash the page
  const [latestRes, collectionsRes, creatorsRes] = await Promise.allSettled([
    getLatestRecipes(12),
    getFeaturedCollections(2),
    getFeaturedCreators(6),
  ]);

  const latestRecipes = latestRes.status === "fulfilled" ? latestRes.value : [];
  const featuredCollections =
    collectionsRes.status === "fulfilled" ? collectionsRes.value : [];
  const featuredCreators =
    creatorsRes.status === "fulfilled" ? creatorsRes.value : [];

  const collectionsWithItems = await (async () => {
    try {
      if (!featuredCollections.length) return [];
      return await hydrateCollectionsWithCreators(featuredCollections);
    } catch (e) {
      console.error("hydrateCollectionsWithCreators: fallback", e);
      return [];
    }
  })();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="mb-10 rounded-2xl border bg-gradient-to-br from-amber-50 to-white p-6 sm:p-10">
        <Badge variant="secondary" className="mb-3">
          SourKimchi
        </Badge>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          Fall in love with cooking.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Structured recipes, a buttery-smooth cook mode, and curated YouTube
          and Instagram creators you’ll adore.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/recipes">
            <Button size="lg">Browse recipes</Button>
          </Link>
          <Link href="/discover">
            <Button size="lg" variant="outline">
              Discover creators
            </Button>
          </Link>
        </div>
      </section>

      {/* Featured creator collections or spotlights */}
      {collectionsWithItems.length > 0 ? (
        <div className="space-y-8">
          {collectionsWithItems.map((col) => (
            <CreatorCollectionSection
              key={col.slug}
              title={col.title}
              description={col.description ?? undefined}
              items={col.creators}
              href={`/discover`}
              columns={3}
            />
          ))}
        </div>
      ) : featuredCreators.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-semibold">Creator spotlights</h2>
            <Link href="/discover">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featuredCreators.map((c) => (
              <CreatorSpotlightCard key={c.slug} c={c} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Latest recipes */}
      <section className="mt-10 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Latest recipes</h2>
          <Link href="/recipes">
            <Button variant="ghost" size="sm">
              Browse all
            </Button>
          </Link>
        </div>
        {latestRecipes.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {latestRecipes.map((r) => (
              <RecipeCard key={r.id} r={r} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border p-6 text-sm text-muted-foreground">
            Nothing to show right now. Try again in a moment.
          </div>
        )}
      </section>
    </main>
  );
}

/* =========================
   Data loaders (with fallbacks)
   ========================= */

async function getLatestRecipes(limit: number) {
  try {
    const ra = db
      .select({
        recipeId: reviews.recipeId,
        ratingAvg: sql<number | null>`avg(${reviews.stars})`.as("rating_avg"),
        ratingCount: sql<number>`count(${reviews.id})`.as("rating_count"),
      })
      .from(reviews)
      .groupBy(reviews.recipeId)
      .as("ra");

    const totalTimeExpr = sql<number>`
      COALESCE(
        ${recipes.totalTimeSec},
        COALESCE(${recipes.prepTimeSec}, 0) + COALESCE(${recipes.cookTimeSec}, 0) + COALESCE(${recipes.restTimeSec}, 0)
      )
    `;

    const rows = await db
      .select({
        id: recipes.id,
        slug: recipes.slug,
        title: recipes.title,
        image: recipes.heroImageUrl,
        cuisine: recipes.cuisine,
        category: recipes.category,
        totalTimeSec: totalTimeExpr,
        ratingAvg: ra.ratingAvg,
        ratingCount: ra.ratingCount,
        createdAt: recipes.createdAt,
      })
      .from(recipes)
      .leftJoin(ra, eq(ra.recipeId, recipes.id))
      .where(eq(recipes.isPublic, true))
      .orderBy(desc(recipes.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      image: r.image ?? null,
      cuisine: r.cuisine ?? null,
      category: r.category ?? null,
      totalTimeSec: toNum(r.totalTimeSec),
      ratingAvg: toNum(r.ratingAvg),
      ratingCount: toNum(r.ratingCount),
    }));
  } catch (e) {
    console.error("getLatestRecipes: fallback due to DB error", e);
    return [];
  }
}

async function getFeaturedCollections(limit: number) {
  try {
    const rows = await db
      .select({
        id: creatorCollections.id,
        slug: creatorCollections.slug,
        title: creatorCollections.title,
        description: creatorCollections.description,
        coverImageUrl: creatorCollections.coverImageUrl,
        isFeatured: creatorCollections.isFeatured,
        updatedAt: creatorCollections.updatedAt,
      })
      .from(creatorCollections)
      .where(eq(creatorCollections.isFeatured, true))
      .orderBy(asc(creatorCollections.title))
      .limit(limit);

    return rows;
  } catch (e) {
    console.error("getFeaturedCollections: fallback due to DB error", e);
    return [];
  }
}

async function hydrateCollectionsWithCreators(
  cols: Awaited<ReturnType<typeof getFeaturedCollections>>
) {
  try {
    if (!cols.length)
      return [] as {
        id: string;
        slug: string;
        title: string;
        description: string | null;
        creators: CreatorSpotlight[];
      }[];

    const ids = cols.map((c) => c.id);

    const items = await db
      .select({
        collectionId: collectionCreators.collectionId,
        position: collectionCreators.position,
        slug: creators.slug,
        displayName: creators.displayName,
        handle: creators.handle,
        url: creators.url,
        avatarUrl: creators.avatarUrl,
        platform: creators.platform,
        tagline: creators.tagline,
        loveNote: creators.loveNote,
        tags: creators.tags,
        cuisines: creators.cuisines,
        startHere: creators.startHere,
      })
      .from(collectionCreators)
      .innerJoin(creators, eq(collectionCreators.creatorId, creators.id))
      .where(inArray(collectionCreators.collectionId, ids))
      .orderBy(asc(collectionCreators.position));

    const grouped = new Map<string, CreatorSpotlight[]>();
    for (const it of items) {
      const arr = grouped.get(it.collectionId) ?? [];
      arr.push({
        slug: it.slug,
        platform: it.platform,
        displayName: it.displayName,
        handle: it.handle,
        url: it.url,
        avatarUrl: it.avatarUrl ?? undefined,
        tagline: it.tagline ?? undefined,
        loveNote: it.loveNote ?? undefined,
        tags: it.tags ?? undefined,
        cuisines: it.cuisines ?? undefined,
        startHere: (it.startHere as any) ?? undefined,
      });
      grouped.set(it.collectionId, arr);
    }

    return cols.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description ?? null,
      creators: grouped.get(c.id) ?? [],
    }));
  } catch (e) {
    console.error(
      "hydrateCollectionsWithCreators: fallback due to DB error",
      e
    );
    return [];
  }
}

async function getFeaturedCreators(limit: number) {
  try {
    const rows = await db
      .select({
        slug: creators.slug,
        platform: creators.platform,
        displayName: creators.displayName,
        handle: creators.handle,
        url: creators.url,
        avatarUrl: creators.avatarUrl,
        tagline: creators.tagline,
        loveNote: creators.loveNote,
        tags: creators.tags,
        cuisines: creators.cuisines,
        startHere: creators.startHere,
        featuredRank: creators.featuredRank,
        isFeatured: creators.isFeatured,
      })
      .from(creators)
      .where(eq(creators.isFeatured, true))
      .orderBy(
        asc(sql<number>`COALESCE(${creators.featuredRank}, 2147483647)`),
        asc(creators.displayName)
      )
      .limit(limit);

    return rows.map((c) => ({
      slug: c.slug,
      platform: c.platform,
      displayName: c.displayName,
      handle: c.handle,
      url: c.url,
      avatarUrl: c.avatarUrl ?? undefined,
      tagline: c.tagline ?? undefined,
      loveNote: c.loveNote ?? undefined,
      tags: c.tags ?? undefined,
      cuisines: c.cuisines ?? undefined,
      startHere: (c.startHere as any) ?? undefined,
    }));
  } catch (e) {
    console.error("getFeaturedCreators: fallback due to DB error", e);
    return [];
  }
}

/* =========================
   Types & helpers
   ========================= */

type CreatorSpotlight = {
  slug: string;
  platform: "youtube" | "instagram" | "website";
  displayName: string;
  handle: string;
  url: string;
  avatarUrl?: string;
  tagline?: string;
  loveNote?: string;
  tags?: string[];
  cuisines?: string[];
  startHere?: {
    title: string;
    url: string;
    platform: "youtube" | "instagram" | "website";
    note?: string;
    thumbUrl?: string;
  }[];
};

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}
