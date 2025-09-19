// app/discover/instagram/page.tsx
'use client';

import { FormEvent, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useCreators } from '@/hooks/useCreators';
import CreatorCard from '@/components/discover/CreatorCard';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function InstagramDiscoverPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Current filters from URL
  const q = sp.get('q') ?? '';
  const cuisine = sp.get('cuisine') ?? '';
  const tag = sp.get('tag') ?? '';
  const limit = clamp(toInt(sp.get('limit')) ?? 40, 1, 100);

  const { data, isLoading, error } = useCreators({
    platform: 'instagram',
    q: q || undefined,
    cuisine: cuisine || undefined,
    tag: tag || undefined,
    limit,
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = new URLSearchParams();

    const qNext = (fd.get('q') as string)?.trim();
    const cuisineNext = (fd.get('cuisine') as string)?.trim();
    const tagNext = (fd.get('tag') as string)?.trim();
    const limitNext = clamp(toInt(fd.get('limit') as string) ?? 40, 1, 100);

    if (qNext) next.set('q', qNext);
    if (cuisineNext) next.set('cuisine', cuisineNext);
    if (tagNext) next.set('tag', tagNext);
    if (limitNext !== 40) next.set('limit', String(limitNext));

    router.push(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  }

  function handleReset() {
    router.push(pathname);
  }

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (q) chips.push({ key: 'q', label: `“${q}”` });
    if (cuisine) chips.push({ key: 'cuisine', label: cuisine });
    if (tag) chips.push({ key: 'tag', label: `#${tag}` });
    if (limit !== 40) chips.push({ key: 'limit', label: `limit ${limit}` });
    return chips;
  }, [q, cuisine, tag, limit]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold">Instagram creators</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hand-picked cooking accounts to follow and fall in love with.
      </p>

      {/* Filters */}
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted-foreground">
              Search
            </label>
            <Input id="q" name="q" placeholder="e.g., vegan, pasta, desserts" defaultValue={q} />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="cuisine" className="mb-1 block text-xs font-medium text-muted-foreground">
              Cuisine
            </label>
            <Input id="cuisine" name="cuisine" placeholder="Korean, Italian…" defaultValue={cuisine} />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="tag" className="mb-1 block text-xs font-medium text-muted-foreground">
              Tag
            </label>
            <Input id="tag" name="tag" placeholder="baking, weeknight…" defaultValue={tag} />
          </div>

          <div className="md:col-span-1">
            <label htmlFor="limit" className="mb-1 block text-xs font-medium text-muted-foreground">
              Limit
            </label>
            <Input id="limit" name="limit" type="number" min={1} max={100} defaultValue={String(limit)} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit">Apply</Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
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
          <GridSkeleton />
        ) : error ? (
          <div className="rounded-lg border p-6 text-sm text-red-600">
            Failed to load creators. Please try again.
          </div>
        ) : (data?.length ?? 0) > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data!.map((c) => (
              <CreatorCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border p-6 text-sm text-muted-foreground">
            No creators found. Try a different keyword or clear filters.
          </div>
        )}
      </section>
    </main>
  );
}

/* =========================
   Helpers & skeletons
   ========================= */

function toInt(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function GridSkeleton() {
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
      <div className="flex items-center gap-3 p-4">
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
        <div className="flex-1">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-3 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}