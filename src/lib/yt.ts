// Tiny YouTube helpers for SourKimchi.
// Goal: no API key required (RSS + oEmbed). Safe for server runtimes.
//
// What you can do with this module:
// - Fetch latest videos via the public RSS feed (by channelId)
// - Parse RSS into a lightweight video list
// - Build embed and thumbnail URLs from a video id
// - Extract videoId from common YouTube URLs
// - Fetch oEmbed metadata for a given YouTube URL (title, author, thumb)

/* =========================
   Types
   ========================= */

export type YtVideo = {
  videoId: string;
  title: string;
  watchUrl: string;
  embedUrl: string; // privacy-enhanced by default
  thumbUrl: string; // hqdefault by default
  thumbMaxResUrl?: string; // may not exist for all videos
  description?: string;
  publishedAt?: Date;
  updatedAt?: Date;
  channelId?: string;
  channelTitle?: string;
};

export type YtFeed = {
  channelId?: string;
  channelTitle?: string;
  videos: YtVideo[];
};

/* =========================
   Constants
   ========================= */

const YT_RSS_BASE = "https://www.youtube.com/feeds/videos.xml";
const YT_WATCH_BASE = "https://www.youtube.com/watch?v=";
const YT_EMBED_BASE = "https://www.youtube-nocookie.com/embed";
const YT_THUMB_BASE = "https://i.ytimg.com/vi";

/* =========================
   Public helpers
   ========================= */

// Build RSS URLs
export function rssUrlForChannelId(channelId: string) {
  return `${YT_RSS_BASE}?channel_id=${encodeURIComponent(channelId)}`;
}

export function rssUrlForUser(username: string) {
  // Legacy usernames (not handles). For handles, prefer channelId.
  return `${YT_RSS_BASE}?user=${encodeURIComponent(username)}`;
}

// Fetch channel RSS and parse into a feed
export async function fetchChannelFeedFromRss(
  args:
    | { channelId: string; limit?: number; requestInit?: RequestInit }
    | { user: string; limit?: number; requestInit?: RequestInit }
): Promise<YtFeed> {
  const url =
    "channelId" in args
      ? rssUrlForChannelId(args.channelId)
      : rssUrlForUser(args.user);
  const res = await fetch(url, args.requestInit);
  if (!res.ok) {
    throw new Error(`YouTube RSS fetch failed (${res.status}): ${url}`);
  }
  const xml = await res.text();
  const feed = parseChannelRss(xml);
  if ("channelId" in args) {
    // Make sure channelId is set if caller provided it
    feed.channelId = args.channelId ?? feed.channelId;
  }
  // Optional limit
  if ("limit" in args && typeof args.limit === "number") {
    feed.videos = feed.videos.slice(0, args.limit);
  }
  return feed;
}

// Convenience: get the latest video for a channelId (RSS, no API key)
export async function fetchLatestFromRss(channelId: string): Promise<{
  embedUrl: string;
  thumb: string;
  title?: string;
  publishedAt: Date | null;
  videoId?: string;
  watchUrl?: string;
}> {
  const feed = await fetchChannelFeedFromRss({ channelId, limit: 1 });
  const v = feed.videos[0];
  if (!v)
    return {
      embedUrl: "",
      thumb: "",
      title: undefined,
      publishedAt: null,
      videoId: undefined,
      watchUrl: undefined,
    };
  return {
    embedUrl: v.embedUrl,
    thumb: v.thumbUrl,
    title: v.title,
    publishedAt: v.publishedAt ?? null,
    videoId: v.videoId,
    watchUrl: v.watchUrl,
  };
}

// Parse RSS XML string into a YtFeed (no external XML deps)
export function parseChannelRss(xml: string): YtFeed {
  const feedTitle = matchFirst(xml, /<title>([^<]+)<\/title>/);
  // entries
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const videos: YtVideo[] = entries.map((entry) => {
    const videoId =
      matchFirst(entry, /<yt:videoId>([^<]+)<\/yt:videoId>/) ||
      matchFirst(entry, /<id>yt:video:([^<]+)<\/id>/) ||
      "";

    const title =
      // Prefer entry title; fallback media:title
      matchFirst(entry, /<title>([^<]+)<\/title>/) ||
      matchFirst(entry, /<media:title[^>]*>([\s\S]*?)<\/media:title>/) ||
      "";

    const channelId =
      matchFirst(entry, /<yt:channelId>([^<]+)<\/yt:channelId>/) || undefined;

    const channelTitle =
      matchFirst(
        entry,
        /<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/
      ) || undefined;

    const published =
      parseIsoDate(matchFirst(entry, /<published>([^<]+)<\/published>/)) ||
      undefined;

    const updated =
      parseIsoDate(matchFirst(entry, /<updated>([^<]+)<\/updated>/)) ||
      undefined;

    const link =
      matchFirst(entry, /<link[^>]+rel="alternate"[^>]+href="([^"]+)"/) ||
      (videoId ? `${YT_WATCH_BASE}${videoId}` : "");

    const description =
      decodeHtml(
        matchFirst(entry, /<media:description>([\s\S]*?)<\/media:description>/)
      ) || undefined;

    // Thumbnail(s)
    const thumb =
      matchFirst(entry, /<media:thumbnail[^>]+url="([^"]+)"/) ||
      (videoId ? thumbUrl(videoId, "hq") : "");

    const v: YtVideo = {
      videoId,
      title: decodeHtml(title),
      watchUrl: link,
      embedUrl: videoId ? embedUrl(videoId) : "",
      thumbUrl: thumb,
      thumbMaxResUrl: videoId ? thumbUrl(videoId, "maxres") : undefined,
      description,
      publishedAt: published,
      updatedAt: updated,
      channelId,
      channelTitle,
    };
    return v;
  });

  // try to extract channelId from the first entry if not obvious
  const channelId =
    matchFirst(xml, /<yt:channelId>([^<]+)<\/yt:channelId>/) ||
    videos[0]?.channelId ||
    undefined;

  return {
    channelId,
    channelTitle: feedTitle,
    videos,
  };
}

