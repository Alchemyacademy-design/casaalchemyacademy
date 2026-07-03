import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminShell from "@/manus/components/admin/AdminShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminEventsInner } from "./AdminEvents";
import { AdminWorkshopsInner } from "./AdminWorkshops";

export default function EventsHub() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"events" | "workshops">(
    params.get("tab") === "workshops" ? "workshops" : "events",
  );
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (tab === "workshops") next.set("tab", "workshops"); else next.delete("tab");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <AdminShell
      title="Events Hub"
      description="In-person and online events plus live workshops in one place."
      crumbs={[{ label: "Events Hub" }]}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as "events" | "workshops")}>
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="workshops">Live workshops</TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="mt-4">
          <AdminEventsInner embedded />
        </TabsContent>
        <TabsContent value="workshops" className="mt-4">
          <AdminWorkshopsInner embedded />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}