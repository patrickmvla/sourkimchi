import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/*",
          "/admin*",
          "/account*",
          "/sign-in*",
          "/sign-up*",
          "/cook/*",
          "/_next/*",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

function getBaseUrl(): string {
  try {
    return getSiteUrl();
  } catch {
    const envUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
    return envUrl.replace(/\/+$/, "");
  }
}