// Build an embed URL (privacy‑enhanced domain)
export function embedUrl(
  videoId: string,
  opts?: {
    privacyEnhanced?: boolean;
    modestBranding?: boolean;
    rel?: 0 | 1;
    autoplay?: 0 | 1;
  }
) {
  const base =
    opts?.privacyEnhanced ?? true
      ? YT_EMBED_BASE
      : "https://www.youtube.com/embed";
  const params = new URLSearchParams();
  if (opts?.modestBranding ?? true) params.set("modestbranding", "1");
  params.set("rel", String(opts?.rel ?? 0));
  params.set("iv_load_policy", "3"); // annotations off
  if (opts?.autoplay != null) params.set("autoplay", String(opts.autoplay));
  return `${base}/${encodeURIComponent(videoId)}?${params.toString()}`;
}

// Build a thumbnail URL for a given videoId
export function thumbUrl(
  videoId: string,
  quality: "default" | "mq" | "hq" | "sd" | "maxres" = "hq"
) {
  const map: Record<string, string> = {
    default: "default.jpg",
    mq: "mqdefault.jpg",
    hq: "hqdefault.jpg",
    sd: "sddefault.jpg",
    maxres: "maxresdefault.jpg",
  };
  return `${YT_THUMB_BASE}/${encodeURIComponent(videoId)}/${map[quality]}`;
}

// Extract videoId from common YouTube URL formats
export function videoIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // youtu.be/<id>
    if (u.hostname === "youtu.be") {
      return u.pathname.replace(/^\//, "") || null;
    }
    // www.youtube.com/watch?v=<id> or variants
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    // www.youtube.com/embed/<id>
    const m = u.pathname.match(/\/embed\/([^/?#]+)/);
    if (m?.[1]) return m[1];
  } catch {
    // not a URL; maybe already an id
  }
  // fall back: if it looks like a video id (11 chars, allowed chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}

// Try to extract channelId from a URL or id-ish string.
// Returns null if not a channelId (e.g., handle or username).
export function channelIdFromString(input: string): string | null {
  // Already a raw channel id?
  if (/^UC[0-9A-Za-z_-]{22}$/.test(input)) return input;
  try {
    const u = new URL(input);
    // /channel/UCxxxx
    const m = u.pathname.match(/\/channel\/(UC[0-9A-Za-z_-]{22})/);
    if (m?.[1]) return m[1];
  } catch {
    // not a URL; ignore
  }
  return null;
}

// Fetch oEmbed (no API key) to get title, author, thumbnail, and embed HTML
export async function fetchOEmbed(
  youtubeUrl: string,
  requestInit?: RequestInit
): Promise<{
  title: string;
  authorName: string;
  authorUrl: string;
  thumbnailUrl: string;
  html: string;
  width?: number;
  height?: number;
}> {
  const oembed = new URL("https://www.youtube.com/oembed");
  oembed.searchParams.set("url", youtubeUrl);
  oembed.searchParams.set("format", "json");
  const res = await fetch(oembed.toString(), requestInit);
  if (!res.ok) throw new Error(`YouTube oEmbed failed (${res.status})`);
  const json = await res.json();
  return {
    title: json.title,
    authorName: json.author_name,
    authorUrl: json.author_url,
    thumbnailUrl: json.thumbnail_url,
    html: json.html,
    width: json.width,
    height: json.height,
  };
}

/* =========================
   Internals
   ========================= */

function matchFirst(src: string, re: RegExp): string | undefined {
  const m = src.match(re);
  return m?.[1]?.trim();
}

function parseIsoDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isFinite(d.valueOf()) ? d : undefined;
}

function decodeHtml(s?: string): string {
  if (!s) return "";
  // quick decode for common entities
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}
