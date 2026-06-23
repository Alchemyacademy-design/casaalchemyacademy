import AdminTablePage from "@/manus/components/admin/AdminTablePage";

const STATUS = [
  { value: "draft", label: "draft" },
  { value: "published", label: "published" },
  { value: "archived", label: "archived" },
];

export default function AdminEvents() {
  return (
    <AdminTablePage
      title="Events"
      description="Manage in-person and online events. Published events appear in /events."
      table="events"
      orderBy={{ column: "starts_at", ascending: false }}
      searchFields={["title", "slug", "location"]}
      publicInvalidateKeys={[["public", "events"]]}
      deletionMode="archive"
      archivePatch={{ status: "archived" }}
      fields={[
        { name: "title", label: "Title", type: "text", required: true },
        { name: "slug", label: "Slug", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea", hideInTable: true },
        { name: "starts_at", label: "Starts at", type: "datetime", required: true },
        { name: "ends_at", label: "Ends at", type: "datetime", hideInTable: true },
        { name: "location", label: "Location", type: "text" },
        { name: "capacity", label: "Capacity", type: "number", hideInTable: true },
        { name: "external_url", label: "External URL", type: "text", hideInTable: true },
        { name: "cover_image_path", label: "Cover image path", type: "text", hideInTable: true },
        { name: "status", label: "Status", type: "select", options: STATUS, defaultValue: "draft" },
      ]}
    />
  );
}
