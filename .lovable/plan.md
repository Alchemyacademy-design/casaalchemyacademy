# Premortem — Premium Certificate System

## Vision

Move away from the current canvas-drawn PNG (generic, low fidelity) toward a **museum-grade certificate** that matches the platform's editorial identity (Instrument Serif + Manrope, Chocolate / Terracotta / Sandstone / Gold tokens). Every certificate must exist in **two forms with identical visuals**:

1. **Online, shareable page** — a permanent public URL (`/c/:code`) the student can post on LinkedIn, send by email, or embed.
2. **Downloadable PDF** — pixel-perfect A4 landscape file, vector text, embedded fonts, generated on demand.

Both surfaces render from the **same React component** so the design never drifts.

---

## Premortem — what could go wrong, and how we prevent it


| Risk                                                         | Prevention                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF looks different from web (fonts fall back, colors shift) | Use `@react-pdf/renderer` with embedded Instrument Serif + Manrope TTFs from `/public/fonts`. Single design token file shared with the web view.                                                                                               |
| Public link leaks private student data                       | Public page shows only: student display name, course title, issued date, certificate №, verification checkmark. No email, no user id, no progress detail.                                                                                      |
| Certificates can be forged by editing the URL                | Verification uses `certificate_number` (already unique + random) as the lookup key, plus a signed `verification_hash` column. Public page reads via a `SECURITY DEFINER` RPC that only returns non-sensitive fields.                           |
| Revoked certificates still resolve publicly                  | RPC filters `revoked_at IS NULL`; revoked links render a "This certificate has been revoked" state.                                                                                                                                            |
| Slow PDF generation blocks the UI                            | Generate client-side with `@react-pdf/renderer` (fast, no server round-trip). Fallback edge function for email attachments later.                                                                                                              |
| Design becomes generic AI-looking                            | Commit to one distinctive layout: **asymmetric editorial** — oversized serif student name off-center, gold seal, thin double-rule border, small caps metadata grid, subtle paper texture. No purple gradients, no centered corporate template. |
| Mobile share preview looks broken on LinkedIn                | Add per-certificate OG image (rendered via edge function on first view, cached in `public-assets` bucket) + JSON-LD `EducationalOccupationalCredential`.                                                                                       |
| Existing `CertificatePreview` and download button diverge    | Delete the canvas download path. Both preview and real certificate render `<CertificateArtwork />`. PDF wraps the same tokens in `@react-pdf/renderer` primitives.                                                                             |


---

## Design direction (single committed style)

- **Layout**: A4 landscape, asymmetric. Left rail: vertical small-caps `CASA ALCHEMY STUDIO · CERTIFICATE №`. Center-left block: eyebrow "Certificate of Completion" → oversized Instrument Serif student name (clamp 64–96pt) → italic course title → 2-column metadata (Issued / Verify at). Right: hand-drawn gold seal SVG + signature line.
- **Palette**: `--aa-cream` background, `--aa-olive-dark` primary ink, `--aa-terracotta` accent rule, `--aa-gold` seal only. No drop shadows, no gradients.
- **Texture**: subtle SVG paper grain at 4% opacity — printable, not distracting.
- **Border**: thin double rule 12mm from edge, corner flourishes in gold.
- **Typography**: Instrument Serif (display), Manrope (labels/metadata). Embed both as TTF for PDF parity.

---

## Deliverables

### 1. Schema (migration)

- Add `certificates.verification_hash TEXT UNIQUE` (sha256 of `certificate_number || user_id || course_id || issued_at`).
- Add `certificates.public_slug TEXT UNIQUE` (short URL-safe id, e.g. `aa-x7k2m9`).
- Add `certificates.pdf_cached_path TEXT` (option`public-assets`).
- RPC `public.get_public_certificate(slug text)` — SECURITY DEFINER, returns only safe fields, filters revoked.

### 2. Shared design primitive

- `src/manus/components/certificates/CertificateArtwork.tsx` — pure presentational component, takes `{ studentName, courseTitle, issuedAt, certificateNumber, verifyUrl }`. Used by preview, member page, and public page.
- `src/manus/components/certificates/CertificatePdf.tsx` — `@react-pdf/renderer` mirror using the same tokens + embedded fonts.

### 3. Public page

- Route `/c/:slug` (unauthenticated). Renders `CertificateArtwork` + verification badge + "Download PDF" + "Share on LinkedIn" + JSON-LD.
- SEO: title `{Student} — {Course} · Casa Alchemy Studio`, description, canonical.

### 4. Member surface

- Replace `CertificateSection.tsx` canvas download with:
  - "View certificate" (opens `/c/:slug` in new tab)
  - "Download PDF" (client-side `@react-pdf/renderer` blob)
  - "Copy share link"
  - "Share on LinkedIn" (prefilled `addToProfile` URL using JSON-LD data)

### 5. Admin surface

- `AdminCertificates.tsx`: add columns for public slug + revoke action.
- `AdminCourseDetail` preview button already exists — point it at the new `CertificateArtwork`.

### 6. Backfill

- One-off migration to generate `public_slug` + `verification_hash` for existing rows.

---

## Rollout phases

**Phase 1 — Foundation (schema + shared artwork)**
Migration, RPC, `CertificateArtwork` component, replace preview usage. No user-facing behavior change yet.

**Phase 2 — Public link**
`/c/:slug` route, JSON-LD, SEO, LinkedIn share, backfill slugs.

**Phase 3 — PDF parity**
`@react-pdf/renderer` + embedded fonts, download button, remove canvas path.

**Phase 4 — Polish**
OG image edge function, admin revoke UI, verification badge micro-interactions.

---

## Technical notes

- New dep: `@react-pdf/renderer` (~1 dep, tree-shakes well). Fonts already in project or added under `/public/fonts/`.
- No new secrets required. No Stripe impact.
- Follows existing RLS: public read via SECURITY DEFINER RPC only, no broad grants on `certificates`.
- Fully compatible with the designated admin rule and current `has_role` gating.

Approve and I'll execute Phase 1 next.