import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Wand2,
  Calendar,
  Newspaper,
  Building2,
  Tag,
  Users,
  Activity,
  BarChart3,
  BookOpen,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAV_ACTIONS = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard, keywords: "home dashboard" },
  { label: "Course Management", to: "/admin/course-management", icon: Wand2, keywords: "courses lessons modules" },
  { label: "Bulk lesson editor", to: "/admin/course-management?tab=bulk", icon: Wand2, keywords: "bulk lessons paste" },
  { label: "Events Hub", to: "/admin/events", icon: Calendar, keywords: "events workshops" },
  { label: "Magazine", to: "/admin/magazine", icon: Newspaper, keywords: "issues pdf" },
  { label: "Suppliers Hub", to: "/admin/suppliers", icon: Building2, keywords: "suppliers categories" },
  { label: "Deals", to: "/admin/deals", icon: Tag, keywords: "coupons offers" },
  { label: "People — Students", to: "/admin/students", icon: Users, keywords: "students members people" },
  { label: "People — Membership plans", to: "/admin/plans", icon: Users, keywords: "plans pricing billing" },
  { label: "Diagnostics", to: "/admin/diagnostics", icon: Activity, keywords: "health status" },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3, keywords: "metrics kpi" },
];

export function useAdminCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export default function AdminCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const { data: courses = [] } = useQuery({
    queryKey: ["admin", "cmdk", "courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,title,slug").limit(50);
      return (data ?? []) as Array<{ id: number; title: string; slug: string | null }>;
    },
    staleTime: 60_000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin", "cmdk", "profiles", query],
    queryFn: async () => {
      if (query.trim().length < 2) return [] as Array<{ id: string; email: string | null; display_name: string | null }>;
      const like = `%${query.trim()}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id,email,display_name")
        .or(`email.ilike.${like},display_name.ilike.${like}`)
        .limit(8);
      return (data ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>;
    },
    enabled: open,
    staleTime: 15_000,
  });

  const go = (to: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(to);
  };

  const filteredCourses = useMemo(() => {
    if (!query.trim()) return courses.slice(0, 6);
    const q = query.toLowerCase();
    return courses.filter((c) => c.title?.toLowerCase().includes(q) || c.slug?.toLowerCase().includes(q)).slice(0, 8);
  }, [courses, query]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Jump to a page, course or student…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV_ACTIONS.map((a) => (
            <CommandItem
              key={a.to}
              value={`${a.label} ${a.keywords}`}
              onSelect={() => go(a.to)}
            >
              <a.icon className="mr-2 h-4 w-4" />
              {a.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {filteredCourses.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Courses">
              {filteredCourses.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`course ${c.title} ${c.slug ?? ""}`}
                  onSelect={() => go(`/admin/courses/${c.id}`)}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  {c.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {profiles.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Students">
              {profiles.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`student ${p.email ?? ""} ${p.display_name ?? ""}`}
                  onSelect={() => go(`/admin/students/${p.id}`)}
                >
                  <User className="mr-2 h-4 w-4" />
                  <span className="truncate">{p.display_name || p.email || p.id}</span>
                  {p.email && p.display_name && (
                    <span className="ml-2 text-xs text-muted-foreground truncate">{p.email}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}