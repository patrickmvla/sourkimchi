/* eslint-disable @typescript-eslint/no-explicit-any */
// app/creators/[slug]/page.tsx
import { notFound } from "next/navigation";
import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { creators } from "@/db/creator-schema";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

import { creatorToJsonLd } from "@/lib/jsonld";

export const revalidate = 120;

type PageProps = { params: { slug: string } };

export default async function CreatorPage({ params }: PageProps) {
  const c = await loadCreatorBySlug(params.slug);
  if (!c) return notFound();

  // JSON-LD
  const sameAs = uniqueStrings([
    c.url,
    ...(c.links?.map((l) => l.url).filter(Boolean) ?? []),
  ]);
  const jsonLd = creatorToJsonLd({
    displayName: c.displayName,
    url: c.url,
    avatarUrl: c.avatarUrl || undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    type: c.platform === "website" ? "Organization" : "Person",
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Script
        id="creator-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar className="h-16 w-16">
          {c.avatarUrl ? (
            <AvatarImage src={c.avatarUrl} alt={c.displayName} />
          ) : null}
          <AvatarFallback>{getInitials(c.displayName)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight">
            {c.displayName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate">{c.handle}</span>
            <PlatformPill platform={c.platform} />
            {c.country ? (
              <Badge variant="outline">{c.country.toUpperCase()}</Badge>
            ) : null}
            {c.language ? (
              <Badge variant="secondary">{c.language}</Badge>
            ) : null}
          </div>
          {c.tags?.length || c.cuisines?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.tags?.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs">
                  {t}
                </Badge>
              ))}
              {c.cuisines?.map((cu) => (
                <Badge key={cu} variant="outline" className="text-xs">
                  {cu}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link href={c.url} target="_blank" rel="noreferrer">
            <Button>Follow</Button>
          </Link>
        </div>
      </header>

      {/* Tagline */}
      {c.tagline ? (
        <p className="mt-4 text-muted-foreground">{c.tagline}</p>
      ) : null}

      {/* Links */}
      {c.links?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {c.links.map((l, i) => (
            <Link
              key={`${l.url}-${i}`}
              href={l.url}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" size="sm">
                {l.label || prettyLinkKind(l.kind) || "Link"}
              </Button>
            </Link>
          ))}
        </div>
      ) : null}

      <Separator className="my-6" />

      {/* Latest (YouTube) */}
      {c.platform === "youtube" && c.latestEmbedUrl ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Latest video</h2>
          <div className="overflow-hidden rounded-xl border">
            <div className="aspect-video">
              <iframe
                src={c.latestEmbedUrl}
                className="h-full w-full"
                title={c.latestTitle || `${c.displayName} latest video`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {c.latestTitle ? (
              <span className="font-medium text-foreground">
                {c.latestTitle}
              </span>
            ) : null}
            {c.latestPublishedAt ? (
              <span className="ml-2">• {formatDate(c.latestPublishedAt)}</span>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Start here picks */}
      {c.startHere?.length ? (
        <>
          <Separator className="my-6" />
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Start here</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.startHere.slice(0, 12).map((p) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border transition hover:shadow-md"
                >
                  <div className="relative aspect-video bg-muted">
                    {p.thumbUrl ? (
                      <Image
                        src={p.thumbUrl}
                        alt={p.title}
                        width={640}
                        height={360}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : null}
                    <div className="pointer-events-none absolute left-2 top-2">
                      <PlatformPill platform={p.platform} subtle />
                    </div>
                  </div>
                  <CardHeader className="space-y-1 p-3">
                    <div className="line-clamp-2 text-sm font-medium">
                      {p.title}
                    </div>
                    {p.note ? (
                      <div className="line-clamp-2 text-xs text-muted-foreground">
                        {p.note}
                      </div>
                    ) : null}
                  </CardHeader>
                </a>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {/* Why we love them */}
      {c.loveNote ? (
        <>
          <Separator className="my-6" />
          <section>
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold">Why we love them</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{c.loveNote}</p>
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </main>
  );
}

/* =========================
   Data loader
   ========================= */

async function loadCreatorBySlug(slug: string) {
  const rows = await db
    .select({
      id: creators.id,
      slug: creators.slug,
      platform: creators.platform,
      handle: creators.handle,
      displayName: creators.displayName,
      url: creators.url,
      externalId: creators.externalId,
      avatarUrl: creators.avatarUrl,
      bannerUrl: creators.bannerUrl,
      tagline: creators.tagline,
      loveNote: creators.loveNote,
      tags: creators.tags,
      cuisines: creators.cuisines,
      country: creators.country,
      language: creators.language,
      startHere: creators.startHere,
      links: creators.links,
      latestEmbedUrl: creators.latestEmbedUrl,
      latestThumbUrl: creators.latestThumbUrl,
      latestTitle: creators.latestTitle,
      latestPublishedAt: creators.latestPublishedAt,
      updatedAt: creators.updatedAt,
    })
    .from(creators)
    .where(eq(creators.slug, slug))
    .orderBy(asc(creators.displayName))
    .limit(1);

  const c = rows[0];
  if (!c) return null;

  // Drizzle returns JSONB typed; cast to TS-friendly
  return {
    ...c,
    tags: c.tags ?? [],
    cuisines: c.cuisines ?? [],
    startHere: (c.startHere as any as StartHereItem[] | undefined) ?? [],
    links: (c.links as any as CreatorLink[] | undefined) ?? [],
    latestPublishedAt: c.latestPublishedAt
      ? new Date(c.latestPublishedAt)
      : null,
  };
}

/* =========================
   Types & helpers
   ========================= */

type Platform = "youtube" | "instagram" | "website";

type StartHereItem = {
  title: string;
  url: string;
  platform: Platform;
  note?: string;
  thumbUrl?: string;
};

type CreatorLink = {
  label?: string;
  kind?: "website" | "shop" | "patreon" | "newsletter" | "course";
  url: string;
};

function PlatformPill({
  platform,
  subtle,
}: {
  platform: Platform;
  subtle?: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium";
  if (platform === "youtube") {
    return (
      <span
        className={`${base} ${
          subtle
            ? "bg-background/90 text-red-600"
            : "bg-background text-red-600"
        }`}
      >
        YouTube
      </span>
    );
  }
  if (platform === "instagram") {
    return (
      <span
        className={`${base} ${
          subtle
            ? "bg-background/90 text-pink-600"
            : "bg-background text-pink-600"
        }`}
      >
        Instagram
      </span>
    );
  }
  return (
    <span
      className={`${base} ${
        subtle ? "bg-background/90 text-sky-600" : "bg-background text-sky-600"
      }`}
    >
      Website
    </span>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function uniqueStrings(xs: (string | undefined)[]) {
  const set = new Set((xs.filter(Boolean) as string[]).map((s) => s.trim()));
  return [...set.values()];
}

function prettyLinkKind(kind?: string) {
  if (!kind) return undefined;
  const k = kind.toLowerCase();
  if (k === "patreon") return "Patreon";
  if (k === "shop") return "Shop";
  if (k === "newsletter") return "Newsletter";
  if (k === "course") return "Course";
  return "Website";
}

function formatDate(d: Date | string | null) {
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
