// app/admin/page.tsx
import Link from 'next/link';
import { desc, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { recipes, reviews, tags } from '@/db/schema';
import { creators, creatorCollections } from '@/db/creator-schema';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const [
    counts,
    latestRecs,
    latestCrs,
    emptyImageCount,
  ] = await Promise.all([
    getCounts(),
    getLatestRecipes(6),
    getLatestCreators(6),
    getMissingHeroImagesCount(),
  ]);

  return (
    <main className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="secondary" className="mb-2">Dashboard</Badge>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick stats and recently updated content.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/creators"><Button variant="outline">Manage creators</Button></Link>
          <Link href="/admin/collections"><Button variant="outline">Manage collections</Button></Link>
          <Link href="/admin/recipes"><Button>Manage recipes</Button></Link>
        </div>
      </div>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Recipes" value={counts.recipes} />
        <StatCard label="Creators" value={counts.creators} />
        <StatCard label="Collections" value={counts.collections} />
        <StatCard label="Tags" value={counts.tags} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {/* Latest recipes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest recipes</CardTitle>
          </CardHeader>
          <CardContent>
            {latestRecs.length ? (
              <ul className="divide-y">
                {latestRecs.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        <Link href={`/recipes/${r.slug}`} className="hover:underline">
                          {r.title}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(r.createdAt)}
                        {r.cuisine ? <span> • {r.cuisine}</span> : null}
                      </div>
                    </div>
                    <Link href={`/admin/recipes`} className="text-xs text-muted-foreground hover:underline">
                      Manage
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState small message="No recipes yet." />
            )}
            {emptyImageCount > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                Heads up: {emptyImageCount} recipe(s) missing a hero image.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latest creators */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently updated creators</CardTitle>
          </CardHeader>
          <CardContent>
            {latestCrs.length ? (
              <ul className="divide-y">
                {latestCrs.map((c) => (
                  <li key={c.slug} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        <Link href={`/creators/${c.slug}`} className="hover:underline">
                          {c.displayName}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.platform} • {formatDate(c.updatedAt)}
                      </div>
                    </div>
                    <Link href="/admin/creators" className="text-xs text-muted-foreground hover:underline">
                      Manage
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState small message="No creators yet." />
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

/* =========================
   Data
   ========================= */

async function getCounts() {
  const [rec, crt, col, tgs] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(recipes),
    db.select({ c: sql<number>`count(*)` }).from(creators),
    db.select({ c: sql<number>`count(*)` }).from(creatorCollections),
    db.select({ c: sql<number>`count(*)` }).from(tags),
  ]);

  return {
    recipes: toNum(rec[0]?.c) ?? 0,
    creators: toNum(crt[0]?.c) ?? 0,
    collections: toNum(col[0]?.c) ?? 0,
    tags: toNum(tgs[0]?.c) ?? 0,
  };
}

async function getLatestRecipes(limit: number) {
  const rows = await db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      title: recipes.title,
      cuisine: recipes.cuisine,
      createdAt: recipes.createdAt,
    })
    .from(recipes)
    .orderBy(desc(recipes.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    cuisine: r.cuisine ?? null,
    createdAt: r.createdAt,
  }));
}

async function getLatestCreators(limit: number) {
  const rows = await db
    .select({
      slug: creators.slug,
      displayName: creators.displayName,
      platform: creators.platform,
      updatedAt: creators.updatedAt,
    })
    .from(creators)
    .orderBy(desc(creators.updatedAt))
    .limit(limit);

  return rows.map((c) => ({
    slug: c.slug,
    displayName: c.displayName,
    platform: c.platform,
    updatedAt: c.updatedAt,
  }));
}

async function getMissingHeroImagesCount() {
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(recipes)
    .where(sql`${recipes.heroImageUrl} IS NULL OR ${recipes.heroImageUrl} = ''`);
  return toNum(rows[0]?.c) ?? 0;
}

/* =========================
   UI helpers
   ========================= */

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message, small }: { message: string; small?: boolean }) {
  return (
    <div className={`rounded-lg border ${small ? 'p-4 text-xs' : 'p-6 text-sm'} text-muted-foreground`}>
      {message}
    </div>
  );
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return '';
  try {
    const dt = typeof d === 'string' ? new Date(d) : d;
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(dt);
  } catch {
    return '';
  }
}