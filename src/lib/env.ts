// lib/env.ts
// Zod-validated environment variables for SourKimchi.
// - Separates server-only and client-exposed env
// - Helpful errors on missing/invalid values
// - Safe helper to compute the site URL
//
// Usage:
//   import { serverEnv } from '@/lib/env'     // server-only code (API routes, RSC, scripts)
//   import { clientEnv } from '@/lib/env'     // client components (NEXT_PUBLIC_* only)
//   import { getSiteUrl, isDev, isProd } from '@/lib/env'

import { z } from "zod";

// Server-only env (never import into client components)
const serverSchema = z.object({
  DATABASE_URL: z.url(),
  CLERK_SECRET_KEY: z.string(),
  ADMIN_EMAIL: z.email().optional(),
  YOUTUBE_API_KEY: z.string().optional(), // optional; using RSS for YT by default

  // Platform/runtime helpers
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  VERCEL_URL: z.string().optional(), // e.g., my-app.vercel.app (no protocol)
});

// Client-exposed env (only NEXT_PUBLIC_* keys end up in the browser bundle)
const clientSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(), // optional; computed fallback below
});

function formatIssues(issues: z.ZodIssue[]): string {
  return issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
}

// Parse server env
const _server = serverSchema.safeParse(process.env);
if (!_server.success) {
  console.error(
    "❌ Invalid server environment variables:\n" +
      formatIssues(_server.error.issues)
  );
  throw new Error("Invalid server environment variables");
}
export const serverEnv = _server.data;

// Parse client env from process.env (Next.js inlines NEXT_PUBLIC_* at build time)
const _client = clientSchema.safeParse({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
if (!_client.success) {
  console.error(
    "❌ Invalid client environment variables:\n" +
      formatIssues(_client.error.issues)
  );
  throw new Error("Invalid client environment variables");
}
export const clientEnv = _client.data;

// Convenience flags
export const isDev = serverEnv.NODE_ENV === "development";
export const isProd = serverEnv.NODE_ENV === "production";

// Compute the canonical site URL safely.
// Priority:
// 1) NEXT_PUBLIC_SITE_URL (set explicitly, best for canonical/OG) e.g., https://sourkimchi.com
// 2) window.location.origin (browser only; useful in dev)
// 3) VERCEL_URL (server, preview/prod) -> https://<vercel-url>
// 4) http://localhost:3000 (dev fallback)
export function getSiteUrl(): string {
  if (clientEnv.NEXT_PUBLIC_SITE_URL)
    return stripTrailingSlash(clientEnv.NEXT_PUBLIC_SITE_URL);
  if (typeof window !== "undefined" && window.location?.origin)
    return window.location.origin;
  if (serverEnv.VERCEL_URL) return `https://${serverEnv.VERCEL_URL}`;
  return "http://localhost:3000";
}

function stripTrailingSlash(u: string) {
  return u.replace(/\/+$/, "");
}

// Optional: export a single "env" view for non-sensitive helpers
export const env = {
  isDev,
  isProd,
  siteUrl: getSiteUrl(),
};

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;
