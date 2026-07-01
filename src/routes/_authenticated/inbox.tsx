import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Check, PenSquare, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getOrCreateDirectConversation } from "@/lib/messages";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox — Embr" }] }),
  component: InboxPage,
});

const TABS = ["All", "Unread", "Groups", "Archived"] as const;
type Tab = (typeof TABS)[number];

function InboxPage() {
  const [tab, setTab] = useState<Tab>("All");
  const [q, setQ] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch my conversations with the other participant's profile
  const { data: conversations } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id, unread_count")
        .eq("user_id", user!.id);
      const ids = (parts as any[] ?? []).map((p) => p.conversation_id);
      if (!ids.length) return [];
      const { data: convs } = await supabase
        .from("conversations")
        .select("id,type,name,avatar_url,last_message,last_message_at")
        .in("id", ids)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      // Get other participants
      const { data: allParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id,user_id")
        .in("conversation_id", ids);
      const otherIds = new Set<string>();
      (allParts as any[] ?? []).forEach((p) => { if (p.user_id !== user!.id) otherIds.add(p.user_id); });
      const { data: profs } = otherIds.size
        ? await supabase.from("profiles").select("id,username,full_name,avatar_url").in("id", Array.from(otherIds))
        : { data: [] as any[] };
      const profMap = new Map((profs as any[] ?? []).map((p) => [p.id, p]));
      const unreadMap = new Map((parts as any[] ?? []).map((p) => [p.conversation_id, p.unread_count ?? 0]));
      return (convs as any[] ?? []).map((c) => {
        const others = (allParts as any[] ?? []).filter((p) => p.conversation_id === c.id && p.user_id !== user!.id);
        const other = others[0] ? profMap.get(others[0].user_id) : null;
        return { ...c, other, unread: unreadMap.get(c.id) ?? 0 };
      });
    },
  });

  // User search when query typed
  const { data: userResults } = useQuery({
    queryKey: ["inbox-user-search", q],
    enabled: q.trim().length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const s = q.trim();
      const { data } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .or(`username.ilike.%${s}%,full_name.ilike.%${s}%`)
        .neq("id", user!.id)
        .limit(20);
      return (data as any[]) ?? [];
    },
  });

  const filteredConvs = (conversations ?? []).filter((c: any) => {
    if (tab === "Unread" && !c.unread) return false;
    if (tab === "Groups" && c.type !== "group") return false;
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (
      (c.other?.username ?? "").toLowerCase().includes(s) ||
      (c.other?.full_name ?? "").toLowerCase().includes(s) ||
      (c.last_message ?? "").toLowerCase().includes(s)
    );
  });

  async function startChatWith(otherId: string) {
    if (!user) return;
    try {
      const id = await getOrCreateDirectConversation(user.id, otherId);
      navigate({ to: "/m/$conversationId", params: { conversationId: id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't start chat");
    }
  }

  return (
    <AppShell showHeader={false}>
      <header className="brand-gradient text-white -mx-[max(0px,calc((100vw-42rem)/2))] px-4 pt-4 pb-5 rounded-b-none">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">Inbox</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate({ to: "/home" })} aria-label="Mark all read" className="size-10 grid place-items-center rounded-full bg-white/20 hover:bg-white/30">
              <Check className="size-5" />
            </button>
            <button aria-label="New message" className="size-10 grid place-items-center rounded-full bg-white/20 hover:bg-white/30">
              <PenSquare className="size-5" />
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-2xl mt-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/80" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search messages, @users…"
              className="w-full h-11 rounded-full bg-white/20 text-white placeholder:text-white/80 px-11 outline-none focus:bg-white/30 transition"
            />
          </div>
        </div>
      </header>

      <nav className="grid grid-cols-4 border-b border-border bg-card">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 text-sm font-semibold relative ${tab === t ? "text-primary" : "text-muted-foreground"}`}
          >
            {t}
            {tab === t && <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-12 brand-gradient rounded-full" />}
          </button>
        ))}
      </nav>

      {/* User search results */}
      {q.trim() && (userResults?.length ?? 0) > 0 && (
        <section className="border-b border-border">
          <h3 className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">People</h3>
          <ul className="divide-y divide-border">
            {userResults!.map((u: any) => {
              const nm = u.full_name || u.username || "User";
              return (
                <li key={u.id}>
                  <button onClick={() => startChatWith(u.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted text-left">
                    <div className="size-11 rounded-full brand-gradient grid place-items-center text-white font-bold overflow-hidden">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="size-11 object-cover" /> : nm.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{nm}</p>
                      <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                    </div>
                    <span className="text-xs font-semibold text-primary">Message</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Conversations */}
      <ul className="divide-y divide-border">
        {filteredConvs.map((c: any) => {
          const nm = c.other?.full_name || c.other?.username || c.name || "Chat";
          return (
            <li key={c.id}>
              <Link to="/m/$conversationId" params={{ conversationId: c.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                <div className="size-12 rounded-full brand-gradient grid place-items-center text-white font-bold overflow-hidden shrink-0">
                  {c.other?.avatar_url ? <img src={c.other.avatar_url} alt="" className="size-12 object-cover" /> : nm.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{nm}</p>
                    {c.unread > 0 && <span className="size-5 rounded-full brand-gradient text-white text-[10px] grid place-items-center font-bold">{c.unread}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.last_message ?? "No messages yet"}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {filteredConvs.length === 0 && !q.trim() && (
        <div className="mt-20 flex flex-col items-center text-center px-6">
          <div className="size-20 rounded-full bg-muted grid place-items-center text-muted-foreground">
            <PenSquare className="size-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold">No messages yet</h2>
          <p className="text-sm text-muted-foreground mt-1">Search a user above to start a conversation</p>
        </div>
      )}
    </AppShell>
  );
}