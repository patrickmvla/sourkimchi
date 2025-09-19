// components/discover/CreatorCard.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Globe, Instagram, Youtube } from "lucide-react";

export type CreatorPlatform = "youtube" | "instagram" | "website";

export type CreatorCardProps = {
  c: {
    id: string;
    slug: string;
    platform: CreatorPlatform;
    displayName: string;
    handle: string;
    url: string;
    avatarUrl?: string | null;
    latestThumbUrl?: string | null;
    latestTitle?: string | null;
    latestPublishedAt?: string | null; // ISO string
    tags?: string[] | null;
    cuisines?: string[] | null;
  };
  className?: string;
  showDetailsLink?: boolean; // show internal link to /creators/[slug]
};

export function CreatorCard({
  c,
  className,
  showDetailsLink = true,
}: CreatorCardProps) {
  const initials = getInitials(c.displayName);
  const latestDate = c.latestPublishedAt
    ? formatDate(c.latestPublishedAt)
    : null;

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Media */}
      <div className="relative">
        <div className="aspect-video bg-muted">
          {c.latestThumbUrl ? (
            <Image
              src={c.latestThumbUrl}
              alt={
                c.latestTitle
                  ? `${c.displayName}: ${c.latestTitle}`
                  : c.displayName
              }
              width={960}
              height={540}
              className="h-full w-full object-cover"
              sizes="(min-width: 1024px) 320px, 100vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              No preview
            </div>
          )}
        </div>

        {/* Overlay: platform + latest */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2">
          <div className="flex items-end justify-between gap-2">
            <PlatformBadge platform={c.platform} />
            {c.latestTitle ? (
              <div className="max-w-[70%] text-right text-xs text-white/90">
                <div className="line-clamp-1 font-medium">{c.latestTitle}</div>
                {latestDate && <div className="opacity-80">{latestDate}</div>}
              </div>
            ) : null}
          </div>
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
          <div className="truncate text-base font-semibold">
            {c.displayName}
          </div>
          <div className="truncate text-sm text-muted-foreground">
            {c.handle}
          </div>
        </div>
        <div className="ml-auto">
          <Link href={c.url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              Visit
            </Button>
          </Link>
        </div>
      </CardHeader>

      {((c.tags && c.tags.length) || (c.cuisines && c.cuisines.length)) && (
        <CardContent className="pt-0">
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
        </CardContent>
      )}

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
    </Card>
  );
}

/* Helpers */

function PlatformBadge({ platform }: { platform: CreatorPlatform }) {
  const className =
    "flex items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 text-xs font-medium";
  if (platform === "youtube") {
    return (
      <span className={cn(className, "text-red-600")}>
        <Youtube className="h-3.5 w-3.5" />
        YouTube
      </span>
    );
  }
  if (platform === "instagram") {
    return (
      <span className={cn(className, "text-pink-600")}>
        <Instagram className="h-3.5 w-3.5" />
        Instagram
      </span>
    );
  }
  return (
    <span className={cn(className, "text-sky-600")}>
      <Globe className="h-3.5 w-3.5" />
      Website
    </span>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

export default CreatorCard;
