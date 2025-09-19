// app/admin/collections/page.tsx
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Link from "next/link";

import { db } from "@/db/client";
import {
  collectionCreators,
  creatorCollections,
  creators,
} from "@/db/creator-schema";
import { requireAdmin } from "@/lib/auth";
import { cuid } from "@/lib/ids";
import { slugify } from "@/lib/slugify";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const revalidate = 0;

export default async function AdminCollectionsPage() {
  await requireAdmin();

  const [cols, total] = await Promise.all([
    getCollectionsWithItems(),
    countCollections(),
  ]);

  return (
    <main className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Creator collections</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Curate themed groups of creators and control their order.
          </p>
        </div>
        <a href="#new" className={cn(buttonVariants({ variant: "outline" }))}>
          New collection
        </a>
      </div>

      {/* New collection */}
      <Card id="new">
        <CardHeader className="pb-2">
          <div className="text-sm font-medium">Create a new collection</div>
        </CardHeader>
        <CardContent>
          <form
            action={createCollectionAction}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs text-muted-foreground">
                Title
              </label>
              <Input name="title" placeholder="Heritage cooking" required />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs text-muted-foreground">
                Slug (optional)
              </label>
              <Input name="slug" placeholder="heritage-cooking" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">
                Description
              </label>
              <Textarea
                name="description"
                rows={2}
                placeholder="Open-fire, heirloom techniques, and timeless recipes."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">
                Cover image URL (optional)
              </label>
              <Input name="coverImageUrl" placeholder="https://…" />
            </div>
            <div className="sm:col-span-2 flex items-center justify-end gap-2">
              <label className="text-sm">
                <input
                  type="checkbox"
                  name="isFeatured"
                  className="mr-2 align-middle"
                />{" "}
                Featured
              </label>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing collections */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {total} collection{total === 1 ? "" : "s"}
        </div>
      </div>

      {cols.length ? (
        <div className="grid gap-6">
          {cols.map((c) => (
            <CollectionCard key={c.id} col={c} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          No collections yet. Create one above.
        </div>
      )}
    </main>
  );
}

/* =========================
   Cards
   ========================= */

function CollectionCard({
  col,
}: {
  col: Awaited<ReturnType<typeof getCollectionsWithItems>>[number];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{col.title}</div>
            <div className="text-xs text-muted-foreground">
              /discover/{col.slug} • {formatDate(col.updatedAt)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {col.isFeatured ? (
              <Badge>Featured</Badge>
            ) : (
              <Badge variant="secondary">Not featured</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Meta form */}
        <form
          action={updateCollectionMetaAction}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={col.id} />
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Title
            </label>
            <Input name="title" defaultValue={col.title} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Slug
            </label>
            <Input name="slug" defaultValue={col.slug} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">
              Description
            </label>
            <Textarea
              name="description"
              rows={2}
              defaultValue={col.description ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">
              Cover image URL
            </label>
            <Input
              name="coverImageUrl"
              defaultValue={col.coverImageUrl ?? ""}
            />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between">
            <label className="text-sm">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={col.isFeatured}
                className="mr-2 align-middle"
              />{" "}
              Featured
            </label>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm">
                Save meta
              </Button>
              <form action={deleteCollectionAction}>
                <input type="hidden" name="id" value={col.id} />
                <Button type="submit" size="sm" variant="destructive">
                  Delete
                </Button>
              </form>
            </div>
          </div>
        </form>

        <Separator />

        {/* Items (creators) */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">
              Creators ({col.creators.length})
            </div>
            <span className="text-xs text-muted-foreground">
              Drag-and-drop coming later — use positions for now.
            </span>
          </div>

          <form action={reorderCollectionAction}>
            <input type="hidden" name="collectionId" value={col.id} />
            <div className="grid grid-cols-1 gap-2">
              {col.creators.length ? (
                col.creators.map((it) => (
                  <div
                    key={it.creatorId}
                    className="flex items-center gap-2 rounded-lg border p-2"
                  >
                    <Input
                      name={`pos_${it.creatorId}`}
                      defaultValue={String(it.position)}
                      className="w-20"
                      type="number"
                      min={0}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {it.displayName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {it.handle} • {it.platform}
                      </div>
                    </div>
                    <a
                      href={`/creators/${it.slug}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" })
                      )}
                    >
                      View
                    </a>
                    <form action={removeItemAction}>
                      <input type="hidden" name="collectionId" value={col.id} />
                      <input
                        type="hidden"
                        name="creatorId"
                        value={it.creatorId}
                      />
                      <Button type="submit" size="sm" variant="ghost">
                        Remove
                      </Button>
                    </form>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  No creators yet.
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-end">
              <Button type="submit" size="sm">
                Save order
              </Button>
            </div>
          </form>

          {/* Add creator */}
          <div className="mt-4 rounded-lg border p-3">
            <form
              action={addCreatorToCollectionAction}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <input type="hidden" name="collectionId" value={col.id} />
              <div className="sm:flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">
                  Creator (slug or @handle)
                </label>
                <Input
                  name="identifier"
                  placeholder="e.g., youtube-townsends or @JasTownsends"
                />
              </div>
              <div className="sm:w-32">
                <label className="mb-1 block text-xs text-muted-foreground">
                  Position
                </label>
                <Input
                  name="position"
                  type="number"
                  min={0}
                  placeholder={String(col.creators.length + 1)}
                />
              </div>
              <div className="pt-5 sm:pt-0">
                <Button type="submit" size="sm">
                  Add
                </Button>
              </div>
            </form>
            <div className="mt-1 text-xs text-muted-foreground">
              Tip: If position is empty, the creator is added to the end.
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-end">
        <Link
          href="/discover"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          View Discover
        </Link>
      </CardFooter>
    </Card>
  );
}

/* =========================
   Server actions
   ========================= */

async function createCollectionAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const title = str(formData.get("title"));
  const slugInput = strOpt(formData.get("slug"));
  const description = strOpt(formData.get("description"));
  const coverImageUrl = strOpt(formData.get("coverImageUrl"));
  const isFeatured = bool(formData.get("isFeatured"));

  if (!title) throw new Error("Title is required");

  const baseSlug = slugInput ? slugify(slugInput) : slugify(title);
  const slug = await uniqueCollectionSlug(baseSlug);

  const id = cuid();
  const now = new Date();
  await db.insert(creatorCollections).values({
    id,
    slug,
    title,
    description: description ?? null,
    coverImageUrl: coverImageUrl ?? null,
    isFeatured,
    createdAt: now,
    updatedAt: now,
  });

  revalidateAll();
}

async function updateCollectionMetaAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = str(formData.get("id"));
  const title = strOpt(formData.get("title"));
  const slugIn = strOpt(formData.get("slug"));
  const description = strOpt(formData.get("description"));
  const coverImageUrl = strOpt(formData.get("coverImageUrl"));
  const isFeatured = bool(formData.get("isFeatured"));

  if (!id) throw new Error("Missing id");

  // Ensure slug is unique if changed
  let slugUpdate: string | undefined = undefined;
  if (slugIn) {
    const desired = slugify(slugIn);
    const current = await db.query.creatorCollections.findFirst({
      where: (t, { eq }) => eq(t.id, id),
      columns: { slug: true },
    });
    if (!current) throw new Error("Collection not found");
    if (desired !== current.slug) {
      slugUpdate = await uniqueCollectionSlug(desired);
    }
  }

  await db
    .update(creatorCollections)
    .set({
      title: title ?? undefined,
      slug: slugUpdate ?? undefined,
      description: description ?? undefined,
      coverImageUrl: coverImageUrl ?? undefined,
      isFeatured,
      updatedAt: new Date(),
    })
    .where(eq(creatorCollections.id, id));

  revalidateAll();
}

async function deleteCollectionAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing id");

  await db.delete(creatorCollections).where(eq(creatorCollections.id, id));
  revalidateAll();
}

async function addCreatorToCollectionAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const collectionId = str(formData.get("collectionId"));
  const identifier = str(formData.get("identifier")); // slug or @handle
  const position = intOpt(formData.get("position"));

  if (!collectionId || !identifier)
    throw new Error("Missing collectionId or identifier");

  // Resolve creator by slug or handle
  const idBySlug = await db.query.creators.findFirst({
    where: (t, { eq }) => eq(t.slug, identifier),
    columns: { id: true },
  });

  let creatorId: string | null = idBySlug?.id ?? null;

  if (!creatorId && identifier.startsWith("@")) {
    const byHandle = await db.query.creators.findFirst({
      where: (t, { eq }) => eq(t.handle, identifier),
      columns: { id: true },
    });
    creatorId = byHandle?.id ?? null;
  }

  if (!creatorId) {
    throw new Error("Creator not found by slug or handle");
  }

  // If position not provided, append to end
  let pos = position ?? null;
  if (pos == null) {
    const maxRow = await db
      .select({
        m: sql<number>`COALESCE(MAX(${collectionCreators.position}), 0)`,
      })
      .from(collectionCreators)
      .where(eq(collectionCreators.collectionId, collectionId));
    const maxPos = Number(maxRow[0]?.m ?? 0);
    pos = maxPos + 1;
  }

  await db
    .insert(collectionCreators)
    .values({
      collectionId,
      creatorId,
      position: pos,
    })
    .onConflictDoNothing();

  revalidateAll();
}

async function reorderCollectionAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const collectionId = str(formData.get("collectionId"));
  if (!collectionId) throw new Error("Missing collectionId");

  const updates: Array<{ creatorId: string; position: number }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("pos_")) continue;
    const creatorId = key.slice(4);
    const pos = Number(String(value));
    if (Number.isFinite(pos)) updates.push({ creatorId, position: pos });
  }

  // Apply updates
  for (const u of updates) {
    await db
      .update(collectionCreators)
      .set({ position: u.position })
      .where(
        and(
          eq(collectionCreators.collectionId, collectionId),
          eq(collectionCreators.creatorId, u.creatorId)
        )
      );
  }

  revalidateAll();
}

async function removeItemAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const collectionId = str(formData.get("collectionId"));
  const creatorId = str(formData.get("creatorId"));
  if (!collectionId || !creatorId) throw new Error("Missing ids");

  await db
    .delete(collectionCreators)
    .where(
      and(
        eq(collectionCreators.collectionId, collectionId),
        eq(collectionCreators.creatorId, creatorId)
      )
    );

  revalidateAll();
}

/* =========================
   Data
   ========================= */

async function getCollectionsWithItems() {
  const cols = await db
    .select({
      id: creatorCollections.id,
      slug: creatorCollections.slug,
      title: creatorCollections.title,
      description: creatorCollections.description,
      coverImageUrl: creatorCollections.coverImageUrl,
      isFeatured: creatorCollections.isFeatured,
      updatedAt: creatorCollections.updatedAt,
    })
    .from(creatorCollections)
    .orderBy(asc(creatorCollections.title));

  if (!cols.length)
    return [] as Array<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      coverImageUrl: string | null;
      isFeatured: boolean;
      updatedAt: Date | string | null;
      creators: Array<{
        creatorId: string;
        position: number;
        slug: string;
        displayName: string;
        handle: string;
        platform: "youtube" | "instagram" | "website";
      }>;
    }>;

  const ids = cols.map((c) => c.id);

  const items = await db
    .select({
      collectionId: collectionCreators.collectionId,
      position: collectionCreators.position,
      creatorId: creators.id,
      slug: creators.slug,
      displayName: creators.displayName,
      handle: creators.handle,
      platform: creators.platform,
    })
    .from(collectionCreators)
    .innerJoin(creators, eq(collectionCreators.creatorId, creators.id))
    .where(sql`${collectionCreators.collectionId} = ANY(${ids}::text[])`)
    .orderBy(
      asc(collectionCreators.collectionId),
      asc(collectionCreators.position)
    );

  const grouped = new Map<
    string,
    Array<{
      creatorId: string;
      position: number;
      slug: string;
      displayName: string;
      handle: string;
      platform: "youtube" | "instagram" | "website";
    }>
  >();

  for (const it of items) {
    const arr = grouped.get(it.collectionId) ?? [];
    arr.push({
      creatorId: it.creatorId,
      position: it.position,
      slug: it.slug,
      displayName: it.displayName,
      handle: it.handle,
      platform: it.platform,
    });
    grouped.set(it.collectionId, arr);
  }

  return cols.map((c) => ({
    ...c,
    creators: grouped.get(c.id) ?? [],
  }));
}

async function countCollections() {
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(creatorCollections);
  return Number(rows[0]?.c ?? 0);
}

/* =========================
   Helpers
   ========================= */

async function uniqueCollectionSlug(base: string): Promise<string> {
  let slug = base;
  let i = 2;

  while (
    await db.query.creatorCollections.findFirst({
      where: (t, { eq }) => eq(t.slug, slug),
    })
  ) {
    slug = slugify(`${base}-${i++}`);
  }
  return slug;
}

function revalidateAll() {
  revalidatePath("/admin/collections");
  revalidatePath("/discover");
  revalidatePath("/api/creator-collections");
}

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
  return String(v ?? "") === "on";
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
