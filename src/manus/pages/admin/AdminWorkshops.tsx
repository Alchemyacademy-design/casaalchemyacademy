import AdminTablePage from "@/manus/components/admin/AdminTablePage";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { callGcalSync } from "@/manus/lib/gcal-sync-toast";

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

async function callSync(workshopId: unknown, action: "upsert" | "delete" | "cancel") {
  if (workshopId == null) return;
  await callGcalSync({
    table: "live_workshops",
    fn: "sync-workshop-to-google-calendar",
    bodyKey: "workshop_id",
    id: Number(workshopId),
    action,
  });
}

const STATUS_STYLES: Record<string, string> = {
  synced: "bg-emerald-100 text-emerald-800 border-emerald-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  failed: "bg-rose-100 text-rose-800 border-rose-200",
  deleted: "bg-zinc-200 text-zinc-700 border-zinc-300",
  not_synced: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

function GCalCell({ row }: { row: Record<string, unknown> }) {
  const qc = useQueryClient();
  const status = (row.google_calendar_sync_status as string) ?? "not_synced";
  const link = row.google_calendar_html_link as string | null;
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.not_synced;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${style}`}>
        {status.replace("_", " ")}
      </span>
      {link && (
        <a href={link} target="_blank" rel="noreferrer" title="Open in Google Calendar" className="text-foreground/70 hover:text-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-1.5"
        title="Retry sync"
        onClick={async (e) => {
          e.stopPropagation();
          await callSync(row.id, "upsert");
          await qc.invalidateQueries({ queryKey: ["admin", "live_workshops"] });
        }}
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function AdminWorkshopsInner({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  return (
    <AdminTablePage
      noShell={embedded}
      title="Live workshops"
      description="Manage live workshops. Published items appear in the Events Hub and sync to Google Calendar automatically. All times follow the Academy timezone: Australia/Sydney."
      table="live_workshops"
      orderBy={{ column: "starts_at", ascending: false }}
      searchFields={["title", "slug"]}
      publicInvalidateKeys={[["public", "live_workshops"]]}
      deletionMode="hard"
      deletionLabelOverride="Delete permanently"
      beforeDelete={async (id) => {
        await callSync(id, "delete");
      }}
      afterMutate={async (op, ctx) => {
        if (!ctx?.id) return;
        if (op === "save") await callSync(ctx.id, "upsert");
        else if (op === "archive") await callSync(ctx.id, "cancel");
        await qc.invalidateQueries({ queryKey: ["admin", "live_workshops"] });
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
          render: (row) => <GCalCell row={row} />,
        },
        {
          name: "google_calendar_html_link",
          label: "GCal link",
          type: "text",
          hideInForm: true,
          hideInTable: true,
        },
      ]}
    />
  );
}

export default function AdminWorkshops() { return <AdminWorkshopsInner />; }
