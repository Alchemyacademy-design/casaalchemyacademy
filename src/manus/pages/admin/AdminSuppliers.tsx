import AdminTablePage from "@/manus/components/admin/AdminTablePage";

const STATUS = [
  { value: "draft", label: "draft" },
  { value: "published", label: "published" },
  { value: "archived", label: "archived" },
];

export default function AdminSuppliers() {
  return (
    <AdminTablePage
      title="Suppliers"
      description="Manage the trusted-suppliers directory shown in /suppliers."
      table="suppliers"
      orderBy={{ column: "name", ascending: true }}
      searchFields={["name", "country", "email"]}
      publicInvalidateKeys={[["public", "suppliers"]]}
      fields={[
        { name: "name", label: "Name", type: "text", required: true },
        { name: "slug", label: "Slug", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea", hideInTable: true },
        { name: "category_id", label: "Category ID", type: "number" },
        { name: "country", label: "Country", type: "text" },
        { name: "email", label: "Email", type: "text", hideInTable: true },
        { name: "phone", label: "Phone", type: "text", hideInTable: true },
        { name: "website_url", label: "Website", type: "text", hideInTable: true },
        { name: "logo_image_path", label: "Logo image path", type: "text", hideInTable: true },
        { name: "status", label: "Status", type: "select", options: STATUS, defaultValue: "draft" },
      ]}
    />
  );
}
