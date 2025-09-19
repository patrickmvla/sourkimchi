import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const platformEnum = pgEnum("platform", [
  "youtube",
  "instagram",
  "website",
]);

// Types for JSON fields
export type StartHereItem = {
  title: string;
  url: string;
  platform: "youtube" | "instagram" | "website";
  note?: string;
  thumbUrl?: string; // e.g., YT thumb or IG post thumb
  videoId?: string; // YT video id for embeds (optional)
};

export type CreatorLink = {
  label?: string;
  kind?: "website" | "shop" | "patreon" | "newsletter" | "course";
  url: string;
};

// Creators (curated + editorial fields)
export const creators = pgTable(
  "creators",
  {
    id: text("id").primaryKey(), // nanoid/cuid
    slug: varchar("slug", { length: 180 }).notNull(),

    platform: platformEnum("platform").notNull(),
    handle: varchar("handle", { length: 120 }).notNull(), // '@handle' or channel handle
    displayName: varchar("display_name", { length: 200 }).notNull(),
    url: text("url").notNull(),
    externalId: varchar("external_id", { length: 128 }), // YT channelId or IG user id (optional)

    avatarUrl: text("avatar_url"),
    bannerUrl: text("banner_url"),

    // Editorial
    tagline: varchar("tagline", { length: 160 }),
    loveNote: text("love_note"),
    tags: text("tags").array(), // ['baking','heritage','science']
    cuisines: text("cuisines").array(), // ['korean','italian']
    country: varchar("country", { length: 2 }),
    language: varchar("language", { length: 5 }),

    // Curated “Start here” picks (2–3 recommended links)
    startHere: jsonb("start_here").$type<StartHereItem[]>(),

    // Optional extra links
    links: jsonb("links").$type<CreatorLink[]>(),

    // Curation flags
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredRank: integer("featured_rank"),

    // Convenience fields for latest content (e.g., from YT RSS)
    latestEmbedUrl: text("latest_embed_url"),
    latestThumbUrl: text("latest_thumb_url"),
    latestTitle: varchar("latest_title", { length: 240 }),
    latestPublishedAt: timestamp("latest_published_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugUq: uniqueIndex("creators_slug_uq").on(t.slug),
    platformHandleUq: uniqueIndex("creators_platform_handle_uq").on(
      t.platform,
      t.handle
    ),
    platformExternalIdUq: uniqueIndex("creators_platform_external_id_uq").on(
      t.platform,
      t.externalId
    ),
  })
);

// Optional: creator stats snapshots (if you want to store subs/followers)
export const creatorStats = pgTable("creator_stats", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => creators.id, { onDelete: "cascade" }),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  subscribers: integer("subscribers"),
  followers: integer("followers"),
  videoCount: integer("video_count"),
  postCount: integer("post_count"),
});

// Curated collections (e.g., "Heritage cooking", "Baking masters")
export const creatorCollections = pgTable(
  "creator_collections",
  {
    id: text("id").primaryKey(),
    slug: varchar("slug", { length: 180 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugUq: uniqueIndex("creator_collections_slug_uq").on(t.slug),
  })
);

// Join table: creators in a collection with an explicit order
export const collectionCreators = pgTable(
  "collection_creators",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => creatorCollections.id, { onDelete: "cascade" }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.collectionId, t.creatorId] }),
  })
);

// Relations
export const creatorsRelations = relations(creators, ({ many }) => ({
  stats: many(creatorStats),
  collectionLinks: many(collectionCreators),
}));

export const creatorStatsRelations = relations(creatorStats, ({ one }) => ({
  creator: one(creators, {
    fields: [creatorStats.creatorId],
    references: [creators.id],
  }),
}));

export const creatorCollectionsRelations = relations(
  creatorCollections,
  ({ many }) => ({
    items: many(collectionCreators),
  })
);

export const collectionCreatorsRelations = relations(
  collectionCreators,
  ({ one }) => ({
    collection: one(creatorCollections, {
      fields: [collectionCreators.collectionId],
      references: [creatorCollections.id],
    }),
    creator: one(creators, {
      fields: [collectionCreators.creatorId],
      references: [creators.id],
    }),
  })
);

// Handy types
export type Creator = {
  id: string;
  slug: string;
  platform: "youtube" | "instagram" | "website";
  handle: string;
  displayName: string;
  url: string;
  externalId: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  tagline: string | null;
  loveNote: string | null;
  tags: string[] | null;
  cuisines: string[] | null;
  country: string | null;
  language: string | null;
  startHere: StartHereItem[] | null;
  links: CreatorLink[] | null;
  isFeatured: boolean;
  featuredRank: number | null;
  latestEmbedUrl: string | null;
  latestThumbUrl: string | null;
  latestTitle: string | null;
  latestPublishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatorCollection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
};
