/* eslint-disable @typescript-eslint/no-explicit-any */

// Seed curated creator collections (e.g., "Heritage cooking") for SourKimchi.
// Usage:
//   pnpm tsx scripts/seed-creator-collections.ts
//   pnpm tsx scripts/seed-creator-collections.ts path/to/creator-collections.json
//
// JSON shape (example):
// [
//   {
//     "slug": "heritage-cooking",
//     "title": "Heritage cooking",
//     "description": "Open-fire, heirloom techniques, and timeless recipes.",
//     "coverImageUrl": "https://.../cover.jpg",
//     "isFeatured": true,
//     "items": [
//       { "creatorSlug": "youtube-townsends" },
//       { "platform": "youtube", "handle": "@PastaGrannies" },
//       { "platform": "instagram", "handle": "@thekoreanvegan" },
//       { "displayName": "Bon Appétit" }
//     ]
//   }
// ]

import "dotenv/config";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";

import { db } from "../../src/db/client";
import {
  collectionCreators,
  creatorCollections,
} from "../../src/db/creator-schema";
import { cuid } from "../lib/ids";
import { slugify } from "../lib/slugify";

type Platform = "youtube" | "instagram" | "website";

type CollectionItemSeed = {
  creatorSlug?: string;
  platform?: Platform;
  handle?: string; // e.g., "@JasTownsends", "@BonAppetitDotCom"
  displayName?: string; // e.g., "Townsends", "Bon Appétit"
  position?: number; // optional explicit ordering
};

type CollectionSeed = {
  slug?: string;
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  isFeatured?: boolean;
  items: CollectionItemSeed[];
};

function normalizePlatform(p?: string | null): Platform | undefined {
  if (!p) return undefined;
  const v = p.toLowerCase();
  if (v === "youtube" || v === "instagram" || v === "website") return v;
  return undefined;
}

async function uniqueCollectionSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let i = 2;

  while (
    await db.query.creatorCollections.findFirst({
      where: (t, { eq }) => eq(t.slug, slug),
    })
  ) {
    slug = slugify(`${base}-${i++}`);
  }
  return slug;
}

async function findCreatorId(item: CollectionItemSeed): Promise<string | null> {
  // Priority: creatorSlug -> (platform+handle) -> handle -> displayName
  if (item.creatorSlug) {
    const row = await db.query.creators.findFirst({
      where: (t, { eq }) => eq(t.slug, item.creatorSlug!),
      columns: { id: true, slug: true },
    });
    if (row?.id) return row.id;
  }

  const platform = normalizePlatform(item.platform ?? undefined);

  if (platform && item.handle) {
    const row = await db.query.creators.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.platform, platform), eq(t.handle, item.handle!)),
      columns: { id: true },
    });
    if (row?.id) return row.id;
  }

  if (item.handle) {
    // Fallback: any platform with matching handle

    const row = await db.query.creators.findFirst({
      where: (t, { eq }) => eq(t.handle, item.handle!),
      columns: { id: true },
    });
    if (row?.id) return row.id;
  }

  if (item.displayName) {
    const row = await db.query.creators.findFirst({
      where: (t, { eq }) => eq(t.displayName, item.displayName!),
      columns: { id: true },
    });
    if (row?.id) return row.id;
  }

  return null;
}

async function upsertCollection(seed: CollectionSeed) {
  const baseSlug = seed.slug ? slugify(seed.slug) : slugify(seed.title);
  // Try to find existing by slug

  const existing = await db.query.creatorCollections.findFirst({
    where: (t, { eq }) => eq(t.slug, baseSlug),
  });

  let collectionId: string;
  let slug = baseSlug;

  if (existing) {
    collectionId = existing.id;
    // Update metadata (do not overwrite with nulls unless explicitly provided)
    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };
    if (seed.title && seed.title !== existing.title) updates.title = seed.title;
    if (seed.description != null) updates.description = seed.description;
    if (seed.coverImageUrl != null) updates.coverImageUrl = seed.coverImageUrl;
    if (typeof seed.isFeatured === "boolean")
      updates.isFeatured = seed.isFeatured;

    if (Object.keys(updates).length > 1) {
      await db
        .update(creatorCollections)
        .set(updates)
        .where(eq(creatorCollections.id, collectionId));
    }
    console.log(`Updating collection: ${existing.title} (${existing.slug})`);
  } else {
    // Create new with unique slug
    slug = await uniqueCollectionSlug(baseSlug);
    collectionId = cuid();
    await db.insert(creatorCollections).values({
      id: collectionId,
      slug,
      title: seed.title,
      description: seed.description ?? null,
      coverImageUrl: seed.coverImageUrl ?? null,
      isFeatured: seed.isFeatured ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Created collection: ${seed.title} (${slug})`);
  }

  // Replace collection items with provided list (idempotent rebuild)
  await db
    .delete(collectionCreators)
    .where(eq(collectionCreators.collectionId, collectionId));

  // Resolve creators and insert
  let positionCounter = 1;
  for (const raw of seed.items ?? []) {
    try {
      const creatorId = await findCreatorId(raw);
      if (!creatorId) {
        console.warn(
          `  ⚠️  Skipping item: could not resolve creator (${JSON.stringify(
            raw
          )})`
        );
        continue;
      }
      const position = raw.position ?? positionCounter++;
      await db.insert(collectionCreators).values({
        collectionId,
        creatorId,
        position,
      });
    } catch (e: any) {
      console.warn(`  ⚠️  Failed to add item to ${slug}:`, e?.message || e);
    }
  }

  console.log(`  → Items set (${seed.items?.length ?? 0}) for ${slug}`);
}

async function main() {
  const file =
    process.argv[2] || path.resolve("scripts/seeds/creator-collections.json");
  const abs = path.resolve(file);
  console.log(`Seeding creator collections from: ${abs}`);

  const raw = await fs.readFile(abs, "utf8");
  const list = JSON.parse(raw) as CollectionSeed[];

  if (!Array.isArray(list) || list.length === 0) {
    console.warn("No collections found in seed file.");
    return;
  }

  // Ensure we have creators table accessible (quick sanity)

  const anyCreator = await db.query.creators.findFirst({
    columns: { id: true },
  });
  if (!anyCreator) {
    console.warn(
      "⚠️  No creators found. Seed creators first: pnpm tsx scripts/seed-creators.ts"
    );
  }

  for (const col of list) {
    try {
      await upsertCollection(col);
    } catch (e: any) {
      console.error(`❌ Failed collection "${col.title}":`, e?.message || e);
    }
  }

  console.log("✅ Finished seeding creator collections.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
