import AdminTablePage from "@/manus/components/admin/AdminTablePage";

export default function AdminSupplierCategories({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <AdminTablePage
      noShell={embedded}
      title="Supplier categories"
      description="Categories used to group suppliers."
      table="supplier_categories"
      orderBy={{ column: "sort_order", ascending: true }}
      searchFields={["name", "slug"]}
      publicInvalidateKeys={[["public", "supplier_categories"]]}
      fields={[
        { name: "name", label: "Name", type: "text", required: true },
        { name: "slug", label: "Slug", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea", hideInTable: true },
        { name: "sort_order", label: "Order", type: "number", defaultValue: 0 },
      ]}
    />
  );
}
