/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import { db } from "../../src/db/client";
import {
  recipeIngredients,
  recipes,
  recipeSections,
  recipeSteps,
  recipeTags,
  tags as tagsTable,
} from "../../src/db/schema";
import { cuid } from "../lib/ids";
import { slugify } from "../lib/slugify";

type DbClient = typeof db;

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

type DatabaseOrTransactionClient = DbClient | TransactionClient;

type Meal = {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  strTags: string | null;

  strSource: string | null;
  [k: `strIngredient${number}`]: string | null;
  [k: `strMeasure${number}`]: string | null;
};

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

async function fetchMealsByLetter(letter: string): Promise<Meal[]> {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?f=${letter}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`Fetch failed for ${letter}: ${res.status}`);
    return [];
  }
  const json = await res.json();
  return (json.meals ?? []) as Meal[];
}

const FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅐": 1 / 7,
  "⅑": 1 / 9,
  "⅒": 0.1,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};

function normalizeUnit(
  u?: string
):
  | typeof import("../../src/db/schema").unitEnum["enumValues"][number]
  | undefined {
  if (!u) return undefined;
  const s = u.toLowerCase().replace(/[.,]/g, "");
  const map: Record<string, any> = {
    tsp: "tsp",
    tsps: "tsp",
    teaspoon: "tsp",
    teaspoons: "tsp",
    tbsp: "tbsp",
    tbs: "tbsp",
    tblsp: "tbsp",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    cup: "cup",
    cups: "cup",
    g: "g",
    gram: "g",
    grams: "g",
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    ml: "ml",
    milliliter: "ml",
    milliliters: "ml",
    millilitre: "ml",
    millilitres: "ml",
    l: "l",
    liter: "l",
    liters: "l",
    litre: "l",
    litres: "l",
    oz: "oz",
    ounce: "oz",
    ounces: "oz",
    lb: "lb",
    lbs: "lb",
    pound: "lb",
    pounds: "lb",
    clove: "clove",
    cloves: "clove",
    piece: "piece",
    pieces: "piece",
    pinch: "pinch",
    pinches: "pinch",
    dash: "dash",
    dashes: "dash",
  };
  return map[s];
}

function parseQuantityUnit(measureRaw?: string | null): {
  quantity?: number;
  unit?: string;
} {
  if (!measureRaw) return {};
  let s = measureRaw.trim().replace(/\s+/g, " ");
  if (!s || /to taste|as needed/i.test(s))
    return { quantity: undefined, unit: undefined };

  const embedded = s.match(
    /^(\d+)?([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/
  ) as RegExpMatchArray | null;
  let qty = 0;
  if (embedded) {
    const whole = embedded[1] ? Number(embedded[1]) : 0;
    const frac = FRACTIONS[embedded[2]] ?? 0;
    qty = whole + frac;
    s = s.slice(embedded[0].length).trim();
  } else {
    const m = s.match(/^(\d+)(?:\s+(\d+)\/(\d+))?|^(\d+)\/(\d+)/);
    if (m) {
      if (m[1]) {
        qty += Number(m[1]);
        if (m[2] && m[3] && Number(m[3])) qty += Number(m[2]) / Number(m[3]);
        s = s.slice(m[0].length).trim();
      } else if (m[4] && m[5] && Number(m[5])) {
        qty += Number(m[4]) / Number(m[5]);
        s = s.slice(m[0].length).trim();
      }
    }
    if (qty === 0 && /^[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/.test(s)) {
      const f = s[0];
      qty = FRACTIONS[f] ?? 0;
      s = s.slice(1).trim();
    }
  }
  if (qty === 0) qty = NaN;

  let unitToken = s.split(" ")[0];
  unitToken = unitToken?.replace(/[.,]/g, "");
  const bad = new Set(["", "of", "about", "large", "small"]);
  const normalized = normalizeUnit(unitToken);
  const unit = bad.has(unitToken?.toLowerCase()) ? undefined : normalized;

  return {
    quantity: Number.isFinite(qty) ? qty : undefined,
    unit,
  };
}

function splitInstructions(text?: string | null): string[] {
  if (!text) return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const steps: string[] = [];
  for (const line of lines) {
    if (line.length > 160) {
      steps.push(
        ...line
          .split(/(?<=[.!?])\s+(?=[A-Z])/)
          .map((s) => s.trim())
          .filter(Boolean)
      );
    } else {
      steps.push(line);
    }
  }
  return steps
    .map((s) => s.replace(/^(step\s*)?\d+[:.)-]\s*/i, "").trim())
    .filter(Boolean);
}

function parseTags(csv?: string | null): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

async function ensureTags(
  names: string[],
  tx: DatabaseOrTransactionClient = db
): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const slug = slugify(name);
    let tag = await tx.query.tags.findFirst({
      where: (t, { eq }) => eq(t.slug, slug),
      columns: { id: true },
    });
    if (!tag) {
      const id = cuid();
      try {
        await tx.insert(tagsTable).values({ id, name, slug });
        ids.push(id);
        continue;
      } catch {
        tag = await tx.query.tags.findFirst({
          where: (t, { eq }) => eq(t.slug, slug),
          columns: { id: true },
        });
      }
    }
    if (tag) ids.push(tag.id);
  }
  return ids;
}

