# CommunityPremium responsive layout — plan

Goal: make the Community page premium-quality on mobile (<768px) and tablet (768–1279px) without touching data hooks. All work is in two files:

- `src/manus/components/community/CommunityPremium.tsx` (structure + state)
- `src/manus/styles/community-premium.css` (breakpoint CSS)

The current shell is a CSS grid `4.5rem 17rem 1fr` on `.aa-community-shell`, with a fourth optional House Rules panel collapsed via `rulesOpen` state (currently only initialized once from a JS `matchMedia(1280px)` check — never re-evaluated on resize).

## Breakpoint strategy

Single source of truth = CSS media queries on the existing `.aa-community-*` classes. React state only drives the mobile drawer open/close and the rules panel toggle. No new resize listeners, no per-render `matchMedia` reads.

```text
<768px  mobile    single column: main only; rail+channels in a Sheet
768-1279 tablet   rail (4.5rem) + main; channels in a Sheet; rules closed by default
>=1280  desktop   rail + channels + main + optional rules panel (unchanged)
```

## Structural changes in `CommunityPremium.tsx`

1. Add two state flags:
   - `navOpen: boolean` — controls the mobile/tablet Sheet that hosts the Spaces rail + Channels list.
   - Keep existing `rulesOpen` but stop seeding it from `matchMedia`; default to `false`. Desktop users can still expand it via the existing Collapsible trigger. This removes the stale-on-resize bug.
2. Wrap the existing Spaces rail (`.aa-community-spaces`) and Channels panel (`.aa-community-channels`) JSX in a small `NavPanels` fragment so it can be rendered in two places:
   - Inline inside `.aa-community-shell` (shown by CSS on ≥768px for rail, ≥1280px for channels).
   - Inside a `<Sheet side="left">` triggered by a new header hamburger button (shown by CSS only <1280px — same Sheet component pattern already used for `openPost` and `reportOpen` in this file, and matching `MemberLayout.tsx`'s mobile nav).
3. Add a hamburger button to `.aa-community-header` (left side, before the title). CSS hides it at ≥1280px.
4. Auto-close the Sheet when a channel is selected (`onChannelSelect` callback already exists in the current channel-list click handlers — just call `setNavOpen(false)` alongside the existing navigation).
5. No changes to hooks, queries, memoization, or the post composer's data flow.

## CSS changes in `community-premium.css`

Rewrite only the grid + visibility rules. Card/post/composer internals stay as-is.

```text
/* desktop default (unchanged behavior) */
.aa-community-shell { grid-template-columns: 4.5rem 17rem minmax(0,1fr); }

@media (max-width: 1279px) {
  .aa-community-shell { grid-template-columns: 4.5rem minmax(0,1fr); }
  .aa-community-channels.is-inline { display: none; }   /* channels move to Sheet */
  .aa-community-rules-wrap { display: none; }           /* rules panel hidden on tablet */
}

@media (max-width: 767px) {
  .aa-community-shell { grid-template-columns: minmax(0,1fr); }
  .aa-community-spaces.is-inline { display: none; }     /* rail also moves to Sheet */
  .aa-community-header { padding: 1rem 1rem; }
  .aa-community-toolbar { padding: .6rem 1rem; }
  .aa-community-feed-inner { padding: .75rem; }
}

/* hamburger visibility */
.aa-community-nav-trigger { display: inline-flex; }
@media (min-width: 1280px) { .aa-community-nav-trigger { display: none; } }
```

The Sheet content reuses `.aa-community-spaces` + `.aa-community-channels` with an `is-sheet` modifier that forces `display:flex` regardless of the media query above.

## Touch target audit (mobile only, scoped via media query)

```text
@media (max-width: 767px) {
  .aa-community-channels nav button { min-height: 44px; padding: .75rem .9rem; font-size: .85rem; }
  .aa-community-spaces button       { width: 44px; height: 44px; }
  .aa-community-filters button      { min-height: 40px; padding: .55rem .8rem; }
  .aa-community-reactions button    { min-height: 36px; padding: .35rem .6rem; }
  .aa-community-header button,
  .aa-community-toolbar button      { min-height: 44px; }
}
```

44px is the Apple/WCAG target; 36–40px is acceptable for inline chips inside a card.

## Composer above the keyboard (mobile)

The composer lives inside `.aa-community-main` and today relies on `100dvh`. Two small fixes:

- Keep `height: 100dvh` on the shell (already there via `calc(100dvh - 4rem)`), which correctly shrinks when the mobile keyboard opens on iOS 16+/Android Chrome.
- On mobile, make the composer sticky to the bottom of `.aa-community-main` with `position: sticky; bottom: 0` and a safe-area inset: `padding-bottom: max(.75rem, env(safe-area-inset-bottom))`. Ensures Publish stays visible when the textarea grows.
- Give the textarea `min-height: 88px` and `max-height: 40dvh` on mobile so it never eats the viewport.

## What I will NOT change

- `useCommunityPremiumData`, `useChannelBySlug`, any Supabase call, realtime subscription, or notification logic.
- Post rendering, reactions, moderation, report/thread Sheets (they already work).
- Desktop appearance at ≥1280px (aside from the width fix already shipped in the previous prompt).

## Verification

1. Playwright: load `/community` at 375×812, 768×1024, 1280×900. Screenshot each; open the nav Sheet on mobile, select a channel, confirm it closes and thread renders full-width.
2. Playwright mobile: focus the composer textarea, type, screenshot — confirm Publish button remains on-screen.
3. Manual: resize desktop → mobile in browser to confirm nothing overflows horizontally.

Confirm the approach and I'll implement it in one pass.