import { useQuery } from "@tanstack/react-query";
import AdminTablePage from "@/manus/components/admin/AdminTablePage";
import { supabase } from "@/integrations/supabase/client";

const STATUS = [
  { value: "draft", label: "draft" },
  { value: "published", label: "published" },
  { value: "archived", label: "archived" },
];

type CategoryRow = { id: number; name: string };

type Props = { embedded?: boolean };
export default function AdminSuppliers(props: Props = {}) {
  const { embedded = false } = props;
  const categoriesQuery = useQuery<CategoryRow[]>({
    queryKey: ["admin-supplier-categories-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_categories")
        .select("id,name")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });

  const categoryOptions = [
    { value: "", label: "— none —" },
    ...(categoriesQuery.data ?? []).map((c) => ({
      value: String(c.id),
      label: c.name,
    })),
  ];

  return (
    <AdminTablePage
      noShell={embedded}
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
        {
          name: "category_id",
          label: "Category",
          type: "select",
          numericValue: true,
          options: categoryOptions,
          render: (row: Record<string, unknown>) => {
            const id = row.category_id as number | null;
            if (id == null) return <span className="text-foreground/50">—</span>;
            const match = (categoriesQuery.data ?? []).find((c) => c.id === id);
            return <span>{match?.name ?? `#${id}`}</span>;
          },
        },
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
