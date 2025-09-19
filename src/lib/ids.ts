import { customAlphabet } from "nanoid";

// Lowercase + digits keeps IDs compact and DB-index friendly.
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

// 24-char primary IDs (default across tables)
export const cuid = customAlphabet(ALPHABET, 24);

// Shorter variant for secondary keys, temp IDs, etc.
export const shortId = customAlphabet(ALPHABET, 12);

// Optional helper: prefix IDs by type (e.g., "rec_xxx", "crt_xxx")
export function newId(prefix?: string): string {
  const id = cuid();
  return prefix ? `${prefix}_${id}` : id;
}

// Basic validator for our 24-char cuid format (no prefix)
export function isCuid(value: string): boolean {
  return /^[a-z0-9]{24}$/.test(value);
}
