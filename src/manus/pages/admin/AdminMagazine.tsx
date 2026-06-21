import AdminTablePage from "@/manus/components/admin/AdminTablePage";

const STATUS = [
  { value: "draft", label: "draft" },
  { value: "published", label: "published" },
  { value: "archived", label: "archived" },
];

export default function AdminMagazine() {
  return (
    <AdminTablePage
      title="Magazine issues"
      description="Manage magazine issues. Published issues appear in /magazine."
      table="magazine_issues"
      orderBy={{ column: "id", ascending: false }}
      searchFields={["title", "slug"]}
      publicInvalidateKeys={[["public", "magazine_issues"]]}
      fields={[
        { name: "title", label: "Title", type: "text", required: true },
        { name: "slug", label: "Slug", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea", hideInTable: true },
        { name: "external_file_url", label: "PDF / file URL", type: "text", required: true },
        { name: "cover_image_path", label: "Cover image path", type: "text", hideInTable: true },
        { name: "published_at", label: "Published at", type: "datetime" },
        { name: "status", label: "Status", type: "select", options: STATUS, defaultValue: "draft" },
      ]}
    />
  );
}
