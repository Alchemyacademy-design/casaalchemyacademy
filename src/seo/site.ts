// Single source of truth for public page head metadata and structured data.
// Used by the build-time prerender (scripts/prerender) and by the client so
// the title/description a crawler reads in the served HTML matches what the
// running app sets after navigation.

/** Canonical origin. The bare domain redirects here, so canonicals point at the final URL. */
export const SITE_URL = "https://www.casaalchemyacademy.com";
export const SITE_NAME = "Alchemy Academy";
export const DEFAULT_OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/0ea47268-2238-4245-ae19-b4c34cb58a2b";

export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 150;
export const DESCRIPTION_MAX = 160;

export type PageMeta = {
  path: string;
  title: string;
  description: string;
  /** Keep out of search results and the sitemap (still crawlable so the tag is seen). */
  noindex?: boolean;
  ogType?: "website" | "article";
  ogImage?: string;
  /** Extra JSON-LD objects for this page. */
  jsonLd?: Record<string, unknown>[];
};

/** Static public routes that render without a session. */
export const STATIC_PUBLIC_PAGES: PageMeta[] = [
  {
    path: "/",
    title: "Interior Design Courses for Homeowners | Alchemy Academy",
    description:
      "Learn to design your own home the professional way. Online interior design courses, live expert masterclasses and a members community led by Lorena Couto.",
  },
  {
    path: "/choose-course",
    title: "Single Interior Design Courses | Alchemy Academy",
    description:
      "Buy one interior design course on its own: a one time payment for 6 months of access to video lessons, Master Guides and a certificate, taught by Lorena Couto.",
  },
  {
    path: "/privacy-policy",
    title: "Privacy Policy | Alchemy Academy",
    description:
      "How Alchemy Academy by Casa Alchemy collects, uses and protects your personal data when you learn interior design with us, including the Google Calendar link.",
  },
  {
    path: "/terms-of-use",
    title: "Terms of Use | Alchemy Academy",
    description:
      "The conditions for using Alchemy Academy, the online interior design school by Casa Alchemy: sign up, accounts, courses, events, workshops and integrations.",
  },
  {
    path: "/legal/casa-consult-terms",
    title: "Casa Consult Terms and Conditions | Alchemy Academy",
    description:
      "Terms and conditions for Casa Consult, the hourly one to one interior design consultation with Lorena Couto of Casa Alchemy Studio: rates, billing and bookings.",
  },
  {
    path: "/support",
    title: "Support and Contact | Alchemy Academy",
    description:
      "Get help with Alchemy Academy: how to reach the Casa Alchemy team and solve common issues with signing in, your interior design courses and Google Calendar.",
  },
  {
    path: "/data-deletion",
    title: "Account and Data Deletion | Alchemy Academy",
    description:
      "How to request deletion of your Alchemy Academy account and personal data, disconnect Google Calendar and revoke access, and what happens after you ask.",
  },
  {
    path: "/free-lesson",
    title: "How to Mix Prints Free Lesson | Alchemy Academy",
    description:
      "Watch How to Mix Prints, a free interior design lesson with Lorena Couto from Alchemy Academy: combine patterns, scale and colour the way designers do it.",
    noindex: true,
  },
];

export function staticPageMeta(path: string): PageMeta | undefined {
  const clean = normalizePath(path);
  return STATIC_PUBLIC_PAGES.find((p) => p.path === clean);
}

export function normalizePath(path: string): string {
  const p = path.split(/[?#]/)[0] || "/";
  return p.length > 1 ? p.replace(/\/+$/, "") : "/";
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path === "/" ? "/" : path}`;
}

/** Image references in structured data must be absolute. */
export function absoluteImage(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  return src.startsWith("/") ? `${SITE_URL}${src}` : null;
}

/** Never show dashes in member facing copy. */
export function noDashes(text: string): string {
  return text.replace(/ [-–—] /g, ": ");
}

/** Clamp a description into the 150 to 160 character window. */
export function fitDescription(text: string, padding: string[] = []): string {
  let out = text.replace(/\s+/g, " ").trim();
  for (const extra of padding) {
    if (out.length >= DESCRIPTION_MIN) break;
    const next = `${out} ${extra}`;
    if (next.length <= DESCRIPTION_MAX) out = next;
  }
  if (out.length > DESCRIPTION_MAX) {
    const cut = out.slice(0, DESCRIPTION_MAX - 1);
    out = `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:]$/, "")}…`;
  }
  return out;
}

export function fitTitle(main: string): string {
  const suffix = ` | ${SITE_NAME}`;
  if (main.length + suffix.length <= TITLE_MAX) return `${main}${suffix}`;
  if (main.length <= TITLE_MAX) return main;
  const cut = main.slice(0, TITLE_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Alchemy Academy",
  legalName: "Casa Alchemy Studio & Academy Pty Ltd",
  url: SITE_URL,
  logo: `${SITE_URL}/img/logo.png`,
  founder: {
    "@type": "Person",
    name: "Lorena Couto",
    jobTitle: "Interior Designer",
  },
  sameAs: [
    "https://casaalchemystudio.com",
    "https://www.instagram.com/casaalchemy",
    "https://www.linkedin.com/in/lorenacouto",
    "https://www.youtube.com/@lorenacouto_casaalchemy",
    "https://www.tiktok.com/@lorenacouto_casaalchemy",
  ],
};

const PROVIDER = { "@type": "Organization", name: "Alchemy Academy", url: SITE_URL, "@id": `${SITE_URL}/#organization` };

/* ===== Ask the Expert LIVE ===== */

export type PublicWorkshopSeo = {
  slug: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  image?: string | null;
};

function sydneyDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function workshopPath(slug: string): string {
  return `/ask-the-expert/${slug}`;
}

export function workshopTitle(title: string): string {
  return fitTitle(noDashes(title));
}

export function workshopMeta(w: PublicWorkshopSeo): PageMeta {
  const path = workshopPath(w.slug);
  const name = noDashes(w.title);
  const description = fitDescription(
    `${name}, a free live online class on ${sydneyDate(w.starts_at)} (Sydney time). Bring your home design questions to Lorena Couto.`,
    ["Save your seat today.", "Free to attend.", "Hosted by Alchemy Academy.", "Join us online."],
  );
  const event: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name,
    description: w.description ? noDashes(w.description) : description,
    startDate: w.starts_at,
    ...(w.ends_at ? { endDate: w.ends_at } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", url: absoluteUrl(path) },
    organizer: PROVIDER,
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "AUD",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(path),
    },
    ...(absoluteImage(w.image) ? { image: [absoluteImage(w.image)] } : {}),
  };
  return {
    path,
    title: workshopTitle(w.title),
    description,
    ogImage: absoluteImage(w.image) ?? undefined,
    jsonLd: [event],
  };
}

/* ===== Courses ===== */

export type CourseSeo = {
  id: number;
  title: string;
  description: string | null;
  /** One-off price in cents (USD) when the course is sold on its own. */
  unitAmount?: number | null;
  image?: string | null;
};

export function courseJsonLd(c: CourseSeo): Record<string, unknown> {
  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: c.title,
    description: (c.description ?? c.title).trim(),
    provider: PROVIDER,
    inLanguage: "en-AU",
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "online" },
    ...(absoluteImage(c.image) ? { image: absoluteImage(c.image) } : {}),
  };
  if (typeof c.unitAmount === "number" && c.unitAmount > 0) {
    out.offers = {
      "@type": "Offer",
      category: "Paid",
      price: (c.unitAmount / 100).toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(`/choose-course?course=${c.id}`),
    };
  }
  return out;
}
