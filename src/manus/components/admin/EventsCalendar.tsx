import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Item {
  id: number;
  title: string;
  starts_at: string;
  kind: "event" | "workshop";
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function fmt(d: Date) { return d.toLocaleDateString(undefined, { month: "long", year: "numeric" }); }
function isoDay(d: Date) { return d.toISOString().slice(0, 10); }

export default function EventsCalendar() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const from = startOfMonth(cursor).toISOString();
  const to = endOfMonth(cursor).toISOString();

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "events-calendar", from, to],
    queryFn: async (): Promise<Item[]> => {
      const [ev, ws] = await Promise.all([
        supabase.from("events").select("id,title,starts_at").gte("starts_at", from).lte("starts_at", to),
        supabase.from("live_workshops").select("id,title,starts_at").gte("starts_at", from).lte("starts_at", to),
      ]);
      return [
        ...(ev.data ?? []).map((r) => ({ ...r, kind: "event" as const })),
        ...(ws.data ?? []).map((r) => ({ ...r, kind: "workshop" as const })),
      ].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },
  });

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>();
    data.forEach((i) => {
      const key = isoDay(new Date(i.starts_at));
      const arr = m.get(key) ?? [];
      arr.push(i);
      m.set(key, arr);
    });
    return m;
  }, [data]);

  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  const startPad = first.getDay(); // 0=Sun
  const daysInMonth = last.getDate();
  const cells: Array<{ date?: Date }> = [];
  for (let i = 0; i < startPad; i++) cells.push({});
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d) });
  while (cells.length % 7) cells.push({});

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalIcon className="h-4 w-4" />
          <div className="font-medium">{fmt(cursor)}</div>
          {isLoading && <span className="text-xs text-foreground/60">Loading…</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(startOfMonth(new Date()))}>Today</Button>
          <Button size="icon" variant="ghost" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-xs uppercase tracking-wider text-foreground/55 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, idx) => {
          if (!c.date) return <div key={idx} className="h-24 rounded bg-muted/20" />;
          const dayItems = byDay.get(isoDay(c.date)) ?? [];
          const isToday = isoDay(new Date()) === isoDay(c.date);
          return (
            <div key={idx} className={`h-24 rounded border p-1.5 text-xs overflow-hidden ${isToday ? "border-foreground/60 bg-muted/30" : "border-border/40"}`}>
              <div className="text-[10px] text-foreground/60 mb-1">{c.date.getDate()}</div>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((i) => (
                  <div
                    key={`${i.kind}-${i.id}`}
                    title={`${i.title} · ${new Date(i.starts_at).toLocaleTimeString()}`}
                    className={`truncate rounded px-1 py-0.5 ${i.kind === "workshop" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                  >
                    {i.title}
                  </div>
                ))}
                {dayItems.length > 3 && (
                  <div className="text-[10px] text-foreground/60">+{dayItems.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}