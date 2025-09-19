/* eslint-disable @typescript-eslint/no-explicit-any */

// Utilities to generate Schema.org JSON‑LD for SEO.
// Focus: Recipe pages (and optional Creator + Collection helpers).

type Maybe<T> = T | null | undefined;

/* =========================
   Types for input shaping
   ========================= */

export type IngredientLike = {
  name: string;
  quantity?: number | null;
  unit?: string | null; // e.g., 'g', 'cup'
  preparation?: string | null; // e.g., 'diced'
};

export type IngredientSectionLike = {
  title?: string | null;
  ingredients: IngredientLike[];
};

export type StepLike = {
  idx: number; // 0-based
  text: string;
  durationSec?: number | null;
  imageUrl?: string | null;
};

export type NutritionLike = {
  calories?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
};

export type RatingLike = {
  average: number; // 0..5
  count: number; // number of ratings
};

export type RecipeLike = {
  slug: string;
  title: string;
  description?: string | null;
  heroImageUrl?: string | null;
  cuisine?: string | null;
  category?: string | null;
  tags?: string[] | null;

  servings?: number | null;

  prepTimeSec?: number | null;
  cookTimeSec?: number | null;
  restTimeSec?: number | null;
  totalTimeSec?: number | null;

  sections: IngredientSectionLike[];
  steps: StepLike[];

  equipment?: string[] | null; // optional

  nutrition?: NutritionLike | null;
  rating?: RatingLike | null;

  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type AuthorLike = {
  name: string;
  url?: string;
  type?: "Person" | "Organization";
};

export type PublisherLike = {
  name: string;
  url?: string;
  logoUrl?: string; // square preferred
  type?: "Organization";
};

export type RecipeJsonLdOptions = {
  siteUrl: string; // e.g., https://sourkimchi.com
  url?: string; // absolute page URL; defaults to siteUrl + /recipes/:slug
  author?: AuthorLike;
  publisher?: PublisherLike;
  language?: string; // e.g., 'en'
};

/* =========================
   Public API
   ========================= */

export function recipeToJsonLd(recipe: RecipeLike, opts: RecipeJsonLdOptions) {
  const url = opts.url ?? safeJoinUrl(opts.siteUrl, `/recipes/${recipe.slug}`);
  const totalSec = coalesceNumber(
    recipe.totalTimeSec,
    (recipe.prepTimeSec ?? 0) +
      (recipe.cookTimeSec ?? 0) +
      (recipe.restTimeSec ?? 0)
  );

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    description: recipe.description || undefined,
    inLanguage: opts.language || undefined,
    url,
    mainEntityOfPage: url,
    image: recipe.heroImageUrl || undefined,
    recipeCuisine: recipe.cuisine || undefined,
    recipeCategory: recipe.category || undefined,
    keywords:
      recipe.tags && recipe.tags.length ? recipe.tags.join(", ") : undefined,
    recipeYield: isFiniteNumber(recipe.servings)
      ? `${recipe.servings} servings`
      : undefined,
    totalTime: isoDuration(totalSec),
    prepTime: isoDuration(recipe.prepTimeSec),
    cookTime: isoDuration(recipe.cookTimeSec),
    // schema doesn't have restTime for Recipe, but supported in HowTo; omit or put in total
    datePublished: toIso(recipe.createdAt),
    dateModified: toIso(recipe.updatedAt),
    recipeIngredient: flattenIngredients(recipe.sections),
    recipeInstructions: recipe.steps.map((s) => stepToHowToStep(s, url)),
    tool:
      recipe.equipment && recipe.equipment.length
        ? recipe.equipment.map((t) => ({ "@type": "HowToTool", name: t }))
        : undefined,
    nutrition: recipe.nutrition
      ? nutritionToJsonLd(recipe.nutrition)
      : undefined,
    aggregateRating: recipe.rating ? ratingToJsonLd(recipe.rating) : undefined,
    author: opts.author
      ? {
          "@type": opts.author.type ?? "Person",
          name: opts.author.name,
          url: opts.author.url,
        }
      : undefined,
    publisher: opts.publisher
      ? {
          "@type": opts.publisher.type ?? "Organization",
          name: opts.publisher.name,
          url: opts.publisher.url,
          logo: opts.publisher.logoUrl
            ? {
                "@type": "ImageObject",
                url: opts.publisher.logoUrl,
              }
            : undefined,
        }
      : undefined,
  };

  // Clean undefineds
  return stripUndefined(jsonLd);
}

/* Optional helpers for creator and collections JSON-LD (nice for /discover pages) */

export type CreatorLike = {
  displayName: string;
  url: string;
  avatarUrl?: string | null;
  sameAs?: string[]; // other profiles
  type?: "Person" | "Organization";
};

