import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { UserListItem, type ListUser } from "@/components/UserListItem";
import { Search, Users } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({ meta: [{ title: "Explore — Embr" }] }),
  component: ExplorePage,
});

function ExplorePage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["explore-users"],
    staleTime: 30_000,
    queryFn: async (): Promise<ListUser[]> => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,bio,follower_count")
        .order("follower_count", { ascending: false })
        .limit(200);
      return (data as ListUser[]) ?? [];
    },
  });

  const filtered = (data ?? []).filter((u) => {
    if (user && u.id === user.id) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      (u.username ?? "").toLowerCase().includes(s) ||
      (u.full_name ?? "").toLowerCase().includes(s) ||
      (u.bio ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <AppShell title="Explore">
      <div className="mx-4 mt-3">
        <div className="flex items-center gap-2 rounded-full bg-muted px-4 h-11">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, @usernames…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      <section className="mt-4">
        <div className="px-4 flex items-center gap-2 mb-2">
          <Users className="size-4 text-primary" />
          <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">People on Embr</h2>
        </div>
        <div className="divide-y divide-border">
          {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">No matches</div>
          )}
          {filtered.map((u) => <UserListItem key={u.id} user={u} />)}
        </div>
      </section>
    </AppShell>
  );
}