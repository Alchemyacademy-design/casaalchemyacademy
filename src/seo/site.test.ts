import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ORGANIZATION_JSON_LD,
  STATIC_PUBLIC_PAGES,
  courseJsonLd,
  workshopMeta,
} from "./site";
import { renderHeadTags } from "./head";
import { buildSitemap, composePage } from "../../scripts/prerender/vite-plugin";

const root = path.resolve(__dirname, "../..");

describe("public page metadata", () => {
  it("keeps every title at 60 characters or fewer", () => {
    for (const p of STATIC_PUBLIC_PAGES) expect(p.title.length, p.path).toBeLessThanOrEqual(60);
  });

  it("keeps every description between 150 and 160 characters", () => {
    for (const p of STATIC_PUBLIC_PAGES) {
      expect(p.description.length, p.path).toBeGreaterThanOrEqual(150);
      expect(p.description.length, p.path).toBeLessThanOrEqual(160);
    }
  });

  it("gives every page a unique title and description", () => {
    expect(new Set(STATIC_PUBLIC_PAGES.map((p) => p.title)).size).toBe(STATIC_PUBLIC_PAGES.length);
    expect(new Set(STATIC_PUBLIC_PAGES.map((p) => p.description)).size).toBe(STATIC_PUBLIC_PAGES.length);
  });

  it("points the canonical and og:url at the page itself", () => {
    const head = renderHeadTags({ path: "/support", title: "Support", description: "x" });
    expect(head).toContain('<link rel="canonical" href="https://www.casaalchemyacademy.com/support"');
    expect(head).toContain('<meta property="og:url" content="https://www.casaalchemyacademy.com/support"');
    expect(head).toContain('property="og:image"');
  });

  it("fits Ask the Expert LIVE titles and descriptions", () => {
    const m = workshopMeta({
      slug: "ask-the-expert-live-landscape-designer",
      title: "Ask the Expert LIVE - Landscape Designer",
      description: null,
      starts_at: "2027-01-11T08:00:00Z",
      ends_at: "2027-01-11T09:00:00Z",
    });
    expect(m.title).toBe("Ask the Expert LIVE: Landscape Designer | Alchemy Academy");
    expect(m.description.length).toBeGreaterThanOrEqual(150);
    expect(m.description.length).toBeLessThanOrEqual(160);
  });
});

describe("structured data", () => {
  it("describes the organisation, its founder and profiles", () => {
    expect(ORGANIZATION_JSON_LD.name).toBe("Alchemy Academy");
    expect(ORGANIZATION_JSON_LD.legalName).toBe("Casa Alchemy Studio & Academy Pty Ltd");
    expect(ORGANIZATION_JSON_LD.founder.name).toBe("Lorena Couto");
    expect(ORGANIZATION_JSON_LD.sameAs).toEqual([
      "https://casaalchemystudio.com",
      "https://www.instagram.com/casaalchemy",
      "https://www.linkedin.com/in/lorenacouto",
      "https://www.youtube.com/@lorenacouto_casaalchemy",
      "https://www.tiktok.com/@lorenacouto_casaalchemy",
    ]);
  });

  it("puts the course's own price in its Course offer", () => {
    const c = courseJsonLd({ id: 1, title: "The path to a COLOURFUL life", description: "Colour", unitAmount: 39900 });
    expect(c.inLanguage).toBe("en-AU");
    expect(c.hasCourseInstance).toEqual({ "@type": "CourseInstance", courseMode: "online" });
    expect(c.offers).toMatchObject({ price: "399.00", priceCurrency: "USD" });
  });

  it("leaves the offer out for a course without its own price", () => {
    expect(courseJsonLd({ id: 2, title: "Bedroom", description: null, unitAmount: null }).offers).toBeUndefined();
  });

  it("marks Ask the Expert LIVE sessions as free online events", () => {
    const e = workshopMeta({ slug: "s", title: "Ask the Expert LIVE: Pool Specialist", description: "d", starts_at: "2027-01-11T08:00:00Z", ends_at: null }).jsonLd![0];
    expect(e["@type"]).toBe("Event");
    expect(e.startDate).toBe("2027-01-11T08:00:00Z");
    expect(e.eventAttendanceMode).toBe("https://schema.org/OnlineEventAttendanceMode");
    expect(e.location).toEqual({ "@type": "VirtualLocation", url: "https://www.casaalchemyacademy.com/ask-the-expert/s" });
    expect(e.isAccessibleForFree).toBe(true);
  });
});

describe("prerendered HTML", () => {
  const template =
    '<html><head><meta charset="UTF-8" /><title>Old</title><meta name="description" content="old"></head><body><div id="root"></div></body></html>';

  it("puts the page markup in #root and replaces the template head tags", () => {
    const out = composePage(template, { path: "/x", head: "<title>New</title>", html: "<h1>Price $295 $&amp;</h1>", stateJson: "{}" });
    expect(out).toContain('<div id="root" data-prerendered="/x"><h1>Price $295 $&amp;</h1></div>');
    expect(out).not.toContain("<title>Old</title>");
    expect(out.match(/<title>/g)).toHaveLength(1);
  });

  it("lists sitemap URLs with lastmod when known", () => {
    const xml = buildSitemap([{ loc: "https://www.casaalchemyacademy.com/", lastmod: "2026-11-10" }, { loc: "https://www.casaalchemyacademy.com/support" }]);
    expect(xml).toContain("<loc>https://www.casaalchemyacademy.com/</loc>\n    <lastmod>2026-11-10</lastmod>");
    expect(xml).toContain("<loc>https://www.casaalchemyacademy.com/support</loc>\n  </url>");
  });

  it("no longer ships the loading text in the page shell", () => {
    expect(readFileSync(path.join(root, "index.html"), "utf8")).not.toContain("Loading Alchemy Academy");
  });
});

describe("robots.txt", () => {
  const robots = readFileSync(path.join(root, "public/robots.txt"), "utf8");

  it("lets search and AI crawlers read public pages", () => {
    for (const bot of ["*", "GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      expect(robots).toContain(`User-agent: ${bot}\n`);
    }
    expect(robots).toContain("Allow: /\n");
    expect(robots).not.toMatch(/^Disallow: \/$/m);
  });

  it("blocks member and sign in areas and points to the sitemap", () => {
    for (const p of ["/admin", "/dashboard", "/mycourses", "/login", "/signup", "/auth/"]) {
      expect(robots).toContain(`Disallow: ${p}\n`);
    }
    expect(robots).toContain("Sitemap: https://www.casaalchemyacademy.com/sitemap.xml");
  });
});
