// components/discover/CreatorSpotlightCard.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Youtube, Instagram, Globe, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export type StartHereItem = {
  title: string;
  url: string;
  platform: "youtube" | "instagram" | "website";
  note?: string;
  thumbUrl?: string;
};

export type CreatorSpotlight = {
  slug: string;
  platform: "youtube" | "instagram" | "website";
  displayName: string;
  handle: string;
  url: string;
  avatarUrl?: string | null;
  tagline?: string | null;
  loveNote?: string | null;
  tags?: string[] | null;
  cuisines?: string[] | null;
  startHere?: StartHereItem[] | null;
};

export function CreatorSpotlightCard({
  c,
  className,
  showDetailsLink = true,
}: {
  c: CreatorSpotlight;
  className?: string;
  showDetailsLink?: boolean;
}) {
  const picks = (c.startHere ?? []).slice(0, 3);
  const initials = getInitials(c.displayName);

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <Avatar className="h-12 w-12">
          {c.avatarUrl ? (
            <AvatarImage src={c.avatarUrl} alt={c.displayName} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">
              {c.displayName}
            </h3>
            <PlatformPill platform={c.platform} />
          </div>
          <p className="truncate text-sm text-muted-foreground">{c.handle}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href={c.url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline" className="gap-1">
              Visit <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tagline */}
        {c.tagline ? (
          <p className="text-sm leading-relaxed">{c.tagline}</p>
        ) : null}

        {/* Start here picks */}
        {picks.length > 0 && (
          <section className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Start here
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {picks.map((p) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-lg border transition hover:shadow-md"
                >
                  <div className="relative aspect-video bg-muted">
                    {p.thumbUrl ? (
                      <Image
                        src={p.thumbUrl}
                        alt={p.title}
                        width={640}
                        height={360}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        sizes="(min-width: 1024px) 280px, 100vw"
                      />
                    ) : null}
                    <div className="pointer-events-none absolute left-2 top-2">
                      <PlatformPill platform={p.platform} subtle />
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="line-clamp-2 text-sm font-medium">
                      {p.title}
                    </div>
                    {p.note ? (
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {p.note}
                      </div>
                    ) : null}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Love note */}
        {c.loveNote ? (
          <section className="space-y-2">
            <Separator />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Why we love them:{" "}
              </span>
              {c.loveNote}
            </div>
          </section>
        ) : null}

        {/* Tags and cuisines */}
        {(c.tags?.length || c.cuisines?.length) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {c.tags?.slice(0, 6).map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
                {t}
              </Badge>
            ))}
            {c.cuisines?.slice(0, 4).map((cu) => (
              <Badge key={cu} variant="outline" className="text-xs">
                {cu}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      {(showDetailsLink || c.url) && (
        <CardFooter className="justify-end gap-2">
          {showDetailsLink && (
            <Link href={`/creators/${c.slug}`}>
              <Button size="sm" variant="ghost">
                Details
              </Button>
            </Link>
          )}
          <Link href={c.url} target="_blank" rel="noreferrer">
            <Button size="sm">Follow</Button>
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

/* Helpers */

function PlatformPill({
  platform,
  subtle,
}: {
  platform: "youtube" | "instagram" | "website";
  subtle?: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium";
  if (platform === "youtube") {
    return (
      <span
        className={cn(
          base,
          subtle
            ? "bg-background/90 text-red-600"
            : "bg-background text-red-600"
        )}
      >
        <Youtube className="h-3.5 w-3.5" />
        YouTube
      </span>
    );
  }
  if (platform === "instagram") {
    return (
      <span
        className={cn(
          base,
          subtle
            ? "bg-background/90 text-pink-600"
            : "bg-background text-pink-600"
        )}
      >
        <Instagram className="h-3.5 w-3.5" />
        Instagram
      </span>
    );
  }
  return (
    <span
      className={cn(
        base,
        subtle ? "bg-background/90 text-sky-600" : "bg-background text-sky-600"
      )}
    >
      <Globe className="h-3.5 w-3.5" />
      Website
    </span>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default CreatorSpotlightCard;
