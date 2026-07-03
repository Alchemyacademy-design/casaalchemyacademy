import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminShell from "@/manus/components/admin/AdminShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminSuppliersInner } from "./AdminSuppliers";
import { AdminSupplierCategoriesInner } from "./AdminSupplierCategories";

export default function SuppliersHub() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"directory" | "categories">(
    params.get("tab") === "categories" ? "categories" : "directory",
  );
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (tab === "categories") next.set("tab", "categories"); else next.delete("tab");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <AdminShell
      title="Suppliers Hub"
      description="Directory of trusted suppliers and the categories used to group them."
      crumbs={[{ label: "Suppliers Hub" }]}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as "directory" | "categories")}>
        <TabsList>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="directory" className="mt-4">
          <AdminSuppliersInner embedded />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <AdminSupplierCategoriesInner embedded />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
