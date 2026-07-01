import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/m/$conversationId")({
  head: () => ({ meta: [{ title: "Chat — Embr" }] }),
  component: ChatPage,
});

type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  created_at: string | null;
};

function ChatPage() {
  const { conversationId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const { data: other } = useQuery({
    queryKey: ["chat-other", conversationId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId);
      const otherId = (parts as any[] ?? []).find((p) => p.user_id !== user!.id)?.user_id;
      if (!otherId) return null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .eq("id", otherId)
        .maybeSingle();
      return prof as any;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["chat-msgs", conversationId],
    queryFn: async (): Promise<Msg[]> => {
      const { data } = await supabase
        .from("messages")
        .select("id,conversation_id,sender_id,content,media_url,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data as Msg[]) ?? [];
    },
  });

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["chat-msgs", conversationId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, qc]);

  async function send() {
    if (!user || !text.trim()) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: body,
    });
    if (error) {
      toast.error("Couldn't send");
      setText(body);
      return;
    }
    qc.invalidateQueries({ queryKey: ["chat-msgs", conversationId] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }

  const otherName = other?.full_name || other?.username || "Chat";

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="brand-gradient text-white sticky top-0 z-30">
        <div className="mx-auto max-w-2xl px-3 py-3 flex items-center gap-3">
          <button onClick={() => navigate({ to: "/inbox" })} aria-label="Back" className="size-10 grid place-items-center rounded-full hover:bg-white/15">
            <ArrowLeft className="size-5" />
          </button>
          {other && (
            <Link to="/u/$username" params={{ username: other.username ?? "" }} className="flex items-center gap-2 min-w-0">
              <div className="size-9 rounded-full bg-white/20 overflow-hidden grid place-items-center text-sm font-bold">
                {other.avatar_url ? <img src={other.avatar_url} alt="" className="size-9 object-cover" /> : otherName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{otherName}</p>
                <p className="text-xs text-white/80 truncate">@{other.username}</p>
              </div>
            </Link>
          )}
        </div>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto mx-auto w-full max-w-2xl px-3 py-4 space-y-2">
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-[15px] break-words ${mine ? "brand-gradient text-white rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                {m.content}
              </div>
            </div>
          );
        })}
        {(messages?.length ?? 0) === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-12">Say hi 👋</p>
        )}
      </div>

      <div className="sticky bottom-0 bg-card border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto max-w-2xl px-3 py-2 flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 resize-none rounded-2xl bg-muted px-3 py-2 text-sm outline-none max-h-32"
          />
          <button onClick={send} disabled={!text.trim()} className="size-10 rounded-full brand-gradient text-white grid place-items-center disabled:opacity-40">
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}