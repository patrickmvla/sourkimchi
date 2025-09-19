/* eslint-disable @typescript-eslint/no-explicit-any */
// Seed curated creators (YouTube / Instagram / Website) into SourKimchi.
// Usage:
//   pnpm tsx scripts/seed-creators.ts                 # seeds from scripts/seeds/creators-curated.json
//   pnpm tsx scripts/seed-creators.ts path/to.json    # custom seed file
//
// JSON shape (example):
// [
//   {
//     "platform": "youtube",
//     "displayName": "Townsends",
//     "handle": "@JasTownsends",
//     "url": "https://www.youtube.com/@JasTownsends",
//     "avatarUrl": "https://.../avatar.jpg",
//     "tagline": "18th‑century foodways, wood smoke, and gentle vibes.",
//     "loveNote": "Perfect slow Sundays...",
//     "tags": ["heritage","history","comfort"],
//     "cuisines": ["early american"],
//     "startHere": [
//       { "title": "18th Century Bread", "url": "https://www.youtube.com/watch?v=VIDEOID", "platform": "youtube" }
//     ],
//     "isFeatured": true,
//     "featuredRank": 1
//   }
// ]
import "dotenv/config";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/db/client";
import { creators } from "../../src/db/creator-schema";
import { cuid } from "../lib/ids";
import { slugify } from "../lib/slugify";
import {
  channelIdFromString,
  videoIdFromUrl,
  thumbUrl as ytThumbUrl,
} from "../lib/yt";

type Platform = "youtube" | "instagram" | "website";

type StartHereItem = {
  title: string;
  url: string;
  platform: Platform;
  note?: string;
  thumbUrl?: string;
  videoId?: string;
};

type CreatorSeed = {
  platform: Platform;
  displayName: string;
  handle: string; // e.g., "@JasTownsends"
  url: string;
  externalId?: string | null; // e.g., YouTube channelId ("UC...")
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  tagline?: string | null;
  loveNote?: string | null;
  tags?: string[];
  cuisines?: string[];
  country?: string | null; // ISO2
  language?: string | null; // e.g., "en", "en-US"
  startHere?: StartHereItem[];
  links?: {
    label?: string;
    kind?: "website" | "shop" | "patreon" | "newsletter" | "course";
    url: string;
  }[];
  isFeatured?: boolean;
  featuredRank?: number | null;
};

// Ensure thumb/videoId for YouTube "Start here" picks if missing
function enrichStartHere(
  items: StartHereItem[] | undefined
): StartHereItem[] | undefined {
  if (!items || !items.length) return items;
  return items.map((it) => {
    if (it.platform !== "youtube") return it;
    const vid = it.videoId || videoIdFromUrl(it.url) || undefined;
    const thumbUrl = it.thumbUrl || (vid ? ytThumbUrl(vid, "hq") : undefined);
    return { ...it, videoId: vid, thumbUrl };
  });
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let i = 2;

  while (
    await db.query.creators.findFirst({
      where: (t, { eq }) => eq(t.slug, slug),
    })
  ) {
    slug = slugify(`${base}-${i++}`);
  }
  return slug;
}

function normalizePlatform(p: string): Platform {
  const v = p.toLowerCase();
  if (v === "youtube" || v === "instagram" || v === "website") return v;
  throw new Error(`Invalid platform: ${p}`);
}

async function upsertCreator(seed: CreatorSeed) {
  const platform = normalizePlatform(seed.platform);
  const handle = seed.handle.trim();
  const displayName = seed.displayName.trim();
  const url = seed.url.trim();

  // Try to derive externalId for YouTube from the URL if not provided
  let externalId = seed.externalId ?? null;
  if (platform === "youtube" && !externalId) {
    externalId = channelIdFromString(url);
  }

  // Check if creator exists by (platform, handle)

  const existing = await db.query.creators.findFirst({
    where: (t, { and, eq }) =>
      and(eq(t.platform, platform), eq(t.handle, handle)),
  });

  const startHere = enrichStartHere(seed.startHere);

  if (existing) {
    const updates: Record<string, any> = {
      // keep slug stable on update
      url,
      // only overwrite if provided (avoid blanking good data)
      updatedAt: new Date(),
    };
    if (seed.avatarUrl) updates.avatarUrl = seed.avatarUrl;
    if (seed.bannerUrl) updates.bannerUrl = seed.bannerUrl;
    if (externalId) updates.externalId = externalId;

    if (seed.tagline != null) updates.tagline = seed.tagline;
    if (seed.loveNote != null) updates.loveNote = seed.loveNote;
    if (seed.tags) updates.tags = seed.tags;
    if (seed.cuisines) updates.cuisines = seed.cuisines;
    if (seed.country != null) updates.country = seed.country;
    if (seed.language != null) updates.language = seed.language;
    if (startHere) updates.startHere = startHere;
    if (seed.links) updates.links = seed.links;
    if (typeof seed.isFeatured === "boolean")
      updates.isFeatured = seed.isFeatured;
    if (seed.featuredRank != null) updates.featuredRank = seed.featuredRank;

    await db.update(creators).set(updates).where(eq(creators.id, existing.id));
    console.log(`Updated creator: ${displayName} (${platform})`);
    return existing.id;
  }

  // New record
  const id = cuid();
  const slug = await uniqueSlug(`${platform}-${displayName || handle}`);

  await db.insert(creators).values({
    id,
    slug,
    platform,
    handle,
    displayName,
    url,
    externalId,
    avatarUrl: seed.avatarUrl ?? null,
    bannerUrl: seed.bannerUrl ?? null,
    tagline: seed.tagline ?? null,
    loveNote: seed.loveNote ?? null,
    tags: seed.tags ?? [],
    cuisines: seed.cuisines ?? [],
    country: seed.country ?? null,
    language: seed.language ?? null,
    startHere: startHere ?? [],
    links: seed.links ?? [],
    isFeatured: seed.isFeatured ?? true, // curated seeds default to featured
    featuredRank: seed.featuredRank ?? null,
    latestEmbedUrl: null,
    latestThumbUrl: null,
    latestTitle: null,
    latestPublishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Inserted creator: ${displayName} (${platform})`);
  return id;
}

async function main() {
  const file =
    process.argv[2] || path.resolve("scripts/seeds/creators-curated.json");
  const abs = path.resolve(file);
  console.log(`Seeding creators from: ${abs}`);
  const raw = await fs.readFile(abs, "utf8");
  const list = JSON.parse(raw) as CreatorSeed[];

  if (!Array.isArray(list) || list.length === 0) {
    console.warn("No creators found in seed file.");
    return;
  }

  for (const item of list) {
    try {
      await upsertCreator(item);
    } catch (e: any) {
      console.error(
        `❌ Failed to upsert ${item.displayName} (${item.platform}):`,
        e?.message || e
      );
    }
  }

  console.log("✅ Finished seeding creators.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
