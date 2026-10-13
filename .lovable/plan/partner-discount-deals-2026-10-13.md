# Partner discount deals

## Changes
- Keep the Casa Consult card and booking page unchanged.
- Always list Casa Consult first, followed by partners ordered by created_at ascending and id ascending.
- Send every other deal’s Redeem offer link to its partner website in a new tab, with existing click tracking.
- Show partner logos at full width and natural height on a padded white background without cropping, zoom, or a dark overlay; place Members only in a top-left pill.
- Show full partner descriptions on cards and detail pages, preserving line breaks and making Australian mobile numbers tappable with spaces removed from tel links.
- Align deal cards to the top.
- Direct partner deal pages show their title, cover, price, description, and Visit partner button, never the Casa Consult booking steps.
- Keep drafts, data, colours, copy beyond the requested labels, and access rules unchanged.

## Verification
- Check Casa Consult and partner rendering, navigation, and tracking; verify phone-width layout.
- Leave the site unpublished because this replacement request does not request publishing.

## Technical details
- Branch on the exact `casa-consult` slug in Deals and DealDetail.
- Resolve partner images with `resolveAssetUrl`; keep Casa Consult booking-status calls confined to Casa Consult.
- Use shared ordering and phone-description helpers wherever deals are listed.