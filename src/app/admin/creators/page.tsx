// app/admin/creators/page.tsx
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Link from "next/link";

import { db } from "@/db/client";
import { creators } from "@/db/creator-schema";
import { requireAdmin } from "@/lib/auth";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const revalidate = 0;

type SearchParams = {
  q?: string;
  platform?: "youtube" | "instagram" | "website" | "";
  featured?: "1" | "true" | "";
  sort?: "updated" | "name" | "featured";
  limit?: string;
  page?: string;
};

export default async function AdminCreatorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin(); // extra guard (layout also protects)

  const q = (searchParams.q ?? "").trim();
  const platform = (searchParams.platform ?? "") as SearchParams["platform"];
  const featured =
    (searchParams.featured ?? "") !== "" &&
    (searchParams.featured === "1" || searchParams.featured === "true");
  const sort = (searchParams.sort ?? "updated") as NonNullable<
    SearchParams["sort"]
  >;
  const limit = clamp(parseIntSafe(searchParams.limit, 20), 1, 100);
  const page = clamp(parseIntSafe(searchParams.page, 1), 1, 9999);
  const offset = (page - 1) * limit;

  const qLower = q.toLowerCase();
  const conds: (SQL | undefined)[] = [
    platform ? eq(creators.platform, platform) : undefined,
    featured ? eq(creators.isFeatured, true) : undefined,
    q
      ? or(
          ilike(creators.displayName, `%${qLower}%`),
          ilike(creators.handle, `%${qLower}%`)
        )
      : undefined,
  ];
  const where = and(...(conds.filter(Boolean) as SQL[]));

  // total count
  const totalRow = await db
    .select({ c: sql<number>`count(*)` })
    .from(creators)
    .where(where);
  const total = toNum(totalRow[0]?.c) ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // sort
  const orderBy =
    sort === "name"
      ? [asc(creators.displayName)]
      : sort === "featured"
      ? [
          desc(creators.isFeatured),
          asc(sql<number>`COALESCE(${creators.featuredRank}, 2147483647)`),
          asc(creators.displayName),
        ]
      : // 'updated'
        [desc(creators.updatedAt)];

  // rows
  const rows = await db
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
      tags: creators.tags,
      cuisines: creators.cuisines,
      latestThumbUrl: creators.latestThumbUrl,
      latestTitle: creators.latestTitle,
      updatedAt: creators.updatedAt,
    })
    .from(creators)
    .where(where)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Creators</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage curated YouTube and Instagram creators.
          </p>
        </div>
        <Link
          href="/admin/creators/new"
          className={cn(buttonVariants(), "w-full sm:w-auto")}
        >
          Add creator
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium">Filters</div>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-12"
            action="/admin/creators"
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
                placeholder="Name or @handle"
                defaultValue={q}
              />
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs text-muted-foreground">
                Platform
              </label>
              <Select name="platform" defaultValue={platform || ""}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">
                Only featured
              </label>
              <Select name="featured" defaultValue={featured ? "1" : ""}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="1">Featured</SelectItem>
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
                  <SelectItem value="featured">Featured first</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-12 flex items-center justify-end gap-2 pt-1">
              <Button type="submit">Apply</Button>
              <Link
                href="/admin/creators"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Reset
              </Link>
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
          {rows.map((c) => (
            <CreatorAdminCard key={c.id} c={c} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          No creators found. Try adjusting filters.
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
    </div>
  );
}

/* =========================
   Server action: toggle featured
   ========================= */

export async function toggleFeaturedAction(id: string, makeFeatured: boolean) {
  "use server";
  await requireAdmin();
  await db
    .update(creators)
    .set({ isFeatured: makeFeatured, updatedAt: new Date() })
    .where(eq(creators.id, id));
  revalidatePath("/admin/creators");
  revalidatePath("/discover");
}

/* =========================
   Card
   ========================= */

function CreatorAdminCard({
  c,
}: {
  c: {
    id: string;
    slug: string;
    platform: "youtube" | "instagram" | "website";
    displayName: string;
    handle: string;
    url: string;
    avatarUrl: string | null;
    isFeatured: boolean;
    featuredRank: number | null;
    tags: string[] | null;
    cuisines: string[] | null;
    latestThumbUrl: string | null;
    latestTitle: string | null;
    updatedAt: Date | string | null;
  };
}) {
  const initials = getInitials(c.displayName);
  return (
    <Card className="overflow-hidden">
      {/* Media */}
      <div className="relative aspect-video bg-muted">
        {c.latestThumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.latestThumbUrl}
            alt={c.latestTitle ?? c.displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No preview
          </div>
        )}
        <div className="absolute left-2 top-2">
          <span className="rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium">
            {c.platform}
          </span>
        </div>
      </div>

      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <Avatar className="h-10 w-10">
          {c.avatarUrl ? (
            <AvatarImage src={c.avatarUrl} alt={c.displayName} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{c.displayName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {c.handle}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {c.isFeatured ? (
            <Badge variant="default">
              Featured{c.featuredRank != null ? ` #${c.featuredRank}` : ""}
            </Badge>
          ) : (
            <Badge variant="secondary">Not featured</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {(c.tags?.length || c.cuisines?.length) && (
          <div className="flex flex-wrap gap-1.5">
            {c.tags?.slice(0, 4).map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
                {t}
              </Badge>
            ))}
            {c.cuisines?.slice(0, 3).map((cu) => (
              <Badge key={cu} variant="outline" className="text-xs">
                {cu}
              </Badge>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Updated {formatDate(c.updatedAt)}
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/creators/${c.slug}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            View
          </Link>
          {/* Placeholder admin edit route; implement /admin/creators/[slug]/page.tsx later */}
          <Link
            href={`/admin/creators/${c.slug}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Edit
          </Link>

          <form
            action={async () => {
              "use server";
              await toggleFeaturedAction(c.id, !c.isFeatured);
            }}
            className="ml-auto"
          >
            <Button
              size="sm"
              variant={c.isFeatured ? "ghost" : "default"}
              type="submit"
            >
              {c.isFeatured ? "Unfeature" : "Feature"}
            </Button>
          </form>

          <Link
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Open
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================
   UI helpers
   ========================= */

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
  if (searchParams.platform) sp.set("platform", searchParams.platform);
  if (searchParams.featured) sp.set("featured", searchParams.featured);
  if (searchParams.sort) sp.set("sort", searchParams.sort);
  sp.set("page", String(page));
  if (searchParams.limit) sp.set("limit", searchParams.limit);
  return `/admin/creators?${sp.toString()}`;
}

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}
