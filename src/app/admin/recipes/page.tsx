// app/admin/recipes/page.tsx
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Link from "next/link";

import { db } from "@/db/client";
import { recipes, reviews } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const revalidate = 0;

type SearchParams = {
  q?: string;
  public?: "1" | "0" | "";
  missingImage?: "1" | "";
  sort?: "new" | "updated" | "title" | "rating" | "time";
  page?: string;
  limit?: string;
};

export default async function AdminRecipesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  const q = (searchParams.q ?? "").trim();
  const publicFilter = (searchParams.public ?? "") as "1" | "0" | "";
  const missingImage = (searchParams.missingImage ?? "") === "1";
  const sort = (searchParams.sort ?? "updated") as NonNullable<
    SearchParams["sort"]
  >;
  const limit = clamp(parseIntSafe(searchParams.limit, 24), 1, 100);
  const page = clamp(parseIntSafe(searchParams.page, 1), 1, 9999);
  const offset = (page - 1) * limit;

  // Subquery: rating aggregates (alias raw fields)
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

  const qLower = q.toLowerCase();
  const conds: (SQL | undefined)[] = [
    q
      ? or(
          ilike(recipes.title, `%${qLower}%`),
          ilike(recipes.description, `%${qLower}%`),
          ilike(recipes.cuisine, `%${qLower}%`),
          ilike(recipes.category, `%${qLower}%`)
        )
      : undefined,
    publicFilter === "1" ? eq(recipes.isPublic, true) : undefined,
    publicFilter === "0" ? eq(recipes.isPublic, false) : undefined,
    missingImage
      ? sql`${recipes.heroImageUrl} IS NULL OR ${recipes.heroImageUrl} = ''`
      : undefined,
  ];
  const where = and(...(conds.filter(Boolean) as SQL[]));

  // Total count (for pagination)
  const totalRow = await db
    .select({ c: sql<number>`count(*)` })
    .from(recipes)
    .where(where);
  const total = toNum(totalRow[0]?.c) ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Sorting
  const orderBy =
    sort === "new"
      ? [desc(recipes.createdAt)]
      : sort === "title"
      ? [asc(recipes.title)]
      : sort === "rating"
      ? [
          desc(sql<number>`COALESCE(${ra.ratingAvg}, 0)`),
          desc(sql<number>`COALESCE(${ra.ratingCount}, 0)`),
          desc(recipes.createdAt),
        ]
      : sort === "time"
      ? [
          asc(sql<number>`COALESCE(${totalTimeExpr}, 2147483647)`),
          asc(recipes.title),
        ]
      : // 'updated' (default)
        [desc(recipes.updatedAt)];

  // Rows
  const rows = await db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      title: recipes.title,
      cuisine: recipes.cuisine,
      category: recipes.category,
      image: recipes.heroImageUrl,
      isPublic: recipes.isPublic,
      createdAt: recipes.createdAt,
      updatedAt: recipes.updatedAt,
      totalTimeSec: totalTimeExpr,
      ratingAvg: ra.ratingAvg,
      ratingCount: ra.ratingCount,
    })
    .from(recipes)
    .leftJoin(ra, eq(ra.recipeId, recipes.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  return (
    <main className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Recipes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage structured recipes. Search, filter, and update status.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-12"
            action="/admin/recipes"
            method="get"
          >
            <div className="md:col-span-5">
              <label
                htmlFor="q"
                className="mb-1 block text-xs text-muted-foreground"
              >
                Search
              </label>
              <Input
                id="q"
                name="q"
                placeholder="Title, cuisine, category…"
                defaultValue={q}
              />
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-xs text-muted-foreground">
                Visibility
              </label>
              <Select name="public" defaultValue={publicFilter || ""}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="1">Public</SelectItem>
                  <SelectItem value="0">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">
                Sort
              </label>
              <Select name="sort" defaultValue={sort}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Recently updated</SelectItem>
                  <SelectItem value="new">Newest</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="rating">Top rated</SelectItem>
                  <SelectItem value="time">Shortest time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">
                Limit
              </label>
              <Input
                name="limit"
                type="number"
                min={1}
                max={100}
                defaultValue={String(limit)}
              />
            </div>

            <div className="md:col-span-12 flex items-center justify-between gap-2 pt-1">
              <label className="text-sm">
                <input
                  type="checkbox"
                  name="missingImage"
                  defaultChecked={missingImage}
                  className="mr-2 align-middle"
                />
                Missing hero image
              </label>
              <div className="flex items-center gap-2">
                <Button type="submit">Apply</Button>
                <Link
                  href="/admin/recipes"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Reset
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {total} result{total === 1 ? "" : "s"} • Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <PageButton
            href={
              page > 1
                ? buildPageHref({ searchParams, page: page - 1 })
                : undefined
            }
            label="Prev"
          />
          <PageButton
            href={
              page < totalPages
                ? buildPageHref({ searchParams, page: page + 1 })
                : undefined
            }
            label="Next"
          />
        </div>
      </div>

      {/* Grid */}
      {rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <RecipeAdminCard key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          No recipes found.
        </div>
      )}

      {/* Footer pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <PageButton
            href={
              page > 1
                ? buildPageHref({ searchParams, page: page - 1 })
                : undefined
            }
            label="Prev"
          />
          <PageButton
            href={
              page < totalPages
                ? buildPageHref({ searchParams, page: page + 1 })
                : undefined
            }
            label="Next"
          />
        </div>
      )}
    </main>
  );
}

/* =========================
   Card
   ========================= */

function RecipeAdminCard({
  r,
}: {
  r: {
    id: string;
    slug: string;
    title: string;
    image: string | null;
    cuisine: string | null;
    category: string | null;
    isPublic: boolean;
    createdAt: Date | string | null;
    updatedAt: Date | string | null;
    totalTimeSec: number | string | null;
    ratingAvg: number | string | null;
    ratingCount: number | string | null;
  };
}) {
  const time = toNum(r.totalTimeSec);
  const ratingAvg = toNum(r.ratingAvg);
  const ratingCount = toNum(r.ratingCount);

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-muted">
        {r.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.image}
            alt={r.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-2">
          <Badge variant={r.isPublic ? "default" : "secondary"}>
            {r.isPublic ? "Public" : "Private"}
          </Badge>
          {r.cuisine ? <Badge variant="secondary">{r.cuisine}</Badge> : null}
          {r.category ? <Badge variant="outline">{r.category}</Badge> : null}
        </div>
      </div>

      <CardHeader className="pb-2">
        <div className="truncate text-sm font-semibold">{r.title}</div>
        <div className="text-xs text-muted-foreground">
          {formatDate(r.updatedAt)} •{" "}
          {time != null ? `Total ${formatDuration(time)}` : "—"}
          {ratingCount ? (
            <span className="ml-2">
              • {ratingAvg?.toFixed(1)} ({ratingCount})
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/recipes/${r.slug}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            View
          </Link>
          {/* Placeholder for an editor screen if you add one later */}
          <Link
            href={`/admin/recipes`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Edit
          </Link>

          <form
            action={async () => {
              "use server";
              await togglePublicAction(r.id, !r.isPublic);
            }}
            className="ml-auto"
          >
            <Button
              size="sm"
              variant={r.isPublic ? "ghost" : "default"}
              type="submit"
            >
              {r.isPublic ? "Make private" : "Make public"}
            </Button>
          </form>

          <form
            action={async () => {
              "use server";
              await deleteRecipeAction(r.id);
            }}
          >
            <Button
              size="sm"
              variant="destructive"
              type="submit"
              formAction={async (fd) => {
                "use server";
                await requireAdmin();
                // naive confirm replacement: rely on UI; in real UI, confirm on client
                await deleteRecipeAction(r.id);
              }}
            >
              Delete
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================
   Server actions
   ========================= */

export async function togglePublicAction(id: string, isPublic: boolean) {
  "use server";
  await requireAdmin();
  await db
    .update(recipes)
    .set({ isPublic, updatedAt: new Date() })
    .where(eq(recipes.id, id));
  revalidatePath("/recipes");
  revalidatePath("/admin/recipes");
  revalidatePath("/sitemap.xml");
}

export async function deleteRecipeAction(id: string) {
  "use server";
  await requireAdmin();
  await db.delete(recipes).where(eq(recipes.id, id));
  revalidatePath("/recipes");
  revalidatePath("/admin/recipes");
  revalidatePath("/sitemap.xml");
}

/* =========================
   Helpers
   ========================= */

function parseIntSafe(v: string | undefined, fallback: number): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h} hr ${m} min`;
  if (h > 0) return `${h} hr`;
  return `${m} min`;
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(dt);
  } catch {
    return "";
  }
}

function PageButton({ href, label }: { href?: string; label: string }) {
  if (!href) {
    return (
      <Button size="sm" variant="outline" disabled>
        {label}
      </Button>
    );
  }
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      {label}
    </Link>
  );
}

function buildPageHref({
  searchParams,
  page,
}: {
  searchParams: SearchParams;
  page: number;
}) {
  const sp = new URLSearchParams();
  if (searchParams.q) sp.set("q", searchParams.q);
  if (searchParams.public) sp.set("public", searchParams.public);
  if (searchParams.missingImage)
    sp.set("missingImage", searchParams.missingImage);
  if (searchParams.sort) sp.set("sort", searchParams.sort);
  if (searchParams.limit) sp.set("limit", searchParams.limit);
  sp.set("page", String(page));
  return `/admin/recipes?${sp.toString()}`;
}
