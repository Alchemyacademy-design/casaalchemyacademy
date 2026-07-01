/**
 * Unified video URL parser used by the lesson player and the admin
 * preview. Supports YouTube, Vimeo, Dropbox, and direct file URLs
 * (mp4 / webm / ogg / mov / m4v).
 *
 * Dropbox shared URLs (`dropbox.com`, `www.dropbox.com`,
 * `dl.dropboxusercontent.com`, including `/scl/fi/…`) are normalised:
 * the `dl` parameter is stripped and `raw=1` is forced so the URL streams
 * correctly in <video>. When Dropbox hides the extension, we still treat it
 * as a lesson video and let the browser sniff the stream.
 * `rlkey` and any other parameters are preserved.
 *
 * This module never mutates the URL stored in the database — it only
 * normalises at render time.
 */

export type VideoProvider =
  | "youtube"
  | "vimeo"
  | "dropbox"
  | "file"
  | "external"
  | "none";

export type ParsedVideo =
  | { provider: "youtube"; kind: "iframe"; embed: string; original: string }
  | { provider: "vimeo"; kind: "iframe"; embed: string; original: string }
  | { provider: "dropbox"; kind: "file"; src: string; mime: string; original: string }
  | { provider: "file"; kind: "file"; src: string; mime: string; original: string }
  | { provider: "external"; kind: "external"; href: string; original: string }
  | { provider: "none"; kind: "none" };

const FILE_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
};

const DROPBOX_HOSTS = new Set([
  "dropbox.com",
  "www.dropbox.com",
  "dl.dropboxusercontent.com",
]);

function isHttp(url: URL) {
  return url.protocol === "http:" || url.protocol === "https:";
}

function extOf(pathname: string): string {
  const m = pathname.toLowerCase().match(/\.([a-z0-9]+)(?:$)/);
  return m ? m[1] : "";
}

/**
 * Normalise a Dropbox URL for direct streaming. Removes `dl`, forces
 * `raw=1`, keeps `rlkey` and other params. Returns the original string
 * if the input is not a Dropbox URL.
 */
export function normalizeVideoUrl(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return raw;
  }
  if (!isHttp(url)) return raw;
  const host = url.hostname.toLowerCase();
  if (!DROPBOX_HOSTS.has(host)) return url.toString();

  // Force streaming host: dropbox.com wraps the file in an HTML preview even
  // with raw=1, but dl.dropboxusercontent.com serves the file bytes directly.
  if (host === "dropbox.com" || host === "www.dropbox.com") {
    url.hostname = "dl.dropboxusercontent.com";
  }
  url.searchParams.delete("dl");
  url.searchParams.set("raw", "1");
  return url.toString();
}

export function getVideoProvider(raw: string | null | undefined): VideoProvider {
  return parseVideoUrl(raw).provider;
}

export function parseVideoUrl(raw: string | null | undefined): ParsedVideo {
  if (!raw || typeof raw !== "string" || !raw.trim()) return { provider: "none", kind: "none" };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { provider: "none", kind: "none" };
  }
  if (!isHttp(url)) return { provider: "none", kind: "none" };
  const original = url.toString();
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // YouTube
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      if (id && /^[\w-]{6,20}$/.test(id)) {
        return { provider: "youtube", kind: "iframe", embed: `https://www.youtube.com/embed/${id}`, original };
      }
    }
    const embedMatch = url.pathname.match(/^\/embed\/([\w-]{6,20})/);
    if (embedMatch) return { provider: "youtube", kind: "iframe", embed: `https://www.youtube.com/embed/${embedMatch[1]}`, original };
    const shortMatch = url.pathname.match(/^\/shorts\/([\w-]{6,20})/);
    if (shortMatch) return { provider: "youtube", kind: "iframe", embed: `https://www.youtube.com/embed/${shortMatch[1]}`, original };
  }
  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "");
    if (/^[\w-]{6,20}$/.test(id)) {
      return { provider: "youtube", kind: "iframe", embed: `https://www.youtube.com/embed/${id}`, original };
    }
  }

  // Vimeo
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) {
      return { provider: "vimeo", kind: "iframe", embed: `https://player.vimeo.com/video/${id}`, original };
    }
  }
  if (host === "player.vimeo.com") {
    const match = url.pathname.match(/^\/video\/(\d+)/);
    if (match) return { provider: "vimeo", kind: "iframe", embed: `https://player.vimeo.com/video/${match[1]}`, original };
  }

  // Dropbox
  if (DROPBOX_HOSTS.has(url.hostname.toLowerCase())) {
    const ext = extOf(url.pathname);
    const src = normalizeVideoUrl(original);
    return { provider: "dropbox", kind: "file", src, mime: FILE_MIME[ext] ?? "video/mp4", original };
  }

  // Direct file
  const ext = extOf(url.pathname);
  if (ext in FILE_MIME) {
    return { provider: "file", kind: "file", src: original, mime: FILE_MIME[ext], original };
  }

  return { provider: "external", kind: "external", href: original, original };
}

/** Safe display URL for admins (no query params hidden — but the
 * caller can opt to drop them). */
export function stripQueryForDisplay(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw;
  }
}
