/* eslint-disable @typescript-eslint/no-explicit-any */

import { and, asc, desc, eq, ilike, inArray, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import {
  collectionCreators,
  creatorCollections,
  creators,
} from "@/db/creator-schema";

export const revalidate = 0; // dynamic

// GET /api/creator-collections
// Query params (all optional):
// - featured: '1' | 'true'           -> only featured collections
// - q: string                        -> search title/description (ILIKE)
// - include: 'items'                 -> include creators for each collection
// - limit: number                    -> default 12, max 50
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const featured = parseBool(searchParams.get("featured"));
    const q = cleanStr(searchParams.get("q"));
    const includeItems =
      (searchParams.get("include") || "").toLowerCase() === "items";
    const limit = clamp(toInt(searchParams.get("limit")) ?? 12, 1, 50);

    const conds: (SQL | undefined)[] = [
      featured ? eq(creatorCollections.isFeatured, true) : undefined,
      q ? ilike(creatorCollections.title, `%${q}%`) : undefined,
      // If you also want to search description:
      q ? ilike(creatorCollections.description, `%${q}%`) : undefined,
    ];

    // Base list query
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
      .where(and(...(conds.filter(Boolean) as SQL[])))
      .orderBy(
        desc(creatorCollections.isFeatured),
        asc(creatorCollections.title)
      )
      .limit(limit);

    if (!includeItems || rows.length === 0) {
      const collections = rows.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description ?? null,
        coverImageUrl: c.coverImageUrl ?? null,
        isFeatured: !!c.isFeatured,
        updatedAt: toIso(c.updatedAt),
      }));
      return NextResponse.json(collections, { status: 200 });
    }

    // If include=items, fetch all creators for these collections and group them.
    const ids = rows.map((r) => r.id);
    const itemRows = await db
      .select({
        collectionId: collectionCreators.collectionId,
        position: collectionCreators.position,
        id: creators.id,
        slug: creators.slug,
        platform: creators.platform,
        displayName: creators.displayName,
        handle: creators.handle,
        url: creators.url,
        avatarUrl: creators.avatarUrl,
        tags: creators.tags,
        cuisines: creators.cuisines,
        latestThumbUrl: creators.latestThumbUrl,
        latestTitle: creators.latestTitle,
        latestPublishedAt: creators.latestPublishedAt,
      })
      .from(collectionCreators)
      .innerJoin(creators, eq(collectionCreators.creatorId, creators.id))
      .where(inArray(collectionCreators.collectionId, ids))
      .orderBy(asc(collectionCreators.position));

    const grouped = new Map<
      string,
      {
        position: number;
        id: string;
        slug: string;
        platform: "youtube" | "instagram" | "website";
        displayName: string;
        handle: string;
        url: string;
        avatarUrl: string | null;
        tags: string[] | null;
        cuisines: string[] | null;
        latestThumbUrl: string | null;
        latestTitle: string | null;
        latestPublishedAt: string | null;
      }[]
    >();

    for (const it of itemRows) {
      const arr = grouped.get(it.collectionId) ?? [];
      arr.push({
        position: it.position,
        id: it.id,
        slug: it.slug,
        platform: it.platform,
        displayName: it.displayName,
        handle: it.handle,
        url: it.url,
        avatarUrl: it.avatarUrl ?? null,
        tags: it.tags ?? [],
        cuisines: it.cuisines ?? [],
        latestThumbUrl: it.latestThumbUrl ?? null,
        latestTitle: it.latestTitle ?? null,
        latestPublishedAt: toIso(it.latestPublishedAt),
      });
      grouped.set(it.collectionId, arr);
    }

    const collectionsWithItems = rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description ?? null,
      coverImageUrl: c.coverImageUrl ?? null,
      isFeatured: !!c.isFeatured,
      updatedAt: toIso(c.updatedAt),
      creators: (grouped.get(c.id) ?? []).sort(
        (a, b) => a.position - b.position
      ),
    }));

    return NextResponse.json(collectionsWithItems, { status: 200 });
  } catch (e: any) {
    console.error("GET /api/creator-collections error", e);
    return NextResponse.json(
      { error: "Failed to load creator collections" },
      { status: 500 }
    );
  }
}

/* =========================
   Helpers
   ========================= */

function cleanStr(v: string | null): string | undefined {
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

function toInt(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseBool(v: string | null): boolean {
  const s = (v ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function toIso(d: unknown): string | null {
  if (d == null) return null;
  try {
    if (d instanceof Date) return d.toISOString();
    if (typeof d === "string") return d; // already ISO from driver
    const iso = new Date(String(d)).toISOString();
    return iso || null;
  } catch {
    return null;
  }
}
