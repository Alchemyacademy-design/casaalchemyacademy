import AdminTablePage from "@/manus/components/admin/AdminTablePage";

const STATUS = [
  { value: "draft", label: "draft" },
  { value: "published", label: "published" },
  { value: "archived", label: "archived" },
];

export default function AdminWorkshops() {
  return (
    <AdminTablePage
      title="Live workshops"
      description="Manage live workshops. Published items appear in /live-workshops."
      table="live_workshops"
      orderBy={{ column: "starts_at", ascending: false }}
      searchFields={["title", "slug"]}
      publicInvalidateKeys={[["public", "live_workshops"]]}
      deletionMode="archive"
      archivePatch={{ status: "archived" }}
      fields={[
        { name: "title", label: "Title", type: "text", required: true },
        { name: "slug", label: "Slug", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea", hideInTable: true },
        { name: "starts_at", label: "Starts at", type: "datetime", required: true },
        { name: "ends_at", label: "Ends at", type: "datetime", hideInTable: true },
        { name: "capacity", label: "Capacity", type: "number", hideInTable: true },
        { name: "meeting_url", label: "Meeting URL", type: "text", hideInTable: true },
        { name: "replay_url", label: "Replay URL", type: "text", hideInTable: true },
        { name: "cover_image_path", label: "Cover image path", type: "text", hideInTable: true },
        { name: "status", label: "Status", type: "select", options: STATUS, defaultValue: "draft" },
      ]}
    />
  );
}
