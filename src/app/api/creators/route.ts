/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, or, sql, desc, asc, type SQL } from "drizzle-orm";

import { db } from "@/db/client";
import { creators } from "@/db/creator-schema";

export const revalidate = 0; // always dynamic

// GET /api/creators
// Query params (all optional):
// - platform: 'youtube' | 'instagram' | 'website'
// - tag: string            // single tag; server matches array contains
// - cuisine: string        // single cuisine; array contains
// - q: string              // search displayName/handle
// - limit: number          // default 40, max 100
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const platform = cleanStr(searchParams.get("platform")) as
      | "youtube"
      | "instagram"
      | "website"
      | undefined;
    const tag = cleanStr(searchParams.get("tag"));
    const cuisine = cleanStr(searchParams.get("cuisine"));
    const q = cleanStr(searchParams.get("q"));
    const limit = clamp(toInt(searchParams.get("limit")) ?? 40, 1, 100);

    const conds: (SQL | undefined)[] = [
      platform ? eq(creators.platform, platform) : undefined,
      tag ? sql`${creators.tags} @> ARRAY[${tag}]::text[]` : undefined,
      cuisine
        ? sql`${creators.cuisines} @> ARRAY[${cuisine}]::text[]`
        : undefined,
      q
        ? or(
            ilike(creators.displayName, `%${q}%`),
            ilike(creators.handle, `%${q}%`)
          )
        : undefined,
    ];

    // Build base query
    const baseQuery = db
      .select({
        id: creators.id,
        slug: creators.slug,
        platform: creators.platform,
        displayName: creators.displayName,
        handle: creators.handle,
        url: creators.url,
        avatarUrl: creators.avatarUrl,
        tags: creators.tags,
        cuisines: creators.cuisines,
        latestEmbedUrl: creators.latestEmbedUrl,
        latestThumbUrl: creators.latestThumbUrl,
        latestTitle: creators.latestTitle,
        latestPublishedAt: creators.latestPublishedAt,
        featuredRank: creators.featuredRank,
        isFeatured: creators.isFeatured,
        updatedAt: creators.updatedAt,
      })
      .from(creators)
      .where(and(...(conds.filter(Boolean) as SQL[])));

    // Sorting: featured first, then featuredRank asc (nulls last), then name
    const rows = await baseQuery
      .orderBy(
        desc(creators.isFeatured),
        asc(sql<number>`COALESCE(${creators.featuredRank}, 2147483647)`),
        asc(creators.displayName)
      )
      .limit(limit);

    const items = rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      platform: c.platform,
      displayName: c.displayName,
      handle: c.handle,
      url: c.url,
      avatarUrl: c.avatarUrl ?? null,
      tags: c.tags ?? [],
      cuisines: c.cuisines ?? [],
      latestEmbedUrl: c.latestEmbedUrl ?? null,
      latestThumbUrl: c.latestThumbUrl ?? null,
      latestTitle: c.latestTitle ?? null,
      latestPublishedAt: toIso(c.latestPublishedAt),
      featuredRank: c.featuredRank ?? null,
    }));

    return NextResponse.json(items, { status: 200 });
  } catch (e: any) {
    console.error("GET /api/creators error", e);
    return NextResponse.json(
      { error: "Failed to load creators" },
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

function toIso(d: unknown): string | null {
  if (d == null) return null;
  try {
    if (d instanceof Date) return d.toISOString();
    if (typeof d === "string") return d; // already ISO from driver
    // Drizzle/neon should give Date, but safe fallback:
    const iso = new Date(String(d)).toISOString();
    return iso || null;
  } catch {
    return null;
  }
}
