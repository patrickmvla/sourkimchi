/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/recipes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { and, or, eq, ilike, sql, desc, asc, type SQL } from 'drizzle-orm';

import { db } from '@/db/client';
import { recipes, reviews, recipeTags, tags } from '@/db/schema';
import { slugify } from '@/lib/slugify';

export const revalidate = 0; // dynamic

// GET /api/recipes
// Query params:
// - q: string
// - tag: string (repeatable) -> ALL-of semantics
// - cuisine: string
// - timeMax: number (seconds)
// - sort: 'new' | 'popular' | 'rating' | 'time'
// - page: number (1-based)
// - limit: number (default 24, max 100)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const q = cleanStr(searchParams.get('q'));
    const cuisine = cleanStr(searchParams.get('cuisine'));
    const tagsIn = searchParams.getAll('tag').map((t) => cleanStr(t)).filter(Boolean) as string[];
    const timeMax = toInt(searchParams.get('timeMax'));
    const sort = (searchParams.get('sort') || 'new') as 'new' | 'popular' | 'rating' | 'time';

    const page = Math.max(1, toInt(searchParams.get('page')) ?? 1);
    const limit = clamp(toInt(searchParams.get('limit')) ?? 24, 1, 100);
    const offset = (page - 1) * limit;

    // Subquery: aggregate ratings per recipe (alias raw fields!)
    const ra = db
      .select({
        recipeId: reviews.recipeId,
        ratingAvg: sql<number | null>`avg(${reviews.stars})`.as('rating_avg'),
        ratingCount: sql<number>`count(${reviews.id})`.as('rating_count'),
      })
      .from(reviews)
      .groupBy(reviews.recipeId)
      .as('ra');

    // total time expression (fallback to sum of parts)
    const totalTimeExpr = sql<number>`
      COALESCE(
        ${recipes.totalTimeSec},
        COALESCE(${recipes.prepTimeSec}, 0) + COALESCE(${recipes.cookTimeSec}, 0) + COALESCE(${recipes.restTimeSec}, 0)
      )
    `;

    // WHERE conditions
    const conds: (SQL | undefined)[] = [
      eq(recipes.isPublic, true),
      q
        ? or(
            ilike(recipes.title, `%${q}%`),
            ilike(recipes.description, `%${q}%`),
            ilike(recipes.cuisine, `%${q}%`),
            ilike(recipes.category, `%${q}%`)
          )
        : undefined,
      cuisine ? ilike(recipes.cuisine, `%${cuisine}%`) : undefined,
      isFiniteNumber(timeMax) ? sql`${totalTimeExpr} <= ${timeMax}` : undefined,
      ...tagsIn.map((t) => existsTagCondition(t)),
    ];

    // Base query (no sorting/pagination yet)
    const baseQuery = db
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
      })
      .from(recipes)
      .leftJoin(ra, eq(ra.recipeId, recipes.id))
      .where(and(...(conds.filter(Boolean) as SQL[])));

    // Apply sorting + pagination in one chain to keep Drizzle types happy
    let rows;
    if (sort === 'popular') {
      rows = await baseQuery
        .orderBy(
          desc(sql<number>`COALESCE(${ra.ratingCount}, 0)`),
          desc(sql<number>`COALESCE(${ra.ratingAvg}, 0)`),
          desc(recipes.createdAt)
        )
        .limit(limit)
        .offset(offset);
    } else if (sort === 'rating') {
      rows = await baseQuery
        .orderBy(
          desc(sql<number>`COALESCE(${ra.ratingAvg}, 0)`),
          desc(sql<number>`COALESCE(${ra.ratingCount}, 0)`),
          desc(recipes.createdAt)
        )
        .limit(limit)
        .offset(offset);
    } else if (sort === 'time') {
      rows = await baseQuery
        .orderBy(
          asc(sql<number>`COALESCE(${totalTimeExpr}, 2147483647)`),
          asc(recipes.title)
        )
        .limit(limit)
        .offset(offset);
    } else {
      // 'new'
      rows = await baseQuery.orderBy(desc(recipes.createdAt)).limit(limit).offset(offset);
    }

    const items = rows.map((r) => ({
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

    return NextResponse.json(items, { status: 200 });
  } catch (e: any) {
    console.error('GET /api/recipes error', e);
    return NextResponse.json({ error: 'Failed to load recipes' }, { status: 500 });
  }
}

/* =========================
   Helpers
   ========================= */

function existsTagCondition(tag: string): SQL {
  const slug = slugify(tag);
  const nameLower = tag.toLowerCase();
  return sql`
    EXISTS (
      SELECT 1
      FROM ${recipeTags} rt
      JOIN ${tags} t ON t.id = rt.tag_id
      WHERE rt.recipe_id = ${recipes.id}
        AND (t.slug = ${slug} OR lower(t.name) = ${nameLower})
    )
  `;
}

function cleanStr(v: string | null): string | undefined {
  const s = (v ?? '').trim();
  return s ? s : undefined;
}

function toInt(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}