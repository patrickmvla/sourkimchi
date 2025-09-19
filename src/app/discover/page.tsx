/* eslint-disable @typescript-eslint/no-explicit-any */
// app/discover/page.tsx
import Link from "next/link";
import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  creators,
  creatorCollections,
  collectionCreators,
} from "@/db/creator-schema";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CreatorCollectionSection from "@/components/discover/CreatorCollectionSection";
import CreatorSpotlightCard from "@/components/discover/CreatorSpotlightCard";

export const revalidate = 120;

export default async function DiscoverPage() {
  const [collections, ytSpotlights, igSpotlights] = await Promise.all([
    getFeaturedCollections(4),
    getSpotlightCreators("youtube", 6),
    getSpotlightCreators("instagram", 6),
  ]);

  const collectionsWithCreators = await hydrateCollectionsWithCreators(
    collections
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="mb-8 rounded-2xl border bg-gradient-to-br from-amber-50 to-white p-6 sm:p-10">
        <Badge variant="secondary" className="mb-3">
          Discover
        </Badge>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          The best cooking creators, in one place.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Hand‑picked YouTube channels and Instagram accounts to help you fall
          in love with cooking.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/discover/youtube">
            <Button size="lg">Explore YouTube</Button>
          </Link>
          <Link href="/discover/instagram">
            <Button size="lg" variant="outline">
              Explore Instagram
            </Button>
          </Link>
        </div>
      </section>

      {/* Featured collections */}
      {collectionsWithCreators.length > 0 && (
        <section className="space-y-8">
          {collectionsWithCreators.map((col) => (
            <CreatorCollectionSection
              key={col.slug}
              title={col.title}
              description={col.description ?? undefined}
              items={col.creators}
              href="/discover"
              columns={3}
            />
          ))}
        </section>
      )}

      {/* Platform spotlights */}
      <section className="mt-10 grid gap-10 lg:grid-cols-2">
        {/* YouTube */}
        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-xl font-semibold">YouTube spotlights</h2>
            <Link href="/discover/youtube">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </div>
          {ytSpotlights.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {ytSpotlights.map((c) => (
                <CreatorSpotlightCard key={c.slug} c={c} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
              No featured YouTube channels yet.
            </div>
          )}
        </div>

        {/* Instagram */}
        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-xl font-semibold">Instagram spotlights</h2>
            <Link href="/discover/instagram">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </div>
          {igSpotlights.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {igSpotlights.map((c) => (
                <CreatorSpotlightCard key={c.slug} c={c} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
              No featured Instagram accounts yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/* =========================
   Data loaders
   ========================= */

async function getFeaturedCollections(limit: number) {
  return db
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
}

async function hydrateCollectionsWithCreators(
  cols: Awaited<ReturnType<typeof getFeaturedCollections>>
) {
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
}

async function getSpotlightCreators(
  platform: "youtube" | "instagram",
  limit: number
) {
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
    .where(eq(creators.platform, platform))
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
  })) as CreatorSpotlight[];
}

/* =========================
   Types
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
