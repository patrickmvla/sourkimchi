/**
 * Slugify a string into a URL-safe, lowercase, hyphen-separated slug.
 * - Removes diacritics (NFD normalize)
 * - Maps common symbols (& -> and, @ -> at, + -> plus)
 * - Collapses whitespace and punctuation to single hyphens
 * - Trims leading/trailing hyphens
 * - Truncates to maxLength (default 180)
 */
export function slugify(
  input: string,
  opts: { maxLength?: number; fallback?: string } = {}
): string {
  const maxLength = Math.min(Math.max(opts.maxLength ?? 180, 1), 200);
  const fallback = opts.fallback ?? "untitled";

  let s = (input ?? "").toString().trim();
  if (!s) return fallback;

  s = s
    .replace(/&/g, " and ")
    .replace(/@/g, " at ")
    .replace(/\+/g, " plus ")
    .replace(/%/g, " percent ")
    .replace(/#/g, " number ");

  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  s = s.toLowerCase();

  s = s.replace(/['’`]/g, "");

  s = s.replace(/[^a-z0-9]+/g, "-");

  s = s.replace(/-{2,}/g, "-");

  s = s.replace(/^-+|-+$/g, "");

  if (s.length > maxLength) s = s.slice(0, maxLength).replace(/-+$/g, "");

  return s || fallback;
}

/**
 * Generate a unique slug by appending an incrementing suffix (-2, -3, ...)
 * until the provided `exists` checker returns false.
 *
 * Example:
 * const slug = await uniqueSlug('bon-appetit', async (s) =>
 *   Boolean(await db.query.creators.findFirst({ where: (t, { eq }) => eq(t.slug, s) }))
 * );
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
  opts: { maxLength?: number; fallback?: string; startFrom?: number } = {}
): Promise<string> {
  const startFrom = Math.max(2, opts.startFrom ?? 2);
  const baseSlug = slugify(base, opts);

  if (!(await exists(baseSlug))) return baseSlug;

  let i = startFrom;
  while (true) {
    const candidate = trimToMax(`${baseSlug}-${i}`, opts.maxLength ?? 180);
    if (!(await exists(candidate))) return candidate;
    i++;
  }
}

/**
 * Slugify multiple segments and join with "/" to form a path-like slug.
 * Each segment is slugified independently.
 */
export function slugifyPath(
  segments: string[],
  opts: { maxLengthPerSegment?: number } = {}
): string {
  const maxPer = opts.maxLengthPerSegment ?? 80;
  return segments
    .map((s) => slugify(s, { maxLength: maxPer }))
    .filter(Boolean)
    .join("/");
}

function trimToMax(s: string, max: number): string {
  if (s.length <= max) return s;
  const trimmed = s.slice(0, max);

  return trimmed.replace(/-+$/g, "");
}
