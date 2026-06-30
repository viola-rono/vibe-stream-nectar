import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { Image as ImageIcon, Video, Smile, ImageOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — Embr" }] }),
  component: HomePage,
});

async function fetchFeed(): Promise<FeedPost[]> {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id,user_id,content,media_urls,created_at,likes_count,comments_count")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = posts ?? [];
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  let authorsById = new Map<string, FeedPost["author"]>();
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,username,full_name,avatar_url")
      .in("id", ids);
    authorsById = new Map(
      (profiles ?? []).map((p: any) => [
        p.id,
        { username: p.username, full_name: p.full_name, avatar_url: p.avatar_url },
      ]),
    );
  }
  return rows.map((r) => ({ ...r, author: authorsById.get(r.user_id) ?? null }));
}

function HomePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: fetchFeed,
    staleTime: 30_000,
  });

  return (
    <AppShell>
      <div className="card-soft mx-4 mt-3 p-4">
        <Link
          to="/create"
          className="flex items-center gap-3"
          aria-label="Create a post"
        >
          <div className="size-10 rounded-full brand-gradient grid place-items-center text-white font-bold shrink-0 overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="size-10 object-cover" />
            ) : (
              (profile?.full_name ?? profile?.username ?? user?.email ?? "?")
                .toString()
                .charAt(0)
                .toUpperCase()
            )}
          </div>
          <div className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm text-muted-foreground">
            Share your thoughts…
          </div>
        </Link>
        <div className="grid grid-cols-3 mt-3 pt-3 border-t border-border/60 text-sm">
          <Link to="/create" className="flex items-center justify-center gap-2 py-1.5 text-primary font-medium">
            <ImageIcon className="size-4" /> Photo
          </Link>
          <Link to="/create" className="flex items-center justify-center gap-2 py-1.5 text-primary font-medium">
            <Video className="size-4" /> Video
          </Link>
          <Link to="/create" className="flex items-center justify-center gap-2 py-1.5 text-primary font-medium">
            <Smile className="size-4" /> Feeling
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3 mt-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-soft mx-4 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-muted rounded" />
                  <div className="h-3 w-1/4 bg-muted rounded" />
                </div>
              </div>
              <div className="h-40 mt-3 bg-muted rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="mt-12 px-6 text-center">
          <div className="size-20 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </div>
          <h2 className="mt-4 text-lg font-bold">No posts yet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Follow people to see their posts here, or be the first to share something!
          </p>
          <Link
            to="/create"
            className="inline-block mt-6 px-6 py-3 rounded-xl brand-gradient text-white font-semibold shadow-md shadow-primary/20"
          >
            Create your first post
          </Link>
        </div>
      )}

      {data?.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={user?.id}
          onImageClick={(u) => setLightbox(u)}
        />
      ))}

      {lightbox && (
        <button
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/95 grid place-items-center p-4"
          aria-label="Close image"
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
        </button>
      )}
    </AppShell>
  );
}