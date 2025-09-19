// components/recipe/RecipeCard.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock, Star, Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type RecipeListItem = {
  id: string;
  slug: string;
  title: string;
  image?: string | null;
  cuisine?: string | null;
  category?: string | null;
  totalTimeSec?: number | null;
  ratingAvg?: number | null; // 0..5
  ratingCount?: number | null;
};

export function RecipeCard({
  r,
  className,
  showSaveButton = true,
  onSaveClick,
  hrefOverride,
}: {
  r: RecipeListItem;
  className?: string;
  showSaveButton?: boolean;
  onSaveClick?: (recipe: RecipeListItem) => void;
  hrefOverride?: string; // override default /recipes/[slug]
}) {
  const href = hrefOverride ?? `/recipes/${r.slug}`;
  const hasImage = Boolean(r.image);
  const timeLabel = r.totalTimeSec ? formatDuration(r.totalTimeSec) : null;
  const ratingLabel =
    typeof r.ratingAvg === "number" && typeof r.ratingCount === "number"
      ? `${r.ratingAvg.toFixed(1)} (${compactNumber(r.ratingCount)})`
      : typeof r.ratingAvg === "number"
      ? r.ratingAvg.toFixed(1)
      : null;

  return (
    <Card
      className={cn("overflow-hidden transition hover:shadow-md", className)}
    >
      {/* Media */}
      <Link href={href} className="block">
        <div className="relative aspect-video bg-muted">
          {hasImage ? (
            <Image
              src={r.image as string}
              alt={r.title}
              fill
              sizes="(min-width: 1024px) 320px, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
        </div>
      </Link>

      <CardHeader className="space-y-1">
        <Link
          href={href}
          className="line-clamp-2 text-base font-semibold hover:underline"
        >
          {r.title}
        </Link>
        <div className="flex flex-wrap gap-1.5">
          {r.cuisine ? <Badge variant="secondary">{r.cuisine}</Badge> : null}
          {r.category ? <Badge variant="outline">{r.category}</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {timeLabel ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {timeLabel}
            </span>
          ) : null}
          {ratingLabel ? (
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-amber-400 stroke-amber-400" />
              {ratingLabel}
            </span>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="justify-between">
        <Link href={href}>
          <Button size="sm">View</Button>
        </Link>
        {showSaveButton && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={() => onSaveClick?.(r)}
            aria-label="Save recipe"
          >
            <Heart className="h-4 w-4" />
            Save
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/* Helpers */

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h} hr ${m} min`;
  if (h > 0) return `${h} hr`;
  return `${m} min`;
}

function compactNumber(n: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }
}

export default RecipeCard;
