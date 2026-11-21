// Build-time renderer for public pages (loaded by scripts/prerender in Node).
// Renders the real app for a URL as a signed-out visitor, with the same
// public queries the browser would run, so the served HTML carries the
// page's headings, copy and links before any JavaScript executes.
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { QueryClient, QueryClientProvider, dehydrate, type DehydratedState } from "@tanstack/react-query";
import App from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { resolveAssetUrl } from "@/manus/lib/asset-url";
import {
  STATIC_PUBLIC_PAGES,
  courseJsonLd,
  workshopMeta,
  type CourseSeo,
  type PageMeta,
} from "@/seo/site";

export { renderHeadTags, safeJson } from "@/seo/head";
export { ORGANIZATION_JSON_LD, SITE_URL, absoluteUrl } from "@/seo/site";

function tree(url: string, client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <StaticRouter location={url} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </StaticRouter>
    </QueryClientProvider>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type RenderResult = { html: string; state: DehydratedState; failedQueries: string[] };

/**
 * Renders repeatedly until lazy page chunks have loaded and every query the
 * page asked for has settled, then returns the final markup.
 */
export async function render(url: string): Promise<RenderResult> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  let html = "";
  for (let pass = 0; pass < 8; pass++) {
    html = renderToString(tree(url, client));
    const pending = client
      .getQueryCache()
      .getAll()
      .filter((q) => q.state.status === "pending" && q.state.fetchStatus === "idle" && q.options.queryFn);
    await Promise.all(pending.map((q) => q.fetch().catch(() => undefined)));
    // Give lazily imported page modules time to resolve.
    await sleep(pass === 0 ? 400 : 80);
    if (pass > 0 && pending.length === 0 && !html.includes('aria-busy="true"')) break;
  }
  html = renderToString(tree(url, client));
  const failedQueries = client
    .getQueryCache()
    .getAll()
    .filter((q) => q.state.status === "error")
    .map((q) => JSON.stringify(q.queryKey));
  const state = dehydrate(client, { shouldDehydrateQuery: (q) => q.state.status === "success" });
  return { html, state, failedQueries };
}

type Row = Record<string, unknown>;

async function rpc(name: string): Promise<Row[]> {
  const { data, error } = await supabase.rpc(name as never);
  if (error) throw new Error(`${name}: ${error.message}`);
  return (data ?? []) as Row[];
}

/** Every public page to prerender, with its head metadata and structured data. */
export async function listPublicPages(): Promise<{ pages: PageMeta[]; warnings: string[] }> {
  const warnings: string[] = [];
  const pages: PageMeta[] = STATIC_PUBLIC_PAGES.map((p) => ({ ...p }));

  let teasers: Row[] = [];
  let prices: Row[] = [];
  let workshops: Row[] = [];
  try { teasers = await rpc("get_public_course_teasers"); } catch (e) { warnings.push(String(e)); }
  try { prices = await rpc("get_individual_course_prices"); } catch (e) { warnings.push(String(e)); }
  try { workshops = await rpc("get_public_upcoming_workshops"); } catch (e) { warnings.push(String(e)); }

  const priceFor = (id: number) => {
    const p = prices.find((r) => Number(r.course_id) === id);
    return p ? Number(p.unit_amount) : null;
  };
  const toCourse = (r: Row): CourseSeo => ({
    id: Number(r.id ?? r.course_id),
    title: String(r.title ?? ""),
    description: ((r.subtitle ?? r.short_description ?? r.description) as string | null) ?? null,
    unitAmount: priceFor(Number(r.id ?? r.course_id)),
    image: resolveAssetUrl((r.cover_image_path as string | null) ?? null),
  });

  const published = teasers.filter((r) => String(r.status ?? "published") === "published").map(toCourse);
  const home = pages.find((p) => p.path === "/");
  if (home && published.length) home.jsonLd = published.map(courseJsonLd);
  const choose = pages.find((p) => p.path === "/choose-course");
  if (choose) {
    const priced = published.filter((c) => typeof c.unitAmount === "number");
    if (priced.length) choose.jsonLd = priced.map(courseJsonLd);
  }

  for (const w of workshops) {
    if (!w.slug) continue;
    pages.push(
      workshopMeta({
        slug: String(w.slug),
        title: String(w.title ?? ""),
        description: (w.description as string | null) ?? null,
        starts_at: String(w.starts_at),
        ends_at: (w.ends_at as string | null) ?? null,
        image: resolveAssetUrl((w.cover_image_path as string | null) ?? null),
      }),
    );
  }
  return { pages, warnings };
}
