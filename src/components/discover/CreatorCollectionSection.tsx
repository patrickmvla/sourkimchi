// components/discover/CreatorCollectionSection.tsx
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CreatorSpotlightCard,
  type CreatorSpotlight,
} from "./CreatorSpotlightCard";

type GridCols = 1 | 2 | 3 | 4;

export function CreatorCollectionSection({
  title,
  description,
  items,
  href,
  className,
  columns = 3,
  showDetailsLink = true,
}: {
  title: string;
  description?: string;
  items: CreatorSpotlight[];
  href?: string; // optional "View all" link
  className?: string;
  columns?: GridCols; // responsive base; we'll still ramp up on larger screens
  showDetailsLink?: boolean; // pass through to spotlight cards
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {href ? (
          <Link href={href} className="shrink-0">
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : null}
      </div>

      {items.length ? (
        <div
          className={cn(
            "grid gap-4",
            columns === 1 && "grid-cols-1",
            columns === 2 && "grid-cols-1 sm:grid-cols-2",
            columns === 3 && "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
            columns === 4 &&
              "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          )}
        >
          {items.map((c) => (
            <CreatorSpotlightCard
              key={c.slug}
              c={c}
              showDetailsLink={showDetailsLink}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">
          No creators yet. Check back soon.
        </div>
      )}
    </section>
  );
}

export default CreatorCollectionSection;
