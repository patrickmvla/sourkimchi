CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'piece', 'clove', 'pinch', 'dash');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('youtube', 'instagram', 'website');--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_recipe_id_pk" PRIMARY KEY("user_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE "nutrition" (
	"id" text PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"calories" integer,
	"protein_g" numeric(10, 2),
	"fat_g" numeric(10, 2),
	"carbs_g" numeric(10, 2),
	"fiber_g" numeric(10, 2),
	"sugar_g" numeric(10, 2),
	"sodium_mg" integer
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"position" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"quantity" numeric(10, 3),
	"unit" "unit",
	"preparation" varchar(120),
	"optional" boolean DEFAULT false NOT NULL,
	"alternatives" text[],
	"measure_raw" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "recipe_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"title" varchar(120),
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"idx" integer NOT NULL,
	"text" text NOT NULL,
	"duration_sec" integer,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "recipe_tags" (
	"recipe_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "recipe_tags_recipe_id_tag_id_pk" PRIMARY KEY("recipe_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(180) NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"cuisine" varchar(120),
	"category" varchar(120),
	"difficulty" "difficulty",
	"hero_image_url" text,
	"servings" integer,
	"prep_time_sec" integer,
	"cook_time_sec" integer,
	"rest_time_sec" integer,
	"total_time_sec" integer,
	"equipment" text[],
	"is_public" boolean DEFAULT true NOT NULL,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"recipe_id" text NOT NULL,
	"user_id" text NOT NULL,
	"stars" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_creators" (
	"collection_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "collection_creators_collection_id_creator_id_pk" PRIMARY KEY("collection_id","creator_id")
);
--> statement-breakpoint
CREATE TABLE "creator_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(180) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"cover_image_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subscribers" integer,
	"followers" integer,
	"video_count" integer,
	"post_count" integer
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(180) NOT NULL,
	"platform" "platform" NOT NULL,
	"handle" varchar(120) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"url" text NOT NULL,
	"external_id" varchar(128),
	"avatar_url" text,
	"banner_url" text,
	"tagline" varchar(160),
	"love_note" text,
	"tags" text[],
	"cuisines" text[],
	"country" varchar(2),
	"language" varchar(5),
	"start_here" jsonb,
	"links" jsonb,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_rank" integer,
	"latest_embed_url" text,
	"latest_thumb_url" text,
	"latest_title" varchar(240),
	"latest_published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition" ADD CONSTRAINT "nutrition_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_section_id_recipe_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."recipe_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_notes" ADD CONSTRAINT "recipe_notes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_sections" ADD CONSTRAINT "recipe_sections_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_creators" ADD CONSTRAINT "collection_creators_collection_id_creator_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."creator_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_creators" ADD CONSTRAINT "collection_creators_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_stats" ADD CONSTRAINT "creator_stats_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_recipe_uq" ON "nutrition" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_slug_uq" ON "recipes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_uq" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_uq" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_collections_slug_uq" ON "creator_collections" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_slug_uq" ON "creators" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_platform_handle_uq" ON "creators" USING btree ("platform","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_platform_external_id_uq" ON "creators" USING btree ("platform","external_id");