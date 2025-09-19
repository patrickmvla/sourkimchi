import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  numeric,
  pgEnum,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const unitEnum = pgEnum("unit", [
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "oz",
  "lb",
  "piece",
  "clove",
  "pinch",
  "dash",
]);

export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);

export const recipes = pgTable(
  "recipes",
  {
    id: text("id").primaryKey(), // nanoid/cuid
    slug: varchar("slug", { length: 180 }).notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    cuisine: varchar("cuisine", { length: 120 }),
    category: varchar("category", { length: 120 }),
    difficulty: difficultyEnum("difficulty"),
    heroImageUrl: text("hero_image_url"),
    servings: integer("servings"),
    // times in seconds
    prepTimeSec: integer("prep_time_sec"),
    cookTimeSec: integer("cook_time_sec"),
    restTimeSec: integer("rest_time_sec"),
    totalTimeSec: integer("total_time_sec"),
    // store some equipment hints (freeform)
    equipment: text("equipment").array(),
    isPublic: boolean("is_public").notNull().default(true),
    // Clerk user id of the author (no FK, Clerk-hosted)
    authorId: text("author_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("recipes_slug_uq").on(t.slug),
  })
);

// Ingredient sections (e.g., "Dough", "Sauce")
export const recipeSections = pgTable("recipe_sections", {
  id: text("id").primaryKey(),
  recipeId: text("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 120 }),
  position: integer("position").notNull(), // 0..n
});

// Ingredients (belong to a section)
export const recipeIngredients = pgTable("recipe_ingredients", {
  id: text("id").primaryKey(),
  sectionId: text("section_id")
    .notNull()
    .references(() => recipeSections.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }), // best-effort parsing
  unit: unitEnum("unit"),
  preparation: varchar("preparation", { length: 120 }),
  optional: boolean("optional").notNull().default(false),
  alternatives: text("alternatives").array(),
  measureRaw: varchar("measure_raw", { length: 200 }), // original measure text
});

// Steps
export const recipeSteps = pgTable("recipe_steps", {
  id: text("id").primaryKey(),
  recipeId: text("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(), // 0..n
  text: text("text").notNull(),
  durationSec: integer("duration_sec"),
  imageUrl: text("image_url"),
});

// Nutrition (1:1 with recipe)
export const nutrition = pgTable(
  "nutrition",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    calories: integer("calories"),
    proteinG: numeric("protein_g", { precision: 10, scale: 2 }),
    fatG: numeric("fat_g", { precision: 10, scale: 2 }),
    carbsG: numeric("carbs_g", { precision: 10, scale: 2 }),
    fiberG: numeric("fiber_g", { precision: 10, scale: 2 }),
    sugarG: numeric("sugar_g", { precision: 10, scale: 2 }),
    sodiumMg: integer("sodium_mg"),
  },
  (t) => ({
    recipeUnique: uniqueIndex("nutrition_recipe_uq").on(t.recipeId),
  })
);

// Tags and join table
export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
  },
  (t) => ({
    tagNameUq: uniqueIndex("tags_name_uq").on(t.name),
    tagSlugUq: uniqueIndex("tags_slug_uq").on(t.slug),
  })
);

export const recipeTags = pgTable(
  "recipe_tags",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.recipeId, t.tagId] }),
  })
);

// Reviews (simple; userId is Clerk id)
export const reviews = pgTable("reviews", {
  id: text("id").primaryKey(),
  recipeId: text("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  stars: integer("stars").notNull(), // 1..5 (validate in app layer)
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Favorites (save recipe)
export const favorites = pgTable(
  "favorites",
  {
    userId: text("user_id").notNull(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.recipeId] }),
  })
);

// Private recipe notes per user
export const recipeNotes = pgTable("recipe_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  recipeId: text("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations
export const recipesRelations = relations(recipes, ({ many, one }) => ({
  sections: many(recipeSections),
  steps: many(recipeSteps),
  tags: many(recipeTags),
  reviews: many(reviews),
  favorites: many(favorites),
  notes: many(recipeNotes),
  nutrition: one(nutrition, {
    fields: [recipes.id],
    references: [nutrition.recipeId],
  }),
}));

export const recipeSectionsRelations = relations(
  recipeSections,
  ({ one, many }) => ({
    recipe: one(recipes, {
      fields: [recipeSections.recipeId],
      references: [recipes.id],
    }),
    ingredients: many(recipeIngredients),
  })
);

export const recipeIngredientsRelations = relations(
  recipeIngredients,
  ({ one }) => ({
    section: one(recipeSections, {
      fields: [recipeIngredients.sectionId],
      references: [recipeSections.id],
    }),
  })
);

export const recipeStepsRelations = relations(recipeSteps, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeSteps.recipeId],
    references: [recipes.id],
  }),
}));

export const nutritionRelations = relations(nutrition, ({ one }) => ({
  recipe: one(recipes, {
    fields: [nutrition.recipeId],
    references: [recipes.id],
  }),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeTags.recipeId],
    references: [recipes.id],
  }),
  tag: one(tags, {
    fields: [recipeTags.tagId],
    references: [tags.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  recipe: one(recipes, {
    fields: [reviews.recipeId],
    references: [recipes.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  recipe: one(recipes, {
    fields: [favorites.recipeId],
    references: [recipes.id],
  }),
}));

export const recipeNotesRelations = relations(recipeNotes, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeNotes.recipeId],
    references: [recipes.id],
  }),
}));

// Types
export type Recipe = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cuisine: string | null;
  category: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  heroImageUrl: string | null;
  servings: number | null;
  prepTimeSec: number | null;
  cookTimeSec: number | null;
  restTimeSec: number | null;
  totalTimeSec: number | null;
  equipment: string[] | null;
  isPublic: boolean;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};
