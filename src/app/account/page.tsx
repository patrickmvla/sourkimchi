// app/account/page.tsx
import { auth } from "@clerk/nextjs/server";
import { desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db/client";
import { favorites, recipeNotes, recipes, reviews } from "@/db/schema";

import RecipeCard from "@/components/recipe/RecipeCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  Card as UCard,
  CardContent as UCardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useCookStore } from "@/stores/cookStore";
import { useEffect, useState } from "react";

export const revalidate = 0;

export default async function AccountPage() {
  const { userId } = await auth();
  if (!userId) return notFound();

  const [saved, notes] = await Promise.all([
    getSavedRecipes(userId, 24),
    getMyNotes(userId, 50),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <Badge variant="secondary" className="mb-2">
          Account
        </Badge>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your cooking preferences, saved recipes, and notes.
        </p>
      </header>

      {/* Preferences (local, device-level) */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">Preferences</h2>
        <PreferencesPanel />
      </section>

      <Separator className="my-8" />

      {/* Saved recipes */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Saved recipes</h2>
        </div>
        {saved.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {saved.map((r) => (
              <RecipeCard key={r.id} r={r} />
            ))}
          </div>
        ) : (
          <EmptyState message="No saved recipes yet. Browse and tap Save on recipes you love." />
        )}
      </section>

      <Separator className="my-8" />

      {/* My notes */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">My notes</h2>
        {notes.length ? (
          <div className="grid gap-3">
            {notes.map((n) => (
              <a
                key={n.id}
                href={`/recipes/${n.recipeSlug}`}
                className="group block rounded-xl border transition hover:shadow-sm"
              >
                <Card>
                  <CardHeader className="pb-2">
                    <div className="text-sm text-muted-foreground">
                      Note on{" "}
                      <span className="font-medium text-foreground">
                        {n.recipeTitle}
                      </span>
                      {n.createdAt ? (
                        <span className="ml-2">
                          • {formatDate(n.createdAt)}
                        </span>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-sm text-muted-foreground group-hover:text-foreground">
                      {n.body}
                    </p>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState message="No notes yet. Add a note while viewing a recipe to remember tweaks and tips." />
        )}
      </section>
    </main>
  );
}

/* =========================
   Data loaders
   ========================= */

async function getSavedRecipes(userId: string, limit: number) {
  // rating aggregates
  const ra = db
    .select({
      recipeId: reviews.recipeId,
      ratingAvg: sql<number | null>`avg(${reviews.stars})`.as("rating_avg"),
      ratingCount: sql<number>`count(${reviews.id})`.as("rating_count"),
    })
    .from(reviews)
    .groupBy(reviews.recipeId)
    .as("ra");

  const totalTimeExpr = sql<number>`
    COALESCE(
      ${recipes.totalTimeSec},
      COALESCE(${recipes.prepTimeSec}, 0) + COALESCE(${recipes.cookTimeSec}, 0) + COALESCE(${recipes.restTimeSec}, 0)
    )
  `;

  const rows = await db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      title: recipes.title,
      image: recipes.heroImageUrl,
      cuisine: recipes.cuisine,
      category: recipes.category,
      totalTimeSec: totalTimeExpr,
      ratingAvg: ra.ratingAvg,
      ratingCount: ra.ratingCount,
      savedAt: favorites.createdAt,
    })
    .from(favorites)
    .innerJoin(recipes, eq(favorites.recipeId, recipes.id))
    .leftJoin(ra, eq(ra.recipeId, recipes.id))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    image: r.image ?? null,
    cuisine: r.cuisine ?? null,
    category: r.category ?? null,
    totalTimeSec: toNum(r.totalTimeSec),
    ratingAvg: toNum(r.ratingAvg),
    ratingCount: toNum(r.ratingCount),
  }));
}

async function getMyNotes(userId: string, limit: number) {
  const rows = await db
    .select({
      id: recipeNotes.id,
      body: recipeNotes.body,
      createdAt: recipeNotes.createdAt,
      recipeSlug: recipes.slug,
      recipeTitle: recipes.title,
    })
    .from(recipeNotes)
    .innerJoin(recipes, eq(recipeNotes.recipeId, recipes.id))
    .where(eq(recipeNotes.userId, userId))
    .orderBy(desc(recipeNotes.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    recipeSlug: r.recipeSlug,
    recipeTitle: r.recipeTitle,
  }));
}

/* =========================
   Client: Preferences
   ========================= */

function PreferencesPanel() {
  const [units, setUnitsState] = useState<"metric" | "imperial">("metric");
  const [
    storeUnits,
    setUnits,
    soundEnabled,
    setSoundEnabled,
    largeText,
    setLargeText,
    darkMode,
    setDarkMode,
    resetAll,
  ] = useCookStore((s) => [
    s.units,
    s.setUnits,
    s.soundEnabled,
    s.setSoundEnabled,
    s.largeText,
    s.setLargeText,
    s.darkMode,
    s.setDarkMode,
    s.resetAll,
  ]);

  useEffect(() => setUnitsState(storeUnits), [storeUnits]);

  return (
    <UCard className="overflow-hidden">
      <UCardContent className="space-y-5 p-4 sm:p-6">
        {/* Units */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">Units</div>
            <div className="text-xs text-muted-foreground">
              Choose your preferred measurement system.
            </div>
          </div>
          <div className="inline-flex rounded-md border p-0.5">
            <Button
              variant={units === "metric" ? "default" : "ghost"}
              size="sm"
              className="rounded-sm"
              onClick={() => setUnits("metric")}
            >
              Metric
            </Button>
            <Button
              variant={units === "imperial" ? "default" : "ghost"}
              size="sm"
              className="rounded-sm"
              onClick={() => setUnits("imperial")}
            >
              Imperial
            </Button>
          </div>
        </div>

        {/* Toggles */}
        <div className="grid gap-4 sm:grid-cols-3">
          <ToggleRow
            label="Sound"
            hint="Beep when timers complete."
            checked={soundEnabled}
            onChange={setSoundEnabled}
          />
          <ToggleRow
            label="Large text in cook mode"
            hint="Bigger step text for readability."
            checked={largeText}
            onChange={setLargeText}
          />
          <ToggleRow
            label="Cook mode dark theme"
            hint="Dim the lights while cooking."
            checked={darkMode}
            onChange={setDarkMode}
          />
        </div>

        {/* Reset */}
        <div className="flex items-center justify-end">
          <Button variant="outline" onClick={() => resetAll()}>
            Reset cook session
          </Button>
        </div>
      </UCardContent>
    </UCard>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint ? (
          <div className="text-xs text-muted-foreground">{hint}</div>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={(v) => onChange(!!v)} />
    </div>
  );
}

/* =========================
   Small helpers
   ========================= */

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function formatDate(d: Date | string | null | undefined) {
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
