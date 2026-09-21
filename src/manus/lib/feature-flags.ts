// Single-course purchases are temporarily switched off (the Stripe price still
// bills monthly). Set this back to true to re-enable the "Choose Course" button
// on the Individual Course card, the Plans page option, the /choose-course
// purchase flow and the Master Guides purchase modal.
export const INDIVIDUAL_COURSE_OPEN = false;

// Launch week annual offer: US$649 / year through a dedicated Stripe Payment
// Link. Outside the window the regular US$708 annual link is used.
export const LAUNCH_ANNUAL_PAYMENT_LINK = "https://buy.stripe.com/fZueVe7Nv3Sne2x5CWaZi0c";

// Launch window: Tue 22 Sept 2026 8:00am AEST to Fri 25 Sept 2026 11:59pm AEST.
// To change the window, edit the two dates below (+10:00 means Sydney time).
const LAUNCH_START = new Date("2026-09-22T08:00:00+10:00");
const LAUNCH_END = new Date("2026-09-25T23:59:59+10:00");

export function isLaunchPricingActive(): boolean {
  if (typeof window !== "undefined" && window.location.search.includes("preview=open")) {
    return true;
  }
  const now = new Date();
  return now >= LAUNCH_START && now <= LAUNCH_END;
}
