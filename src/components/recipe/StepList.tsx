// components/recipe/StepList.tsx
"use client";

import { Copy, Play, RotateCcw, Timer as TimerIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type StepItem = {
  idx: number; // 0-based
  text: string;
  durationSec?: number | null;
  imageUrl?: string | null;
};

export type StepListProps = {
  steps: StepItem[];
  className?: string;
  recipeKey?: string; // for persisting checkmarks per recipe (slug or id)
  cookHref?: string; // link to open Cook Mode (/cook/[slug])
  showHeader?: boolean; // show progress + actions bar
  showImagesToggle?: boolean; // include "Show images" toggle
};

export default function StepList({
  steps,
  className,
  recipeKey,
  cookHref,
  showHeader = true,
  showImagesToggle = true,
}: StepListProps) {
  const [showImages, setShowImages] = useState(true);
  const storageKey = useMemo(
    () => (recipeKey ? `sourkimchi:steps:${recipeKey}` : `sourkimchi:steps`),
    [recipeKey]
  );

  // Completed state per step idx
  const [done, setDone] = useState<Record<number, boolean>>({});

  // Load persisted
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Persist on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(done));
    } catch {
      // ignore
    }
  }, [done, storageKey]);

  const total = steps.length;
  const completed = steps.reduce((acc, s) => acc + (done[s.idx] ? 1 : 0), 0);
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const anyImages = steps.some((s) => !!s.imageUrl);

  const resetChecks = () => setDone({});
  const toggleAll = (value: boolean) =>
    setDone(Object.fromEntries(steps.map((s) => [s.idx, value])));

  const copySteps = async () => {
    const lines: string[] = [];
    for (const s of steps) {
      const time = s.durationSec ? ` (${formatClock(s.durationSec)})` : "";
      lines.push(`${s.idx + 1}. ${s.text}${time}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {showHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary">
              Progress: {completed}/{total}
            </Badge>
            <div className="w-40 sm:w-64">
              <Progress value={progressPct} />
            </div>
            {showImagesToggle && anyImages && (
              <>
                <span className="ml-2 text-sm text-muted-foreground">
                  Show images
                </span>
                <Switch
                  checked={showImages}
                  onCheckedChange={(v) => setShowImages(!!v)}
                />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cookHref && (
              <Link href={cookHref}>
                <Button size="sm">
                  <Play className="mr-2 h-4 w-4" />
                  Cook mode
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
              Mark all done
            </Button>
            <Button variant="outline" size="sm" onClick={resetChecks}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset checks
            </Button>
            <Button variant="outline" size="sm" onClick={copySteps}>
              <Copy className="mr-2 h-4 w-4" />
              Copy steps
            </Button>
          </div>
        </div>
      )}

      <ol className="space-y-3">
        {steps.map((s) => {
          const checked = !!done[s.idx];
          return (
            <li
              key={s.idx}
              id={`step-${s.idx + 1}`}
              className="rounded-xl border p-4"
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    setDone((prev) => ({ ...prev, [s.idx]: !!v }))
                  }
                  className="mt-0.5"
                  aria-label={`Mark step ${s.idx + 1} as done`}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant={checked ? "default" : "secondary"}>
                      Step {s.idx + 1}
                    </Badge>
                    {s.durationSec ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <TimerIcon className="h-3.5 w-3.5" />
                        {formatClock(s.durationSec)}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "leading-relaxed",
                      checked && "text-muted-foreground line-through"
                    )}
                  >
                    {s.text}
                  </p>

                  {showImages && s.imageUrl ? (
                    <div className="mt-3 overflow-hidden rounded-lg border">
                      <Image
                        src={s.imageUrl}
                        alt={`Step ${s.idx + 1}`}
                        width={1200}
                        height={675}
                        className="h-auto w-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* =========================
   Helpers
   ========================= */

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}
