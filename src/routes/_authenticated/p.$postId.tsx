import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/p/$postId")({
  head: () => ({ meta: [{ title: "Post — Embr" }] }),
  component: PostDetailPage,
});

function PostDetailPage() {
  const { postId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lightbox, setLightbox] = useState<string | null>(null);

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