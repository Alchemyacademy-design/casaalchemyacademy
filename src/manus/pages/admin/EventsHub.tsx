import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminShell from "@/manus/components/admin/AdminShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminEventsInner } from "./AdminEvents";
import { AdminWorkshopsInner } from "./AdminWorkshops";
import EventsCalendar from "@/manus/components/admin/EventsCalendar";

export default function EventsHub() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("tab");
  const [tab, setTab] = useState<"events" | "workshops" | "calendar">(
    initial === "workshops" ? "workshops" : initial === "calendar" ? "calendar" : "events",
  );
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (tab === "events") next.delete("tab"); else next.set("tab", tab);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <AdminShell
      title="Events Hub"
      description="In-person and online events plus live workshops in one place."
      crumbs={[{ label: "Events Hub" }]}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as "events" | "workshops" | "calendar")}>
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="workshops">Live workshops</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="mt-4">
          <AdminEventsInner embedded />
        </TabsContent>
        <TabsContent value="workshops" className="mt-4">
          <AdminWorkshopsInner embedded />
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <EventsCalendar />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}