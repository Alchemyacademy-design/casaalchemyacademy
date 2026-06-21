import AdminTablePage from "@/manus/components/admin/AdminTablePage";

export default function AdminPlans() {
  return (
    <AdminTablePage
      title="Membership plans"
      description="Plan catalogue used by /plans. Stripe prices are managed in Stripe — only metadata is editable here."
      table="membership_plans"
      orderBy={{ column: "id", ascending: true }}
      searchFields={["name", "key"]}
      publicInvalidateKeys={[["public", "membership_plans"]]}
      fields={[
        { name: "key", label: "Key", type: "text", required: true },
        { name: "name", label: "Name", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea", hideInTable: true },
        { name: "duration", label: "Duration", type: "text" },
        { name: "all_courses", label: "All courses", type: "boolean" },
        { name: "community_access", label: "Community", type: "boolean" },
        { name: "events_access", label: "Events", type: "boolean" },
        { name: "active", label: "Active", type: "boolean", defaultValue: true },
      ]}
    />
  );
}