function mealToIngredientPairs(meal: Meal) {
  const out: { name: string; measure: string | null }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal as any)[`strIngredient${i}`] as string | null;
    const measure = (meal as any)[`strMeasure${i}`] as string | null;
    if (name && name.trim()) {
      out.push({ name: name.trim(), measure: measure ?? null });
    }
  }
  return out;
}

async function upsertMeal(meal: Meal) {
  const baseSlug = slugify(meal.strMeal);
  let slug = baseSlug;
  let suffix = 1;

  while (
    await db.query.recipes.findFirst({ where: (r, { eq }) => eq(r.slug, slug) })
  ) {
    slug = `${baseSlug}-${suffix++}`;
  }

  await db.transaction(async (tx) => {
    const recipeId = cuid();

    await tx
      .insert(recipes)
      .values({
        id: recipeId,
        slug,
        title: meal.strMeal,
        description: null,
        cuisine: meal.strArea ?? null,
        category: meal.strCategory ?? null,
        difficulty: null,
        heroImageUrl: meal.strMealThumb ?? null,
        servings: null,
        prepTimeSec: null,
        cookTimeSec: null,
        restTimeSec: null,
        totalTimeSec: null,
        equipment: null,
        isPublic: true,
        authorId: null,
      })
      .execute();

    const sectionId = cuid();
    await tx
      .insert(recipeSections)
      .values({
        id: sectionId,
        recipeId,
        title: null,
        position: 0,
      })
      .execute();

    const ingPairs = mealToIngredientPairs(meal);
    if (ingPairs.length) {
      await tx
        .insert(recipeIngredients)
        .values(
          ingPairs.map((x, i) => {
            const parsed = parseQuantityUnit(x.measure);
            return {
              id: cuid(),
              sectionId,
              position: i,
              name: x.name,

              quantity:
                parsed.quantity != null ? String(parsed.quantity) : null,
              unit: (parsed.unit as any) ?? null,
              preparation: null,
              optional: false,
              alternatives: [],
              measureRaw: x.measure ?? null,
            };
          })
        )
        .execute();
    }

    const steps = splitInstructions(meal.strInstructions);
    if (steps.length) {
      await tx
        .insert(recipeSteps)
        .values(
          steps.map((text, i) => ({
            id: cuid(),
            recipeId,
            idx: i,
            text,
            durationSec: null,
            imageUrl: null,
          }))
        )
        .execute();
    }

    const tagNames = parseTags(meal.strTags);
    if (tagNames.length) {
      const tagIds = await ensureTags(tagNames, tx);
      for (const tagId of tagIds) {
        await tx
          .insert(recipeTags)
          .values({ recipeId, tagId })
          .onConflictDoNothing()
          .execute();
      }
    }

    console.log(`Imported: ${meal.strMeal}`);
  });
}

async function main() {
  console.log("Importing recipes from TheMealDB...");
  for (const l of LETTERS) {
    const meals = await fetchMealsByLetter(l);
    for (const m of meals) {
      try {
        const maybeSlug = slugify(m.strMeal);

        const exists = await db.query.recipes.findFirst({
          where: (r, { eq }) => eq(r.slug, maybeSlug),
          columns: { id: true },
        });
        if (exists) {
          continue;
        }
        await upsertMeal(m);
      } catch (e) {
        console.warn("Failed to import", m.idMeal, m.strMeal, e);
      }
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
