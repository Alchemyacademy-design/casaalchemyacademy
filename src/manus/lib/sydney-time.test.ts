import { describe, expect, it } from "vitest";
import { formatSydneyWhen, sessionHasEnded, sessionLeadLabel, sessionTitle } from "../../../supabase/functions/_shared/sydney-time";

describe("session emails and labels", () => {
  it("shows Ali's rescheduled session in Sydney daylight time", () => {
    expect(formatSydneyWhen("2026-12-03T08:00:00Z", "2026-12-03T09:00:00Z"))
      .toBe("Thursday 3 December 2026, 7pm to 8pm Sydney time (AEDT)");
  });
  it("switches to AEST outside daylight saving", () => {
    expect(formatSydneyWhen("2027-06-10T09:30:00Z", null)).toBe("Thursday 10 June 2027, 7:30pm Sydney time (AEST)");
  });
  it("labels HubSpot sign ups as Ask the Expert LIVE: title, without dashes", () => {
    expect(sessionLeadLabel("Ask the Expert LIVE - Landscape Designer")).toBe("Ask the Expert LIVE: Landscape Designer");
    expect(sessionLeadLabel("Pool Specialist")).toBe("Ask the Expert LIVE: Pool Specialist");
    expect(sessionTitle("Ask the Expert LIVE – Print Specialist")).toBe("Ask the Expert LIVE: Print Specialist");
  });
  it("treats a session as ended once its end time has passed", () => {
    const now = Date.parse("2026-11-21T09:38:00Z");
    expect(sessionHasEnded("2026-10-06T08:00:00Z", "2026-10-06T09:00:00Z", now)).toBe(true);
    expect(sessionHasEnded("2026-12-03T08:00:00Z", "2026-12-03T09:00:00Z", now)).toBe(false);
  });
});
