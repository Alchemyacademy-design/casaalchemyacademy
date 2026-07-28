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
      deletionMode="hard"
      fields={[
        { name: "title", label: "Title", type: "text", required: true },
        { name: "slug", label: "Slug", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea", hideInTable: true },
        {
          name: "external_file_url",
          label: "PDF / file",
          type: "file",
          required: true,
          hideInTable: true,
          uploadFolder: "magazine/files",
          accept: "application/pdf",
          preview: false,
          placeholder: "Upload PDF or paste an external URL",
        },
        {
          name: "cover_image_path",
          label: "Cover image",
          type: "file",
          hideInTable: true,
          uploadFolder: "magazine/covers",
          accept: "image/*",
          placeholder: "Upload cover or paste image URL",
        },
        {
          name: "video_url",
          label: "Featured video (optional)",
          type: "file",
          hideInTable: true,
          uploadFolder: "magazine/videos",
          accept: "video/*",
          preview: false,
          placeholder: "Upload a video or paste an external MP4 URL",
          virtual: true,
          virtualHost: "description",
          virtualMarker: "video",
        },
        { name: "published_on", label: "Published on", type: "datetime" },
        { name: "status", label: "Status", type: "select", options: STATUS, defaultValue: "draft" },
      ]}
    />
  );
}
