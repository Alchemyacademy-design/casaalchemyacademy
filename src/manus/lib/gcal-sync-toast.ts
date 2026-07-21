import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type SyncAction = "upsert" | "delete" | "cancel";
type SyncTable = "events" | "live_workshops";

type SyncPayload = {
  ok?: boolean;
  status?: string;
  error?: string | null;
  google_calendar_html_link?: string | null;
  google_calendar_event_id?: string | null;
};

async function readInvokeErrorDetails(error: unknown): Promise<string | null> {
  if (error instanceof FunctionsHttpError) {
    try {
      const txt = await error.context.text();
      try {
        const parsed = JSON.parse(txt) as { error?: string; details?: string };
        return parsed.details || parsed.error || txt.slice(0, 400);
      } catch {
        return txt.slice(0, 400);
      }
    } catch {
      return null;
    }
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return null;
}

async function readCurrentRowStatus(table: SyncTable, id: number) {
  const { data } = await supabase
    .from(table)
    .select("google_calendar_sync_status, google_calendar_sync_error, google_calendar_html_link, google_calendar_event_id")
    .eq("id", id)
    .maybeSingle();
  return data as {
    google_calendar_sync_status: string | null;
    google_calendar_sync_error: string | null;
    google_calendar_html_link: string | null;
    google_calendar_event_id: string | null;
  } | null;
}

export async function callGcalSync(opts: {
  table: SyncTable;
  fn: "sync-event-to-google-calendar" | "sync-workshop-to-google-calendar";
  bodyKey: "event_id" | "workshop_id";
  id: number;
  action: SyncAction;
}): Promise<void> {
  const { table, fn, bodyKey, id, action } = opts;
  const isRemoval = action === "delete" || action === "cancel";

  const { data, error } = await supabase.functions.invoke(fn, {
    body: { [bodyKey]: id, action },
  });

  if (error) {
    // If the row is already synced, don't surface a stale generic invocation error.
    const row = await readCurrentRowStatus(table, id);
    if (row?.google_calendar_sync_status === "synced" && !isRemoval) return;
    if (row?.google_calendar_sync_status === "deleted" && isRemoval) return;

    const details = await readInvokeErrorDetails(error);
    const technical = row?.google_calendar_sync_error || details || "unknown";
    toast.error(
      isRemoval
        ? "Removed from the platform. Google Calendar may still need manual cleanup."
        : "Saved in the platform, but Google Calendar sync failed.",
      { description: `Technical reason: ${technical}` },
    );
    return;
  }

  const payload = (data as SyncPayload | null) ?? null;
  if (payload?.ok) {
    toast.success(isRemoval ? "Removed from Google Calendar" : "Synced to Google Calendar");
    return;
  }

  const row = await readCurrentRowStatus(table, id);
  const technical = payload?.error || row?.google_calendar_sync_error || payload?.status || "unknown";
  toast.error(
    isRemoval
      ? "Removed from the platform. Google Calendar may still need manual cleanup."
      : "Saved in the platform, but Google Calendar sync failed.",
    { description: `Technical reason: ${technical}` },
  );
}