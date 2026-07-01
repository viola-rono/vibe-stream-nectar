import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { RichText } from "@/lib/rich-text";
import { ArrowLeft, Heart, Send, Reply } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/p/$postId")({
  head: () => ({ meta: [{ title: "Post — Embr" }] }),
  component: PostDetailPage,
});

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number | null;
  created_at: string | null;
  author?: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
};

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function PostDetailPage() {
  const { postId } = Route.useParams();
  const { user } = useAuth();
  const { data: me } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [text, setText] = useState("");
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: post, isLoading } = useQuery({
    queryKey: ["post", postId],
    queryFn: async (): Promise<FeedPost | null> => {
      const { data } = await supabase
        .from("posts")
        .select("id,user_id,content,media_urls,created_at,likes_count,comments_count")
        .eq("id", postId)
        .maybeSingle();
      if (!data) return null;
      const { data: author } = await supabase
        .from("profiles")
        .select("username,full_name,avatar_url")
        .eq("id", (data as any).user_id)
        .maybeSingle();
      return { ...(data as any), author: (author as any) ?? null };
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: async (): Promise<CommentRow[]> => {
      const { data } = await supabase
        .from("comments")
        .select("id,post_id,user_id,parent_id,content,likes_count,created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      const rows = (data as any[]) ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      const authorMap = new Map<string, any>();
      if (ids.length) {
        const { data: authors } = await supabase
          .from("profiles")
          .select("id,username,full_name,avatar_url")
          .in("id", ids);
        (authors as any[] ?? []).forEach((a) => authorMap.set(a.id, a));
      }
      return rows.map((r) => ({ ...r, author: authorMap.get(r.user_id) ?? null })) as CommentRow[];
    },
  });

  // Load which comments I've liked
  useEffect(() => {
    if (!user || !comments?.length) return;
    const ids = comments.map((c) => c.id);
    supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", user.id)
      .in("comment_id", ids)
      .then(({ data }) => {
        setLikedSet(new Set((data as any[] ?? []).map((r) => r.comment_id)));
      });
  }, [user, comments]);

  // Group comments into tree
  const tree = useMemo(() => {
    const roots: CommentRow[] = [];
    const childrenMap = new Map<string, CommentRow[]>();
    (comments ?? []).forEach((c) => {
      if (c.parent_id) {
        const arr = childrenMap.get(c.parent_id) ?? [];
        arr.push(c);
        childrenMap.set(c.parent_id, arr);
      } else {
        roots.push(c);
      }
    });
    return { roots, childrenMap };
  }, [comments]);

  // @mention autocomplete
  const [mentionQ, setMentionQ] = useState<string | null>(null);
  const { data: mentionUsers } = useQuery({
    queryKey: ["mention-search", mentionQ],
    enabled: mentionQ !== null && mentionQ.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .ilike("username", `${mentionQ}%`)
        .limit(6);
      return (data as any[]) ?? [];
    },
  });

  function onTextChange(v: string) {
    setText(v);
    const el = inputRef.current;
    const caret = el?.selectionStart ?? v.length;
    const upto = v.slice(0, caret);
    const m = /(?:^|\s)@([a-zA-Z0-9_]{1,20})$/.exec(upto);
    setMentionQ(m ? m[1] : null);
  }

  function insertMention(username: string) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? text.length;
    const upto = text.slice(0, caret);
    const rest = text.slice(caret);
    const replaced = upto.replace(/@([a-zA-Z0-9_]{1,20})$/, `@${username} `);
    setText(replaced + rest);
    setMentionQ(null);
    setTimeout(() => el?.focus(), 0);
  }

  async function submitComment() {
    if (!user || !text.trim()) return;
    const body = text.trim();
    setText("");
    const parent = replyTo?.id ?? null;
    setReplyTo(null);
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: body,
      parent_id: parent,
    });
    if (error) {
      toast.error("Couldn't post comment");
      setText(body);
      return;
    }
    qc.invalidateQueries({ queryKey: ["post-comments", postId] });
    qc.invalidateQueries({ queryKey: ["post", postId] });
  }

  async function toggleCommentLike(id: string) {
    if (!user) return;
    const wasLiked = likedSet.has(id);
    const next = new Set(likedSet);
    if (wasLiked) next.delete(id); else next.add(id);
    setLikedSet(next);
    if (wasLiked) {
      await supabase.from("comment_likes").delete().eq("comment_id", id).eq("user_id", user.id);
    } else {
      await supabase.from("comment_likes").insert({ comment_id: id, user_id: user.id });
    }
    qc.invalidateQueries({ queryKey: ["post-comments", postId] });
  }

  function CommentItem({ c, depth = 0 }: { c: CommentRow; depth?: number }) {
    const kids = tree.childrenMap.get(c.id) ?? [];
    const name = c.author?.full_name || c.author?.username || "Someone";
    const liked = likedSet.has(c.id);
    return (
      <div className={depth > 0 ? "pl-10 mt-2" : "mt-3"}>
        <div className="flex gap-2">
          <Link to="/u/$username" params={{ username: c.author?.username ?? "" }} className="size-8 rounded-full brand-gradient grid place-items-center text-white text-xs font-bold overflow-hidden shrink-0">
            {c.author?.avatar_url ? <img src={c.author.avatar_url} alt="" className="size-8 object-cover" /> : name.charAt(0).toUpperCase()}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="rounded-2xl bg-muted px-3 py-2">
              <Link to="/u/$username" params={{ username: c.author?.username ?? "" }} className="font-semibold text-sm">{name}</Link>
              <div className="text-[15px] leading-snug break-words"><RichText text={c.content} /></div>
            </div>
            <div className="flex items-center gap-4 mt-1 px-3 text-xs text-muted-foreground">
              <span>{timeAgo(c.created_at)}</span>
              <button onClick={() => toggleCommentLike(c.id)} className={`inline-flex items-center gap-1 ${liked ? "text-primary font-semibold" : ""}`}>
                <Heart className={`size-3.5 ${liked ? "fill-primary" : ""}`} /> {c.likes_count ?? 0}
              </button>
              <button onClick={() => { setReplyTo({ id: c.id, username: c.author?.username ?? "" }); inputRef.current?.focus(); }} className="inline-flex items-center gap-1">
                <Reply className="size-3.5" /> Reply
              </button>
            </div>
            {kids.map((k) => <CommentItem key={k.id} c={k} depth={depth + 1} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-40">
      <header className="brand-gradient text-white sticky top-0 z-30">
        <div className="mx-auto max-w-2xl px-3 py-3 flex items-center gap-2">
          <button onClick={() => history.length > 1 ? history.back() : navigate({ to: "/home" })} aria-label="Back" className="size-10 grid place-items-center rounded-full hover:bg-white/15">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="font-bold text-base flex-1">Post</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && !post && <div className="p-10 text-center text-sm text-muted-foreground">Post not found</div>}
        {post && (
          <>
            <PostCard post={post} currentUserId={user?.id} onImageClick={(u) => setLightbox(u)} />
            <section className="mx-4 mt-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {(comments?.length ?? 0)} comment{comments?.length === 1 ? "" : "s"}
              </h2>
              {(comments?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">Be the first to comment</p>
              )}
              {tree.roots.map((c) => <CommentItem key={c.id} c={c} />)}
            </section>
          </>
        )}
      </div>

      {/* Composer */}
      {post && user && (
        <div className="fixed bottom-16 inset-x-0 z-30 bg-card border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto max-w-2xl px-3 py-2">
            {replyTo && (
              <div className="flex items-center justify-between text-xs text-muted-foreground px-2 pb-1">
                <span>Replying to <span className="text-primary font-medium">@{replyTo.username}</span></span>
                <button onClick={() => setReplyTo(null)} className="hover:underline">Cancel</button>
              </div>
            )}
            {mentionQ && (mentionUsers?.length ?? 0) > 0 && (
              <div className="mb-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                {mentionUsers!.map((u: any) => (
                  <button key={u.id} onClick={() => insertMention(u.username)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left">
                    <div className="size-8 rounded-full brand-gradient grid place-items-center text-white text-xs font-bold overflow-hidden">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="size-8 object-cover" /> : (u.full_name ?? u.username ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{u.full_name || u.username}</p>
                      <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="size-9 rounded-full brand-gradient grid place-items-center text-white text-xs font-bold overflow-hidden shrink-0">
                {me?.avatar_url ? <img src={me.avatar_url} alt="" className="size-9 object-cover" /> : (me?.full_name ?? me?.username ?? "?").charAt(0).toUpperCase()}
              </div>
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                placeholder={replyTo ? `Reply to @${replyTo.username}…` : "Add a comment…  Use @ to mention"}
                rows={1}
                className="flex-1 resize-none rounded-2xl bg-muted px-3 py-2 text-sm outline-none max-h-32"
              />
              <button onClick={submitComment} disabled={!text.trim()} className="size-10 rounded-full brand-gradient text-white grid place-items-center disabled:opacity-40">
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <button onClick={() => setLightbox(null)} className="fixed inset-0 z-50 bg-black/95 grid place-items-center p-4" aria-label="Close image">
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
        </button>
      )}
    </div>
  );
}

// Removed placeholder empty view below; comments are now inline.

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="brand-gradient text-white sticky top-0 z-30">
        <div className="mx-auto max-w-2xl px-3 py-3 flex items-center gap-2">
          <button onClick={() => navigate({ to: "/home" })} aria-label="Back" className="size-10 grid place-items-center rounded-full hover:bg-white/15">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="font-bold text-base flex-1">Post</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && !post && (
          <div className="p-10 text-center text-sm text-muted-foreground">Post not found</div>
        )}
        {post && (
          <>
            <PostCard post={post} currentUserId={user?.id} onImageClick={(u) => setLightbox(u)} />
            <div className="card-soft mx-4 mt-3 p-6 flex flex-col items-center text-center">
              <div className="size-12 rounded-full bg-muted grid place-items-center text-muted-foreground">
                <MessageCircle className="size-5" />
              </div>
              <h3 className="mt-3 font-bold">Comments coming soon</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Threaded replies, @mentions and likes are next on the roadmap.
              </p>
            </div>
          </>
        )}
      </div>

      {lightbox && (
        <button
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/95 grid place-items-center p-4"
          aria-label="Close image"
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
        </button>
      )}
    </div>
  );
}