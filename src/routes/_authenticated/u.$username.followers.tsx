import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserListItem, type ListUser } from "@/components/UserListItem";
import { ArrowLeft, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/u/$username/followers")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username}'s followers — Embr` }] }),
  component: FollowersPage,
});

function FollowersPage() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["followers", username],
    queryFn: async (): Promise<ListUser[]> => {
      const { data: prof } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      if (!prof) return [];
      const { data: rows } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", (prof as any).id);
      const ids = (rows ?? []).map((r: any) => r.follower_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,bio")
        .in("id", ids);
      return (profiles as ListUser[]) ?? [];
    },
  });

  const filtered = (data ?? []).filter((u) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (u.username ?? "").toLowerCase().includes(s) || (u.full_name ?? "").toLowerCase().includes(s);
  });

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="brand-gradient text-white sticky top-0 z-30">
        <div className="mx-auto max-w-2xl px-3 py-3 flex items-center gap-2">
          <button onClick={() => navigate({ to: "/u/$username", params: { username } })} aria-label="Back" className="size-10 grid place-items-center rounded-full hover:bg-white/15">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="font-bold text-base truncate flex-1">@{username} · Followers</h1>
        </div>
        <div className="mx-auto max-w-2xl px-3 pb-3">
          <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 h-10">
            <Search className="size-4 text-white/80" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search followers"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/70"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl divide-y divide-border">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">No followers yet</div>
        )}
        {filtered.map((u) => <UserListItem key={u.id} user={u} />)}
      </div>
    </div>
  );
}