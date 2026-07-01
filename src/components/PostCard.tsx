import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Trash2, Link as LinkIcon, Flag, EyeOff, BellOff } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { RichText } from "@/lib/rich-text";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function PostCard({
  post,
  currentUserId,
  onImageClick,
}: {
  post: FeedPost;
  currentUserId?: string;
  onImageClick?: (url: string) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes_count ?? 0);
  const [saved, setSaved] = useState(false);
  const [hidden, setHidden] = useState(false);
  const qc = useQueryClient();
  const isOwner = !!currentUserId && currentUserId === post.user_id;

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

  async function deletePost() {
    if (!isOwner) return;
    if (!confirm("Delete this post? This can't be undone.")) return;
    setHidden(true);
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      setHidden(false);
      toast.error("Couldn't delete post");
      return;
    }
    toast.success("Post deleted");
    qc.invalidateQueries({ queryKey: ["feed"] });
  }

  async function copyLink() {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  if (hidden) return null;

  return (
    <article className="card-soft mx-4 my-3 overflow-hidden">
      <header className="flex items-center gap-3 p-4">
        <Link
          to="/u/$username"
          params={{ username: post.author?.username ?? "" }}
          className="size-10 rounded-full brand-gradient grid place-items-center text-white font-bold shrink-0 overflow-hidden"
        >
          {post.author?.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt={name}
              className="size-10 rounded-full object-cover"
            />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </Link>
        <Link
          to="/u/$username"
          params={{ username: post.author?.username ?? "" }}
          className="min-w-0 flex-1"
        >
          <p className="font-semibold text-sm truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {handle} · {timeAgo(post.created_at)}
          </p>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Post options"
            className="size-9 -mr-1 rounded-full grid place-items-center hover:bg-muted transition"
          >
            <MoreHorizontal className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setSaved((s) => !s)}>
              <Bookmark className="size-4 mr-2" /> {saved ? "Unsave post" : "Save post"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyLink}>
              <LinkIcon className="size-4 mr-2" /> Copy link
            </DropdownMenuItem>
            {!isOwner && (
              <>
                <DropdownMenuItem onClick={() => { setHidden(true); toast("Post hidden"); }}>
                  <EyeOff className="size-4 mr-2" /> Hide post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast("Notifications muted")}>
                  <BellOff className="size-4 mr-2" /> Mute notifications
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => toast.success("Report submitted")}
                  className="text-destructive focus:text-destructive"
                >
                  <Flag className="size-4 mr-2" /> Report
                </DropdownMenuItem>
              </>
            )}
            {isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={deletePost}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4 mr-2" /> Delete post
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {post.content && (
        <p className="px-4 pb-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          <RichText text={post.content} />
        </p>
      )}

      {post.media_urls && post.media_urls.length > 0 && (
        <div
          className={`grid gap-1 ${
            post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {post.media_urls.slice(0, 4).map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onImageClick?.(url)}
              className="block w-full aspect-square overflow-hidden"
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </button>
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