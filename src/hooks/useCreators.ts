"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Minimal creator shape returned by /api/creators.
 * Adjust if your API returns more/less fields.
 */
export type CreatorPlatform = "youtube" | "instagram" | "website";

export type CreatorListItem = {
  id: string;
  slug: string;
  platform: CreatorPlatform;
  displayName: string;
  handle: string;
  url: string;
  avatarUrl?: string | null;
  tags?: string[] | null;
  cuisines?: string[] | null;
  latestEmbedUrl?: string | null;
  latestThumbUrl?: string | null;
  latestTitle?: string | null;
  latestPublishedAt?: string | null; // ISO string from API
  featuredRank?: number | null;
};

export type UseCreatorsParams = {
  platform?: CreatorPlatform;
  tag?: string; // server expects one tag at a time
  cuisine?: string; // server expects one cuisine at a time
  q?: string; // free-text search on displayName
  limit?: number;
};

type NormalizedParams = {
  platform?: CreatorPlatform;
  tag?: string;
  cuisine?: string;
  q?: string;
  limit?: number;
};

/**
 * Fetch creators from the API with optional filters.
 * Backed by /api/creators (GET).
 */
async function fetchCreators(
  params: NormalizedParams,
  signal?: AbortSignal
): Promise<CreatorListItem[]> {
  const url = buildApiUrl("/api/creators", params);
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load creators (${res.status})`);
  const json = await res.json();
  return (Array.isArray(json) ? json : json?.items ?? []) as CreatorListItem[];
}

/**
 * Main hook: list creators with filters.
 */
export function useCreators(params?: UseCreatorsParams) {
  const norm = normalizeParams(params);
  return useQuery({
    queryKey: ["creators", norm],
    queryFn: ({ signal }) => fetchCreators(norm, signal),
    staleTime: 30_000, // 30s
    gcTime: 5 * 60 * 1000, // 5m
    placeholderData: (prev) => prev,
  });
}

/**
 * Fetch a curated collection (creators + metadata) by slug.
 * Backed by /api/creator-collections/[slug] (GET).
 */
export type CreatorCollection = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  isFeatured: boolean;
};

export type CreatorCollectionResponse = {
  collection: CreatorCollection;
  creators: (CreatorListItem & { position: number })[];
};

async function fetchCreatorCollection(
  slug: string,
  signal?: AbortSignal
): Promise<CreatorCollectionResponse> {
  const res = await fetch(
    `/api/creator-collections/${encodeURIComponent(slug)}`,
    { signal, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Collection not found (${slug})`);
  return res.json() as Promise<CreatorCollectionResponse>;
}

export function useCreatorCollection(slug?: string) {
  return useQuery({
    queryKey: ["creator-collection", slug],
    queryFn: ({ signal }) => fetchCreatorCollection(slug as string, signal),
    enabled: Boolean(slug),
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
  });
}

/* =========================
   Helpers
   ========================= */

function normalizeParams(params?: UseCreatorsParams): NormalizedParams {
  return {
    platform: params?.platform,
    tag: params?.tag?.trim() || undefined,
    cuisine: params?.cuisine?.trim() || undefined,
    q: params?.q?.trim() || undefined,
    limit: isFiniteNumber(params?.limit) ? Number(params?.limit) : undefined,
  };
}

function buildApiUrl(base: string, p: NormalizedParams): string {
  const sp = new URLSearchParams();
  if (p.platform) sp.set("platform", p.platform);
  if (p.tag) sp.set("tag", p.tag);
  if (p.cuisine) sp.set("cuisine", p.cuisine);
  if (p.q) sp.set("q", p.q);
  if (p.limit != null) sp.set("limit", String(p.limit));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}
