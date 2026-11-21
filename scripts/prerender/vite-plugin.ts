// Build-time prerender for public (signed-out) pages.
//
// After `vite build` writes dist/, this renders each public route with the
// real React app (via Vite's SSR loader) and writes static HTML so crawlers
// that don't run JavaScript (GPTBot, ClaudeBot, PerplexityBot...) read the
// real headings, copy and links. It also writes dist/sitemap.xml.
//
// It never fails the build: if anything goes wrong the site ships as the
// plain single page app, exactly as before.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

type PageMeta = { path: string; title: string; description: string; noindex?: boolean };

type EntryModule = {
  listPublicPages: () => Promise<{ pages: PageMeta[]; warnings: string[] }>;
  render: (url: string) => Promise<{ html: string; state: unknown; failedQueries: string[] }>;
  renderHeadTags: (meta: PageMeta) => string;
  safeJson: (v: unknown) => string;
  absoluteUrl: (p: string) => string;
};

/** Source files whose last commit date is the page's lastmod. */
const PAGE_SOURCES: Record<string, string[]> = {
  "/": ["src/manus/pages/Home.tsx"],
  "/choose-course": ["src/manus/pages/CourseCheckout.tsx"],
  "/privacy-policy": ["src/manus/pages/legal/PrivacyPolicy.tsx"],
  "/terms-of-use": ["src/manus/pages/legal/TermsOfUse.tsx"],
  "/legal/casa-consult-terms": ["src/manus/pages/legal/CasaConsultTerms.tsx"],
  "/support": ["src/manus/pages/legal/Support.tsx"],
  "/data-deletion": ["src/manus/pages/legal/DataDeletion.tsx"],
};

function gitDate(root: string, files: string[]): string | null {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", ...files], { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

/** lastmod values already in the committed sitemap, used when git history isn't available. */
function previousLastmods(root: string): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const xml = readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) map.set(m[1], m[2]);
  } catch {
    /* no committed sitemap */
  }
  return map;
}

export function buildSitemap(entries: { loc: string; lastmod?: string | null }[]): string {
  const urls = entries.map((e) =>
    ["  <url>", `    <loc>${e.loc}</loc>`, e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null, "  </url>"]
      .filter(Boolean)
      .join("\n"),
  );
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, "</urlset>", ""].join("\n");
}

const HEAD_TAG_PATTERNS = [
  /<title>[\s\S]*?<\/title>\s*/i,
  /<meta\s+name="description"[^>]*>\s*/gi,
  /<meta\s+property="og:[^"]+"[^>]*>\s*/gi,
  /<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi,
  /<link\s+rel="canonical"[^>]*>\s*/gi,
  /<meta\s+name="aa-prerendered-path"[^>]*>\s*/gi,
];

export function composePage(template: string, opts: { path: string; head: string; html: string; stateJson: string }): string {
  let out = template;
  for (const re of HEAD_TAG_PATTERNS) out = out.replace(re, "");
  // Insert at the top of <head>: the inline shell check further down reads
  // these tags while the page is still parsing.
  out = out.replace(
    /<meta charset="UTF-8"\s*\/?>/i,
    (charset) => `${charset}\n    <meta name="aa-prerendered-path" content="${opts.path}" />\n    ${opts.head}`,
  );
  out = out.replace(
    '<div id="root"></div>',
    () => `<div id="root" data-prerendered="${opts.path}">${opts.html}</div>\n    <script>window.__AA_PRERENDER_STATE__=${opts.stateJson};</script>`,
  );
  return out;
}

async function run(config: ResolvedConfig) {
  const root = config.root;
  const outDir = path.resolve(root, config.build.outDir);
  const templatePath = path.join(outDir, "index.html");
  if (!existsSync(templatePath)) return;
  const template = readFileSync(templatePath, "utf8");
  if (!template.includes('<div id="root"></div>')) {
    console.warn("[prerender] index.html has no empty #root; skipped");
    return;
  }

  // Dates on public pages are rendered for the studio's own time zone.
  process.env.TZ = "Australia/Sydney";
  const g = globalThis as { localStorage?: unknown };
  const hadStorage = "localStorage" in g;
  if (!hadStorage) {
    const mem = new Map<string, string>();
    g.localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, String(v)),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: (i: number) => Array.from(mem.keys())[i] ?? null,
      get length() { return mem.size; },
    };
  }

  const { createServer } = await import("vite");
  const server = await createServer({
    root,
    configFile: false,
    mode: "production",
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    // Production JSX runtime (the build runs with NODE_ENV=production).
    esbuild: { jsx: "automatic", jsxDev: false },
    resolve: { alias: { "@": path.resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  });

  const written: string[] = [];
  const sitemapEntries: { loc: string; lastmod?: string | null }[] = [];
  try {
    const mod = (await server.ssrLoadModule("/src/prerender/entry-server.tsx")) as unknown as EntryModule;
    const { pages, warnings } = await mod.listPublicPages();
    warnings.forEach((w) => console.warn("[prerender]", w));
    const previous = previousLastmods(root);

    for (const page of pages) {
      try {
        const result = await mod.render(page.path);
        if (result.failedQueries.length) {
          console.warn(`[prerender] ${page.path}: data did not load (${result.failedQueries.join(", ")}); left as app shell`);
          continue;
        }
        const h1Count = (result.html.match(/<h1[\s>]/g) ?? []).length;
        if (h1Count !== 1) console.warn(`[prerender] ${page.path}: expected one <h1>, found ${h1Count}`);
        const html = composePage(template, {
          path: page.path,
          head: mod.renderHeadTags(page),
          html: result.html,
          stateJson: mod.safeJson(result.state),
        });
        if (page.path === "/") {
          writeFileSync(templatePath, html);
        } else {
          const rel = page.path.replace(/^\//, "");
          mkdirSync(path.join(outDir, rel), { recursive: true });
          writeFileSync(path.join(outDir, rel, "index.html"), html);
          mkdirSync(path.dirname(path.join(outDir, `${rel}.html`)), { recursive: true });
          writeFileSync(path.join(outDir, `${rel}.html`), html);
        }
        written.push(page.path);
      } catch (err) {
        console.warn(`[prerender] ${page.path} failed:`, err instanceof Error ? err.message : err);
      }
    }

    for (const page of pages) {
      if (page.noindex) continue;
      const loc = mod.absoluteUrl(page.path);
      const sources = PAGE_SOURCES[page.path];
      const lastmod = (sources && gitDate(root, sources)) || previous.get(loc) || null;
      sitemapEntries.push({ loc, lastmod });
    }
    if (sitemapEntries.length) writeFileSync(path.join(outDir, "sitemap.xml"), buildSitemap(sitemapEntries));
  } finally {
    await server.close();
    if (!hadStorage) delete g.localStorage;
  }
  console.log(`[prerender] ${written.length} public pages: ${written.join(" ")}`);
  console.log(`[prerender] sitemap.xml: ${sitemapEntries.length} URLs`);
}

export function prerenderPublicPages(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "aa-prerender-public-pages",
    apply: "build",
    configResolved(c) {
      config = c;
    },
    async closeBundle() {
      if (config.build.ssr || process.env.AA_SKIP_PRERENDER === "1") return;
      try {
        await run(config);
      } catch (err) {
        console.warn("[prerender] skipped:", err instanceof Error ? err.stack : err);
      }
    },
  };
}
