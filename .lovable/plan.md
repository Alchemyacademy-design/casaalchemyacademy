# Partner discount deals

## Changes
- Keep the Casa Consult card and booking page unchanged.
- Send every other deal’s Redeem offer link to its partner website in a new tab, with existing click tracking.
- Show partner logos at full width and natural height without cropping, zoom, or a dark overlay; place Members only in a top-left pill.
- Align deal cards to the top.
- Direct partner deal pages show their title, cover, price, description, and Visit partner button, never the Casa Consult booking steps.
- Keep drafts, data, colours, copy beyond the requested labels, and access rules unchanged.

## Verification and publishing
- Check Casa Consult and partner rendering, navigation, and tracking; verify phone-width layout.
- Check security results and request publishing. Report any publishing blocker without changing unrelated security policies.

## Technical details
- Branch on the exact `casa-consult` slug in Deals and DealDetail.
- Resolve partner images with `resolveAssetUrl`; keep Casa Consult booking-status calls confined to Casa Consult.