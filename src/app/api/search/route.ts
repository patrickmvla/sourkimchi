/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { and, or, ilike, eq, sql, desc, asc, type SQL } from "drizzle-orm";

import { db } from "@/db/client";
import { recipes, reviews } from "@/db/schema";
import { creators } from "@/db/creator-schema";

export const revalidate = 0; // always dynamic

// Unified search endpoint
// GET /api/search
// Query params:
// - q: string (search term)
// - type: 'recipes' | 'creators' | 'all' (default: 'all')
// - cuisine: string (optional; recipes filter)
// - platform: 'youtube' | 'instagram' | 'website' (optional; creators filter)
// - limit: number (default 10, max 50)
// - limitPerType: number (optional; when type=all)
// Returns: { items: SearchItem[] }
//
// SearchItem:
// - common: { type, id, slug, title, subtitle?, image?, url }
// - recipe extras: totalTimeSec?, ratingAvg?, ratingCount?
// - creator extras: platform
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const q = cleanStr(searchParams.get("q")); // can be undefined for "trending"
    const type = (searchParams.get("type") || "all") as
      | "recipes"
      | "creators"
      | "all";
    const cuisine = cleanStr(searchParams.get("cuisine"));
    const platform = cleanStr(searchParams.get("platform")) as
      | "youtube"
      | "instagram"
      | "website"
      | undefined;
    const limit = clamp(toInt(searchParams.get("limit")) ?? 10, 1, 50);
    const limitPerType = clamp(
      toInt(searchParams.get("limitPerType")) ?? Math.ceil(limit / 2),
      1,
      50
    );

    if (type === "recipes") {
      const recs = await searchRecipes({ q, cuisine, limit });
      return NextResponse.json({ items: recs }, { status: 200 });
    }
    if (type === "creators") {
      const crs = await searchCreators({ q, platform, limit });
      return NextResponse.json({ items: crs }, { status: 200 });
    }

    // type === 'all'
    const [recs, crs] = await Promise.all([
      searchRecipes({ q, cuisine, limit: limitPerType }),
      searchCreators({ q, platform, limit: limitPerType }),
    ]);
    const items = mergeAlternating(recs, crs, limit);
    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    console.error("GET /api/search error", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

/* =========================
   Recipes search
   ========================= */

async function searchRecipes(args: {
  q?: string;
  cuisine?: string;
  limit: number;
}) {
  const { q, cuisine, limit } = args;
  const qLower = q?.toLowerCase();

  // rating aggregates per recipe
  const ra = db
    .select({
      recipeId: reviews.recipeId,
      ratingAvg: sql<number | null>`avg(${reviews.stars})`,
      ratingCount: sql<number>`count(${reviews.id})`,
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

  const conds: (SQL | undefined)[] = [
    eq(recipes.isPublic, true),
    cuisine ? ilike(recipes.cuisine, `%${cuisine}%`) : undefined,
    qLower
      ? or(
          ilike(recipes.title, `%${qLower}%`),
          ilike(recipes.description, `%${qLower}%`),
          ilike(recipes.cuisine, `%${qLower}%`),
          ilike(recipes.category, `%${qLower}%`)
        )
      : undefined,
  ];

  const base = db
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
    .where(and(...(conds.filter(Boolean) as SQL[])));

  let rows;
  if (qLower) {
    const titleMatch = sql<number>`CASE WHEN lower(${recipes.title}) LIKE ${
      "%" + qLower + "%"
    } THEN 1 ELSE 0 END`;
    rows = await base
      .orderBy(
        desc(titleMatch),
        desc(sql<number>`COALESCE(${ra.ratingAvg}, 0)`),
        desc(sql<number>`COALESCE(${ra.ratingCount}, 0)`),
        desc(recipes.createdAt)
      )
      .limit(limit);
  } else {
    // "Trending": prioritize popular/new
    rows = await base
      .orderBy(
        desc(sql<number>`COALESCE(${ra.ratingCount}, 0)`),
        desc(sql<number>`COALESCE(${ra.ratingAvg}, 0)`),
        desc(recipes.createdAt)
      )
      .limit(limit);
  }

  return rows.map((r) => ({
    type: "recipe" as const,
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: [r.cuisine, r.category].filter(Boolean).join(" • ") || null,
    image: r.image ?? null,
    url: `/recipes/${r.slug}`,
    totalTimeSec: toNum(r.totalTimeSec),
    ratingAvg: toNum(r.ratingAvg),
    ratingCount: toNum(r.ratingCount),
  }));
}

/* =========================
   Creators search
   ========================= */

async function searchCreators(args: {
  q?: string;
  platform?: "youtube" | "instagram" | "website";
  limit: number;
}) {
  const { q, platform, limit } = args;
  const qLower = q?.toLowerCase();

  const conds: (SQL | undefined)[] = [
    platform ? eq(creators.platform, platform) : undefined,
    qLower
      ? or(
          ilike(creators.displayName, `%${qLower}%`),
          ilike(creators.handle, `%${qLower}%`)
        )
      : undefined,
  ];

  const base = db
    .select({
      id: creators.id,
      slug: creators.slug,
      platform: creators.platform,
      displayName: creators.displayName,
      handle: creators.handle,
      url: creators.url,
      avatarUrl: creators.avatarUrl,
      isFeatured: creators.isFeatured,
      featuredRank: creators.featuredRank,
      updatedAt: creators.updatedAt,
    })
    .from(creators)
    .where(and(...(conds.filter(Boolean) as SQL[])));

  let rows;
  if (qLower) {
    const nameMatch = sql<number>`CASE WHEN lower(${
      creators.displayName
    }) LIKE ${"%" + qLower + "%"} THEN 1 ELSE 0 END`;
    const handleMatch = sql<number>`CASE WHEN lower(${creators.handle}) LIKE ${
      "%" + qLower + "%"
    } THEN 1 ELSE 0 END`;
    rows = await base
      .orderBy(
        desc(nameMatch),
        desc(handleMatch),
        desc(creators.isFeatured),
        asc(sql<number>`COALESCE(${creators.featuredRank}, 2147483647)`),
        asc(creators.displayName)
      )
      .limit(limit);
  } else {
    // Featured first when no query
    rows = await base
      .orderBy(
        desc(creators.isFeatured),
        asc(sql<number>`COALESCE(${creators.featuredRank}, 2147483647)`),
        asc(creators.displayName)
      )
      .limit(limit);
  }

  return rows.map((c) => ({
    type: "creator" as const,
    id: c.id,
    slug: c.slug,
    title: c.displayName,
    subtitle: c.handle,
    image: c.avatarUrl ?? null,
    url: `/creators/${c.slug}`,
    platform: c.platform,
  }));
}

/* =========================
   Helpers
   ========================= */

function mergeAlternating<A, B>(a: A[], b: B[], max: number): (A | B)[] {
  const items: (A | B)[] = [];
  let i = 0;
  let j = 0;
  while (items.length < max && (i < a.length || j < b.length)) {
    if (i < a.length) items.push(a[i++]);
    if (items.length >= max) break;
    if (j < b.length) items.push(b[j++]);
  }
  return items.slice(0, max);
}

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

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}
