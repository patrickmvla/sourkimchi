"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Minimal list item shape returned by /api/recipes (adjust if your API returns more)
 */
export type RecipeListItem = {
  id: string;
  slug: string;
  title: string;
  image?: string | null; // hero image
  cuisine?: string | null;
  category?: string | null;
  // Optional fields if your API includes them:
  totalTimeSec?: number | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
};

export type UseRecipesParams = {
  q?: string; // free text search
  tag?: string | string[]; // one or more tags (accepts string or array)
  cuisine?: string; // filter by cuisine
  timeMax?: number; // max total time (seconds)
  sort?: "new" | "popular" | "rating" | "time";
  page?: number; // optional pagination
  limit?: number; // page size
};

type NormalizedParams = {
  q?: string;
  tags?: string[]; // normalized tag array
  cuisine?: string;
  timeMax?: number;
  sort?: "new" | "popular" | "rating" | "time";
  page?: number;
  limit?: number;
};

/**
 * Fetch a list of recipes from the API with optional filters.
 * This expects an API route at /api/recipes that accepts the given query params.
 */
async function fetchRecipes(
  params: NormalizedParams,
  signal?: AbortSignal
): Promise<RecipeListItem[]> {
  const url = buildApiUrl("/api/recipes", params);
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load recipes (${res.status})`);
  }
  const json = await res.json();
  // Support both plain array and { items: [] } shapes
  if (Array.isArray(json)) return json as RecipeListItem[];
  if (json?.items && Array.isArray(json.items))
    return json.items as RecipeListItem[];
  return [];
}

/**
 * React Query hook for listing recipes with filters.
 * Keeps previous data visible between param changes to reduce UI flicker.
 */
export function useRecipes(params?: UseRecipesParams) {
  const norm = normalizeParams(params);

  return useQuery({
    queryKey: ["recipes", norm],
    queryFn: ({ signal }) => fetchRecipes(norm, signal),
    // Reasonable cache defaults; tweak as needed
    staleTime: 30_000, // 30s fresh
    gcTime: 5 * 60 * 1000, // 5m
    placeholderData: (prev) => prev, // keep previous data during param changes
  });
}

/* =========================
   Helpers
   ========================= */

function normalizeParams(params?: UseRecipesParams): NormalizedParams {
  const p = params ?? {};
  const tags = Array.isArray(p.tag)
    ? [...new Set(p.tag.filter(Boolean).map((t) => String(t)))]
    : p.tag
    ? [String(p.tag)]
    : undefined;

  return {
    q: p.q?.trim() || undefined,
    tags: tags?.sort(),
    cuisine: p.cuisine?.trim() || undefined,
    timeMax: isFiniteNumber(p.timeMax) ? Number(p.timeMax) : undefined,
    sort: p.sort,
    page: isFiniteNumber(p.page) ? Number(p.page) : undefined,
    limit: isFiniteNumber(p.limit) ? Number(p.limit) : undefined,
  };
}

function buildApiUrl(base: string, params: NormalizedParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.cuisine) sp.set("cuisine", params.cuisine);
  if (params.timeMax != null) sp.set("timeMax", String(params.timeMax));
  if (params.sort) sp.set("sort", params.sort);
  if (params.page != null) sp.set("page", String(params.page));
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.tags?.length) {
    // Append multiple tag params: ?tag=a&tag=b
    for (const t of params.tags) sp.append("tag", t);
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}
