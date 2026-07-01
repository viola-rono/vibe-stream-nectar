import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { ArrowLeft, Hash } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/t/$tag")({
  head: ({ params }) => ({ meta: [{ title: `#${params.tag} — Embr` }] }),
  component: TagPage,
});

function TagPage() {
  const { tag } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["tag-posts", tag],
    queryFn: async (): Promise<FeedPost[]> => {
      const { data } = await supabase
        .from("posts")
        .select("id,user_id,content,media_urls,created_at,likes_count,comments_count")
        .ilike("content", `%#${tag}%`)
        .order("created_at", { ascending: false })
        .limit(60);
      const rows = (data as any[]) ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data: authors } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .in("id", ids);
      const map = new Map((authors as any[] ?? []).map((a) => [a.id, a]));
      return rows.map((r) => ({ ...r, author: map.get(r.user_id) ?? null })) as FeedPost[];
    },
  });

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="brand-gradient text-white sticky top-0 z-30">
        <div className="mx-auto max-w-2xl px-3 py-3 flex items-center gap-2">
          <button onClick={() => history.length > 1 ? history.back() : navigate({ to: "/home" })} aria-label="Back" className="size-10 grid place-items-center rounded-full hover:bg-white/15">
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Hash className="size-5 shrink-0" />
            <h1 className="font-bold text-lg truncate">{tag}</h1>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-2xl">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (!posts || posts.length === 0) && (
          <div className="p-10 text-center text-sm text-muted-foreground">No posts tagged #{tag} yet</div>
        )}
        {posts?.map((p) => (
          <PostCard key={p.id} post={p} currentUserId={user?.id} onImageClick={(u) => setLightbox(u)} />
        ))}
      </div>
      {lightbox && (
        <button onClick={() => setLightbox(null)} className="fixed inset-0 z-50 bg-black/95 grid place-items-center p-4" aria-label="Close image">
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
        </button>
      )}
    </div>
  );
}