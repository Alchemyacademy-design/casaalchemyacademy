import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, type PageMeta } from "./site";

/** Marks tags that belong to one specific URL (removed when the HTML is reused as the app shell). */
export const ROUTE_META_ATTR = "data-aa-route-meta";

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** JSON for a <script> body: closing tags and comment openers can't break out. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

/** Head tags for the served HTML of one public page. */
export function renderHeadTags(meta: PageMeta): string {
  const url = absoluteUrl(meta.path);
  const image = meta.ogImage || DEFAULT_OG_IMAGE;
  const r = `${ROUTE_META_ATTR}="${esc(meta.path)}"`;
  const lines = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" ${r} />`,
    meta.noindex ? `<meta name="robots" content="noindex, follow" ${r} />` : null,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${meta.ogType ?? "website"}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" ${r} />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:locale" content="en_AU" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    ...(meta.jsonLd ?? []).map((obj) => `<script type="application/ld+json" ${r}>${safeJson(obj)}</script>`),
  ];
  return lines.filter(Boolean).join("\n    ");
}

function upsert(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function metaEl(key: "name" | "property", name: string) {
  return () => {
    const el = document.createElement("meta");
    el.setAttribute(key, name);
    return el;
  };
}

/** Client side: keep the document head in step with the page after in-app navigation. */
export function applyHeadMeta(meta: PageMeta) {
  if (typeof document === "undefined") return;
  const url = absoluteUrl(meta.path);
  document.title = meta.title;
  upsert('meta[name="description"]', metaEl("name", "description"), "content", meta.description);
  upsert('meta[property="og:title"]', metaEl("property", "og:title"), "content", meta.title);
  upsert('meta[property="og:description"]', metaEl("property", "og:description"), "content", meta.description);
  upsert('meta[name="twitter:title"]', metaEl("name", "twitter:title"), "content", meta.title);
  upsert('meta[name="twitter:description"]', metaEl("name", "twitter:description"), "content", meta.description);
  upsert('meta[property="og:url"]', metaEl("property", "og:url"), "content", url);
  upsert(
    'link[rel="canonical"]',
    () => {
      const el = document.createElement("link");
      el.setAttribute("rel", "canonical");
      return el;
    },
    "href",
    url,
  );
  document.head.querySelectorAll(`script[${ROUTE_META_ATTR}]`).forEach((el) => {
    if (el.getAttribute(ROUTE_META_ATTR) !== meta.path) el.remove();
  });
  const robots = document.head.querySelector('meta[name="robots"]');
  if (meta.noindex) upsert('meta[name="robots"]', metaEl("name", "robots"), "content", "noindex, follow");
  else robots?.remove();
}

/** Client side: drop URL specific tags on pages that have no public metadata. */
export function clearRouteMeta() {
  if (typeof document === "undefined") return;
  document.head.querySelectorAll('link[rel="canonical"], meta[property="og:url"], meta[name="robots"]').forEach((el) => el.remove());
  document.head.querySelectorAll(`script[${ROUTE_META_ATTR}]`).forEach((el) => el.remove());
}
