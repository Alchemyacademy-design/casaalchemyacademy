import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminShell from "@/manus/components/admin/AdminShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminStudentsInner } from "./AdminStudents";
import { AdminPlansInner } from "./AdminPlans";

export default function PeopleHub() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"students" | "plans">(
    params.get("tab") === "plans" ? "plans" : "students",
  );
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (tab === "plans") next.set("tab", "plans"); else next.delete("tab");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <AdminShell
      title="People Hub"
      description="Students, roles and the membership plans they can subscribe to."
      crumbs={[{ label: "People Hub" }]}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as "students" | "plans")}>
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="plans">Membership plans</TabsTrigger>
        </TabsList>
        <TabsContent value="students" className="mt-4">
          <AdminStudentsInner embedded />
        </TabsContent>
        <TabsContent value="plans" className="mt-4">
          <AdminPlansInner embedded />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}