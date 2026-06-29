import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FeedPost = {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: string[] | null;
  created_at: string | null;
  likes_count: number | null;
  comments_count: number | null;
  author: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function PostCard({ post, currentUserId }: { post: FeedPost; currentUserId?: string }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes_count ?? 0);

  async function toggleLike() {
    if (!currentUserId) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    if (next) {
      const { error } = await supabase
        .from("likes")
        .insert({ post_id: post.id, user_id: currentUserId });
      if (error) {
        setLiked(false);
        setLikes((n) => n - 1);
        toast.error("Couldn't like post");
      }
    } else {
      await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUserId);
    }
  }

  const name = post.author?.full_name || post.author?.username || "Someone";
  const handle = post.author?.username ? `@${post.author.username}` : "";

  return (
    <article className="card-soft mx-4 my-3 overflow-hidden">
      <header className="flex items-center gap-3 p-4">
        <div className="size-10 rounded-full brand-gradient grid place-items-center text-white font-bold shrink-0">
          {post.author?.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt={name}
              className="size-10 rounded-full object-cover"
            />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {handle} · {timeAgo(post.created_at)}
          </p>
        </div>
      </header>

      {post.content && (
        <p className="px-4 pb-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {post.content}
        </p>
      )}

      {post.media_urls && post.media_urls.length > 0 && (
        <div
          className={`grid gap-1 ${
            post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {post.media_urls.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              loading="lazy"
              className="w-full aspect-square object-cover"
            />
          ))}
        </div>
      )}

      <footer className="flex items-center gap-1 px-2 py-1 border-t border-border/60 mt-1">
        <button
          onClick={toggleLike}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg hover:bg-muted transition"
        >
          <Heart
            className={`size-5 transition ${liked ? "fill-primary text-primary" : ""}`}
          />
          <span className={liked ? "text-primary font-medium" : ""}>{likes}</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg hover:bg-muted transition">
          <MessageCircle className="size-5" />
          <span>{post.comments_count ?? 0}</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg hover:bg-muted transition">
          <Share2 className="size-5" />
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg hover:bg-muted transition">
          <Bookmark className="size-5" />
        </button>
      </footer>
    </article>
  );
}