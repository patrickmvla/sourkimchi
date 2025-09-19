// app/admin/creators/new/page.tsx
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import {
    creators,
    type CreatorLink,
    type StartHereItem,
} from "@/db/creator-schema";
import { requireAdmin } from "@/lib/auth";
import { cuid } from "@/lib/ids";
import { slugify } from "@/lib/slugify";
import { videoIdFromUrl, thumbUrl as ytThumbUrl } from "@/lib/yt";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

/* 
  Admin: Add Creator
  - Simple server-action form (no client JS required)
  - JSON fields (startHere, links) accepted as JSON arrays
  - Tags/cuisines as comma-separated lists
*/

export const revalidate = 0;

export default async function AdminCreatorNewPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Add creator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Curate a YouTube channel, Instagram account, or website you love. You
          can update details later.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium">Creator details</div>
        </CardHeader>
        <CardContent>
          <form action={createCreatorAction} className="space-y-5">
            {/* Platform, Display name, Handle */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Platform
                </label>
                <Select name="platform" defaultValue="youtube">
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted-foreground">
                  Display name
                </label>
                <Input name="displayName" placeholder="Bon Appétit" required />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Handle
                </label>
                <Input name="handle" placeholder="@BonAppetitDotCom" required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Profile URL
                </label>
                <Input
                  name="url"
                  placeholder="https://www.youtube.com/@BonAppetitDotCom"
                  required
                />
              </div>
            </div>

            {/* Optional IDs and images */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  External ID (YouTube channelId)
                </label>
                <Input
                  name="externalId"
                  placeholder="UCxxxxx (optional; improves RSS refresh)"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Avatar URL
                </label>
                <Input name="avatarUrl" placeholder="https://…" />
              </div>
            </div>

            {/* Editorial fields */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Tagline
                </label>
                <Input
                  name="tagline"
                  placeholder="Test kitchen energy — variety, technique, and fun."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Why we love them
                </label>
                <Textarea
                  name="loveNote"
                  placeholder="A sentence or two about why this creator is great."
                  rows={3}
                />
              </div>
            </div>

            {/* Tags / cuisines / locale */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Tags (comma-separated)
                </label>
                <Input name="tagsCsv" placeholder="baking, technique, series" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Cuisines (comma-separated)
                </label>
                <Input name="cuisinesCsv" placeholder="italian, korean" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Country (ISO-2)
                  </label>
                  <Input name="country" placeholder="US" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Language
                  </label>
                  <Input name="language" placeholder="en" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Start here JSON */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">
                  Start here (JSON array)
                </label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <Textarea
                name="startHereJson"
                rows={6}
                placeholder={`[
  { "title": "Great intro video", "url": "https://www.youtube.com/watch?v=VIDEOID", "platform": "youtube", "note": "Start here!", "thumbUrl": "" },
  { "title": "Popular post", "url": "https://www.instagram.com/p/...", "platform": "instagram" }
]`}
              />
              <p className="text-xs text-muted-foreground">
                Tip: For YouTube links, we’ll auto-fill thumbnails if missing.
              </p>
            </div>

            {/* Links JSON */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">
                  Links (JSON array)
                </label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <Textarea
                name="linksJson"
                rows={4}
                placeholder={`[
  { "label": "Website", "kind": "website", "url": "https://example.com" },
  { "label": "Patreon", "kind": "patreon", "url": "https://patreon.com/..." }
]`}
              />
            </div>

            {/* Featured controls */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <Checkbox id="isFeatured" name="isFeatured" />
                <label htmlFor="isFeatured" className="text-sm">
                  Featured
                </label>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Featured rank
                </label>
                <Input
                  name="featuredRank"
                  type="number"
                  min={0}
                  placeholder="e.g., 1"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="submit">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

/* =========================
   Server action
   ========================= */

async function createCreatorAction(formData: FormData) {
  "use server";
  await requireAdmin();

  // Extract/normalize
  const platform = str(formData.get("platform")) as
    | "youtube"
    | "instagram"
    | "website";
  const displayName = str(formData.get("displayName"));
  const handle = str(formData.get("handle"));
  const url = str(formData.get("url"));
  const externalId = strOpt(formData.get("externalId"));
  const avatarUrl = strOpt(formData.get("avatarUrl"));
  const tagline = strOpt(formData.get("tagline"));
  const loveNote = strOpt(formData.get("loveNote"));
  const tagsCsv = strOpt(formData.get("tagsCsv"));
  const cuisinesCsv = strOpt(formData.get("cuisinesCsv"));
  const country = strOpt(formData.get("country"));
  const language = strOpt(formData.get("language"));
  const startHereJson = strOpt(formData.get("startHereJson"));
  const linksJson = strOpt(formData.get("linksJson"));
  const isFeatured = bool(formData.get("isFeatured"));
  const featuredRank = intOpt(formData.get("featuredRank"));

  if (!platform || !displayName || !handle || !url) {
    throw new Error(
      "Missing required fields: platform, displayName, handle, url"
    );
  }
  if (!["youtube", "instagram", "website"].includes(platform)) {
    throw new Error("Invalid platform");
  }

  // Parse arrays
  const tagsArr = csvToArray(tagsCsv);
  const cuisinesArr = csvToArray(cuisinesCsv);

  let startHere: StartHereItem[] | undefined = undefined;
  if (startHereJson) {
    try {
      const parsed = JSON.parse(startHereJson) as StartHereItem[];
      startHere = enrichStartHere(parsed);
    } catch {
      throw new Error("Invalid JSON in Start here");
    }
  }

  let links: CreatorLink[] | undefined = undefined;
  if (linksJson) {
    try {
      links = JSON.parse(linksJson) as CreatorLink[];
    } catch {
      throw new Error("Invalid JSON in Links");
    }
  }

  // Unique slug: platform + displayName
  const base = slugify(`${platform}-${displayName}`);
  const slug = await uniqueCreatorSlug(base);

  const id = cuid();
  const now = new Date();

  await db.insert(creators).values({
    id,
    slug,
    platform,
    handle,
    displayName,
    url,
    externalId: externalId ?? null,
    avatarUrl: avatarUrl ?? null,
    bannerUrl: null,
    tagline: tagline ?? null,
    loveNote: loveNote ?? null,
    tags: tagsArr,
    cuisines: cuisinesArr,
    country: country ?? null,
    language: language ?? null,
    startHere: startHere ?? [],
    links: links ?? [],
    isFeatured: isFeatured ?? false,
    featuredRank: featuredRank ?? null,
    latestEmbedUrl: null,
    latestThumbUrl: null,
    latestTitle: null,
    latestPublishedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Revalidate discover pages
  revalidatePath("/discover");
  revalidatePath("/discover/youtube");
  revalidatePath("/discover/instagram");

  redirect("/admin/creators");
}

/* =========================
   Helpers
   ========================= */

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}
function strOpt(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}
function intOpt(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
function bool(v: FormDataEntryValue | null): boolean {
  // Checkbox: 'on' when checked, null otherwise
  return String(v ?? "") === "on";
}
function csvToArray(csv: string | null): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

async function uniqueCreatorSlug(base: string): Promise<string> {
  let slug = base;
  let i = 2;

  while (
    await db.query.creators.findFirst({
      where: (t, { eq }) => eq(t.slug, slug),
    })
  ) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

function enrichStartHere(items: StartHereItem[]): StartHereItem[] {
  return items.map((it) => {
    if (it.platform === "youtube") {
      const vid =
        (it["videoId" as keyof StartHereItem] as unknown as
          | string
          | undefined) ||
        videoIdFromUrl(it.url) ||
        undefined;
      const thumb = it.thumbUrl || (vid ? ytThumbUrl(vid, "hq") : undefined);
      return { ...it, thumbUrl: thumb };
    }
    return it;
  });
}