export function creatorToJsonLd(creator: CreatorLike) {
  return stripUndefined({
    "@context": "https://schema.org",
    "@type": creator.type ?? "Person",
    name: creator.displayName,
    url: creator.url,
    image: creator.avatarUrl || undefined,
    sameAs:
      creator.sameAs && creator.sameAs.length ? creator.sameAs : undefined,
  });
}

export type CollectionLike = {
  title: string;
  url: string;
  description?: string | null;
  items: { name: string; url: string }[];
};

export function collectionToItemListJsonLd(collection: CollectionLike) {
  return stripUndefined({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: collection.title,
    description: collection.description || undefined,
    url: collection.url,
    itemListElement: collection.items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Thing",
        name: it.name,
        url: it.url,
      },
    })),
  });
}

/* =========================
   Internals
   ========================= */

function stepToHowToStep(s: StepLike, pageUrl: string) {
  const anchor = `${pageUrl}#step-${s.idx + 1}`;
  return stripUndefined({
    "@type": "HowToStep",
    position: s.idx + 1,
    name: `Step ${s.idx + 1}`,
    text: s.text,
    url: anchor,
    image: s.imageUrl || undefined,
    duration: isoDuration(s.durationSec),
  });
}

function nutritionToJsonLd(n: NutritionLike) {
  return stripUndefined({
    "@type": "NutritionInformation",
    calories: isFiniteNumber(n.calories) ? `${n.calories} calories` : undefined,
    proteinContent: toGramString(n.proteinG),
    fatContent: toGramString(n.fatG),
    carbohydrateContent: toGramString(n.carbsG),
    fiberContent: toGramString(n.fiberG),
    sugarContent: toGramString(n.sugarG),
    sodiumContent: isFiniteNumber(n.sodiumMg) ? `${n.sodiumMg} mg` : undefined,
  });
}

function ratingToJsonLd(r: RatingLike) {
  // Google's rich results expect ratingCount and ratingValue
  return stripUndefined({
    "@type": "AggregateRating",
    ratingValue: clamp(roundTo(r.average, 0.01), 0, 5),
    ratingCount: Math.max(0, Math.floor(r.count)),
    bestRating: 5,
    worstRating: 0,
  });
}

function flattenIngredients(sections: IngredientSectionLike[]): string[] {
  const lines: string[] = [];
  for (const sec of sections || []) {
    for (const ing of sec.ingredients || []) {
      const parts: string[] = [];
      if (isFiniteNumber(ing.quantity)) parts.push(formatQty(ing.quantity!));
      if (ing.unit) parts.push(ing.unit);
      parts.push(ing.name);
      if (ing.preparation) parts.push(`(${ing.preparation})`);
      const line = parts.join(" ").trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

function isoDuration(sec?: number | null): string | undefined {
  if (!isFiniteNumber(sec) || sec! <= 0) return undefined;
  const s = Math.floor(sec!);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  let out = "PT";
  if (h) out += `${h}H`;
  if (m) out += `${m}M`;
  if (r || (!h && !m)) out += `${r}S`;
  return out;
}

function toIso(d: Maybe<Date | string>): string | undefined {
  if (!d) return undefined;
  const dt = typeof d === "string" ? new Date(d) : d;
  const iso = dt.toISOString?.() ?? "";
  return iso || undefined;
}

function toGramString(n?: number | null) {
  return isFiniteNumber(n) ? `${roundTo(n!, 0.01)} g` : undefined;
}

function formatQty(n: number): string {
  // Prefer mixed fractions for common cooking denominators when 0 < frac < 1
  const whole = Math.trunc(n);
  const frac = Math.abs(n - whole);
  if (frac === 0) return String(whole);

  // Try 1/2, 1/3, 2/3, 1/4, 3/4, 1/8, 3/8, 5/8, 7/8
  const candidates = [2, 3, 4, 8];
  let best = { d: 1, n: 0, err: Infinity };
  for (const d of candidates) {
    const num = Math.round(frac * d);
    const err = Math.abs(frac - num / d);
    if (num > 0 && err < best.err) best = { d, n: num, err };
  }
  if (best.n && best.err < 0.02) {
    if (best.n === best.d) return String(whole + (n >= 0 ? 1 : -1));
    const fracStr = `${best.n}/${best.d}`;
    return whole ? `${whole} ${fracStr}` : n < 0 ? `-${fracStr}` : fracStr;
  }
  // Fallback to 2-decimal
  return roundTo(n, 0.01).toString();
}

function isFiniteNumber(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function coalesceNumber(
  ...vals: (number | null | undefined)[]
): number | undefined {
  for (const v of vals) {
    if (isFiniteNumber(v) && v! > 0) return v!;
  }
  return undefined;
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) =>
        v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)
    )
  ) as T;
}

function roundTo(n: number, step = 1): number {
  return Math.round(n / step) * step;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function safeJoinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

/* =========================
   Convenience: stringify
   ========================= */

// Use this if you want to inline into <Script type="application/ld+json" />
export function stringifyJsonLd(data: unknown): string {
  return JSON.stringify(data, null, 0);
}
