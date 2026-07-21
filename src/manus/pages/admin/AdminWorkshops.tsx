import AdminTablePage from "@/manus/components/admin/AdminTablePage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATUS = [
  { value: "draft", label: "draft" },
  { value: "published", label: "published" },
  { value: "archived", label: "archived" },
];

const SYNC_STATUS = [
  { value: "not_synced", label: "not synced" },
  { value: "pending", label: "pending" },
  { value: "synced", label: "synced" },
  { value: "failed", label: "failed" },
  { value: "deleted", label: "deleted" },
];

async function callSync(workshopId: unknown, action: "upsert" | "delete") {
  if (workshopId == null) return;
  const { data, error } = await supabase.functions.invoke("sync-workshop-to-google-calendar", {
    body: { workshop_id: Number(workshopId), action },
  });
  if (error) {
    toast.error("Google Calendar sync failed", { description: error.message });
    return;
  }
  const payload = data as { ok?: boolean; status?: string; error?: string | null } | null;
  if (payload?.ok) {
    toast.success(action === "delete" ? "Removed from Google Calendar" : "Synced to Google Calendar");
  } else {
    toast.error("Google Calendar sync returned an error", {
      description: payload?.error ?? payload?.status ?? "unknown",
    });
  }
}

export function AdminWorkshopsInner({ embedded = false }: { embedded?: boolean }) {
  return (
    <AdminTablePage
      noShell={embedded}
      title="Live workshops"
      description="Manage live workshops. Published items appear in the Events Hub and sync to Google Calendar automatically."
      table="live_workshops"
      orderBy={{ column: "starts_at", ascending: false }}
      searchFields={["title", "slug"]}
      publicInvalidateKeys={[["public", "live_workshops"]]}
      deletionMode="archive"
      archivePatch={{ status: "archived" }}
      afterMutate={(op, ctx) => {
        if (!ctx?.id) return;
        if (op === "save") void callSync(ctx.id, "upsert");
        else if (op === "archive" || op === "delete") void callSync(ctx.id, "delete");
      }}
      fields={[
        { name: "title", label: "Title", type: "text", required: true },
        { name: "slug", label: "Slug", type: "text", required: true, deriveSlugFrom: "title", placeholder: "Auto-generated from title" },
        { name: "description", label: "Description", type: "textarea", hideInTable: true },
        { name: "starts_at", label: "Starts at", type: "datetime", required: true },
        { name: "ends_at", label: "Ends at", type: "datetime", hideInTable: true },
        { name: "capacity", label: "Capacity", type: "number", hideInTable: true },
        { name: "meeting_url", label: "Meeting URL", type: "text", hideInTable: true },
        { name: "replay_url", label: "Replay URL", type: "text", hideInTable: true },
        {
          name: "cover_image_path",
          label: "Cover image",
          type: "file",
          uploadFolder: "workshops",
          accept: "image/*",
          preview: true,
          hideInTable: true,
          placeholder: "Upload or paste an image URL",
        },
        { name: "status", label: "Status", type: "select", options: STATUS, defaultValue: "draft" },
        {
          name: "google_calendar_sync_status",
          label: "GCal",
          type: "select",
          options: SYNC_STATUS,
          defaultValue: "not_synced",
          hideInForm: true,
        },
        {
          name: "google_calendar_html_link",
          label: "GCal link",
          type: "text",
          hideInForm: true,
        },
      ]}
    />
  );
}

export default function AdminWorkshops() { return <AdminWorkshopsInner />; }
