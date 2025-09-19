/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { creators } from "@/db/creator-schema";
import { fetchLatestFromRss } from "@/lib/yt";

export const revalidate = 0; // always dynamic

// Vercel Cron-friendly endpoint to refresh latest YT video info for curated creators.
// Security: require a secret in either ?key=... or header x-cron-secret / Authorization: Bearer ...
// Set CRON_SECRET in your environment. If not set, dev will allow all requests.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = clamp(toInt(searchParams.get("limit")) ?? 100, 1, 500);
    const dryRun = parseBool(searchParams.get("dry"));

    // Pick YouTube creators with a channelId in externalId
    const rows = await db
      .select({
        id: creators.id,
        externalId: creators.externalId,
        displayName: creators.displayName,
        slug: creators.slug,
      })
      .from(creators)
      .where(
        and(
          eq(creators.platform, "youtube"),
          sql`${creators.externalId} IS NOT NULL`
        )
      )
      .limit(limit);

    let updated = 0;
    let skipped = 0;
    const results: Array<{
      id: string;
      slug: string;
      ok: boolean;
      reason?: string;
    }> = [];

    for (const c of rows) {
      const channelId = c.externalId!;
      try {
        const latest = await fetchLatestFromRss(channelId);
        if (!latest || !latest.embedUrl || !latest.thumb) {
          skipped++;
          results.push({
            id: c.id,
            slug: c.slug,
            ok: false,
            reason: "no-latest",
          });
          continue;
        }

        if (!dryRun) {
          await db
            .update(creators)
            .set({
              latestEmbedUrl: latest.embedUrl,
              latestThumbUrl: latest.thumb,
              latestTitle: latest.title ?? null,
              latestPublishedAt: latest.publishedAt ?? null,
              updatedAt: new Date(),
            })
            .where(eq(creators.id, c.id));
        }

        updated++;
        results.push({ id: c.id, slug: c.slug, ok: true });
      } catch (e: any) {
        skipped++;
        results.push({
          id: c.id,
          slug: c.slug,
          ok: false,
          reason: e?.message || "error",
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        total: rows.length,
        updated,
        skipped,
        dryRun,
        results,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("cron/refresh-youtube error", e);
    return NextResponse.json(
      { error: "Failed to refresh YouTube feeds" },
      { status: 500 }
    );
  }
}

/* =========================
   Helpers
   ========================= */

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // If no secret configured, allow in dev; deny in production unless explicitly allowed
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("key");
  const fromHeader =
    req.headers.get("x-cron-secret") ||
    bearerToken(req.headers.get("authorization"));
  return fromQuery === secret || fromHeader === secret;
}

function bearerToken(auth: string | null): string | null {
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function toInt(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseBool(v: string | null): boolean {
  const s = (v ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}
