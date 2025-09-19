import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { recipes } from "@/db/schema";
import { creators } from "@/db/creator-schema";
import { getSiteUrl } from "@/lib/env";

export const revalidate = 60 * 60; // regenerate sitemap every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseUrl();

  // Static top-level pages
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/recipes`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/discover`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/discover/youtube`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${base}/discover/instagram`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  const dynamicEntries: MetadataRoute.Sitemap = [];

  try {
    // Recipes (public only)
    const recs = await db
      .select({ slug: recipes.slug, updatedAt: recipes.updatedAt })
      .from(recipes)
      .where(eq(recipes.isPublic, true));

    dynamicEntries.push(
      ...recs.map((r) => ({
        url: `${base}/recipes/${r.slug}`,
        lastModified: r.updatedAt ?? new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.8,
      }))
    );
  } catch (e) {
    console.error("sitemap: failed to load recipes", e);
  }

  try {
    // Creators
    const crs = await db
      .select({ slug: creators.slug, updatedAt: creators.updatedAt })
      .from(creators);

    dynamicEntries.push(
      ...crs.map((c) => ({
        url: `${base}/creators/${c.slug}`,
        lastModified: c.updatedAt ?? new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      }))
    );
  } catch (e) {
    console.error("sitemap: failed to load creators", e);
  }

  // Note: We intentionally omit /cook/[slug] from sitemap (utility page, not for SEO)

  return [...staticEntries, ...dynamicEntries];
}

function getBaseUrl(): string {
  // Prefer env helper; fall back to common patterns if needed
  try {
    return getSiteUrl();
  } catch {
    const envUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
    return envUrl.replace(/\/+$/, "");
  }
}
