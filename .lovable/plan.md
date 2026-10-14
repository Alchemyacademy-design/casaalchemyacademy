# Individual course prices, 6 month access and course purchase gate

## Prices found in Stripe (live, read only)
- The Path to a Colourful Life (course 1), prod_VR9NPGPhPthJBG: default price `price_1UQH5CK9GJLTk49Ti2zWxbEJ`, USD 399.00, one_time, live. Matches.
- Dominating Compositions (course 12), prod_UiwxdgrcqKGV5q: default price `price_1TjV3NK9GJLTk49T3X0aKpmq`, USD 159.00, one_time, live. Matches.
These are each product's only active price, so nothing blocks the work.

## 1. Price records (database)
- `public.stripe_prices`: add two rows with plan_key `individual_course`, course_id 1 and 12, the price and product ids above, usd, 39900 and 15900, livemode true, active true, is_checkout_default true, recurring fields null.
- Row id 7 (the generic USD 159 monthly one): set active false and is_checkout_default false.
- `create-checkout-session`: only use the price row for that exact course (drop the fallback to a generic row with course_id null), check the price against the course's own amount instead of the fixed 15900, and send back COURSE_NOT_PURCHASABLE when a course has no price of its own.
- New public helper `get_individual_course_prices()` that returns course id, slug, title, cover and amount for live, active, one-off course prices. Visitors can read it, and it shows no Stripe ids. The gate, /choose-course and the landing "From" price all read from it.

## 2. Six month access
- `supabase/functions/_shared/billing-core.ts` (one-off course payment section) and the database function `private.apply_stripe_course_payment`: change the grant from 3 months to 6 months. Only new purchases are affected; existing access end dates stay as they are. The stacking rule stays the same, using 6 month blocks. I'll read the function's current code before writing the migration.

## 3. Course purchase gate
- `CourseCard.tsx`: for courses the viewer can't open, replace "AVAILABLE WITH SUBSCRIPTION OR SOLD INDIVIDUALLY" with a "Purchase here" button. The same button goes on the locked state of `CourseDetail.tsx`.
- New `CoursePurchaseGate` pop-up with three options, in this order:
  1. Annual member: USD 59 / month, every course, billed yearly (USD 708), "Best value" tag. Uses the existing Join Annual action.
  2. Monthly member: USD 99 / month, every course, cancel anytime. Uses the existing Join Monthly action.
  3. This course only: USD [price], one-time payment, 6 months access. Starts that course's checkout through the existing flow (signed-out visitors log in first, then come back).
  If a course has no price of its own, only options 1 and 2 show.

## 4. Turn on individual course sales
- `feature-flags.ts`: set `INDIVIDUAL_COURSE_OPEN = true`.
- `Home.tsx` Price row, Individual column: "From USD 159" (the lowest course price), sub line "One-time payment, 6 months access", and a "Choose course" button styled like the other two that goes to /choose-course. The "Length of access" row changes to "6 months".
- `CourseCheckout.tsx` (/choose-course): list only courses that have their own price, show each one's price, and start checkout for the chosen course.
- `Guides.tsx` and `Plans.tsx` are also controlled by the same switch, so they will open too. Their wording is covered in step 5.

## 5. Wording
- Replace "3 months" and the flat "USD 159" individual course wording with per-course price and 6 months in: `Plans.tsx` (individual description), `CourseCheckout.tsx` (benefit list), `Home.tsx` (access row), and the billing-core comment. Before editing, I'll search again for any other individual course wording, including the legal and terms pages.

## Verifying without charging a real card
- Server check: call create-checkout-session for course 1 and course 12 while signed in, and confirm the Stripe session that comes back has the right price id and amount (USD 399 and USD 159) and is a one-time payment. Then leave the session unpaid so it expires, with no charge. Also check that a course without its own price is refused.
- Fulfilment check: replay a signed test of the "checkout completed" event through the webhook's processing logic (or a direct call to the database function inside a rolled-back transaction) to confirm the access end date is purchase date + 6 months.
- Screen checks with Playwright at 1280 and 390: the gate's options, the two-option version, /choose-course listing, and the landing Price row.
- Limit: signed-in browser testing isn't available on this project, so the signed-in checkout call needs either you clicking through to the Stripe page (and stopping before paying), or a test account session. A real end-to-end purchase would need a live card and a refund, so I won't do one unless you ask.

## Technical notes
- Tables changed: `stripe_prices` (2 new rows, row 7 switched off). Functions changed: `private.apply_stripe_course_payment` and the new `get_individual_course_prices`.
- Edge functions changed: create-checkout-session, _shared/billing-core.ts (stripe-webhook redeploys with it).
- No price is created in Stripe and nothing in Stripe is edited.
