// app/recipes/page.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo } from "react";

import RecipeCard from "@/components/recipe/RecipeCard";
import { useRecipes } from "@/hooks/useRecipes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const SORT_OPTIONS = [
  { value: "new", label: "Newest" },
  { value: "popular", label: "Popular" },
  { value: "rating", label: "Top rated" },
  { value: "time", label: "Shortest time" },
] as const;

export default function RecipesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Derive current filters from URL
  const q = sp.get("q") ?? "";
  const cuisine = sp.get("cuisine") ?? "";
  const tags = sp.getAll("tag").filter(Boolean);
  const sort =
    (sp.get("sort") as "new" | "popular" | "rating" | "time") || "new";
  const timeMaxSec = toInt(sp.get("timeMax"));
  const timeMaxMin = timeMaxSec ? Math.round(timeMaxSec / 60) : "";

  const { data, isLoading, error } = useRecipes({
    q: q || undefined,
    cuisine: cuisine || undefined,
    tag: tags,
    sort,
    timeMax: timeMaxSec ?? undefined,
    limit: 24,
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = new URLSearchParams();

    const qNext = (fd.get("q") as string)?.trim();
    const cuisineNext = (fd.get("cuisine") as string)?.trim();
    const tagsNext = ((fd.get("tags") as string) || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const sortNext = (fd.get("sort") as string) || "new";
    const timeMinStr = (fd.get("timeMaxMin") as string)?.trim();
    const timeMin = timeMinStr ? Number(timeMinStr) : NaN;
    const timeNextSec =
      Number.isFinite(timeMin) && timeMin > 0 ? timeMin * 60 : null;

    if (qNext) next.set("q", qNext);
    if (cuisineNext) next.set("cuisine", cuisineNext);
    for (const t of tagsNext) next.append("tag", t);
    if (sortNext && sortNext !== "new") next.set("sort", sortNext);
    if (timeNextSec) next.set("timeMax", String(timeNextSec));

    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleReset() {
    router.push(pathname);
  }

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (q) chips.push({ key: "q", label: `“${q}”` });
    if (cuisine) chips.push({ key: "cuisine", label: cuisine });
    for (const t of tags) chips.push({ key: `tag:${t}`, label: `#${t}` });
    if (timeMaxSec)
      chips.push({
        key: "time",
        label: `≤ ${Math.round(timeMaxSec / 60)} min`,
      });
    if (sort && sort !== "new") {
      const so = SORT_OPTIONS.find((o) => o.value === sort)?.label || sort;
      chips.push({ key: "sort", label: so });
    }
    return chips;
  }, [q, cuisine, tags, timeMaxSec, sort]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold">Browse recipes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Search and filter structured recipes. Use time, cuisine, and tags to
        narrow it down.
      </p>

      {/* Filters */}
      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-xl border p-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label
              htmlFor="q"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Search
            </label>
            <Input
              id="q"
              name="q"
              placeholder="Pasta, curry, cookies…"
              defaultValue={q}
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="cuisine"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Cuisine
            </label>
            <Input
              id="cuisine"
              name="cuisine"
              placeholder="Italian, Korean…"
              defaultValue={cuisine}
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="tags"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Tags (comma-separated)
            </label>
            <Input
              id="tags"
              name="tags"
              placeholder="vegan, weeknight, one-pot"
              defaultValue={tags.join(", ")}
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="timeMaxMin"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Max time (min)
            </label>
            <Input
              id="timeMaxMin"
              name="timeMaxMin"
              type="number"
              min={1}
              placeholder="e.g., 30"
              defaultValue={String(timeMaxMin)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Sort by
            </label>
            <Select name="sort" defaultValue={sort}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button type="submit">Apply</Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Active:</span>
              {activeFilters.map((f) => (
                <Badge key={f.key} variant="secondary">
                  {f.label}
                </Badge>
              ))}
            </div>
          </>
        )}
      </form>

      {/* Results */}
      <section className="mt-6">
        {isLoading ? (
          <RecipesSkeleton />
        ) : error ? (
          <div className="rounded-lg border p-6 text-sm text-red-600">
            Failed to load recipes. Please try again.
          </div>
        ) : (data?.length ?? 0) > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data!.map((r) => (
              <RecipeCard key={r.id} r={r} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border p-6 text-sm text-muted-foreground">
            No recipes found. Try removing some filters.
          </div>
        )}
      </section>
    </main>
  );
}

/* =========================
   Small helpers
   ========================= */

function toInt(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

/* =========================
   Skeletons
   ========================= */

function RecipesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="aspect-video animate-pulse bg-muted" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
