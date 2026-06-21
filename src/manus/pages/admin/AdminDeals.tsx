import AdminTablePage from "@/manus/components/admin/AdminTablePage";

const STATUS = [
  { value: "draft", label: "draft" },
  { value: "published", label: "published" },
  { value: "archived", label: "archived" },
];

export default function AdminDeals() {
  return (
    <AdminTablePage
      title="Exclusive deals"
      description="Member-only deals and promo codes."
      table="exclusive_deals"
      orderBy={{ column: "ends_at", ascending: false }}
      searchFields={["title", "slug"]}
      publicInvalidateKeys={[["public", "exclusive_deals"]]}
      fields={[
        { name: "title", label: "Title", type: "text", required: true },
        { name: "slug", label: "Slug", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea", hideInTable: true },
        { name: "external_url", label: "External URL", type: "text", hideInTable: true },
        { name: "starts_at", label: "Starts at", type: "datetime", hideInTable: true },
        { name: "ends_at", label: "Ends at", type: "datetime" },
        
        { name: "status", label: "Status", type: "select", options: STATUS, defaultValue: "draft" },
      ]}
    />
  );
}
