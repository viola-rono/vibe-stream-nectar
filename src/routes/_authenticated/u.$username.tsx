import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { FollowButton } from "@/components/FollowButton";
import {
  ArrowLeft, MoreHorizontal, Bell, CheckCircle2, MapPin, Calendar,
  Grid3x3, Film, Bookmark, MessageCircle, Settings, Plus, Images,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — Embr` }] }),
  component: ProfileViewPage,
});

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  follower_count: number | null;
  following_count: number | null;
  post_count: number | null;
  is_verified: boolean | null;
  created_at: string | null;
};

function formatJoined(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function ProfileViewPage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"posts" | "reels" | "saved">("posts");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-by-username", username],
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,bio,website,location,follower_count,following_count,post_count,is_verified,created_at")
        .eq("username", username)
        .maybeSingle();
      return (data as ProfileRow) ?? null;
    },
  });

  const { data: posts } = useQuery({
    queryKey: ["user-posts", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id,content,media_urls,created_at")
        .eq("user_id", profile!.id)
        .order("created_at", { ascending: false })
        .limit(60);
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="brand-gradient h-64 animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold">User not found</h1>
        <p className="text-sm text-muted-foreground mt-1">@{username} doesn't exist on Embr.</p>
        <Link to="/explore" className="mt-6 px-5 py-2.5 rounded-full brand-gradient text-white font-semibold">
          Explore people
        </Link>
      </div>
    );
  }

  const isMe = user?.id === profile.id;
  const displayName = profile.full_name || profile.username || "User";

  return (
    <div className="min-h-dvh bg-background pb-28">
      {/* Gradient header */}
      <header className="brand-gradient text-white">
        <div className="mx-auto max-w-2xl px-3 py-3 flex items-center justify-between">
          <button
            onClick={() => history.length > 1 ? history.back() : navigate({ to: "/home" })}
            aria-label="Back"
            className="size-10 grid place-items-center rounded-full hover:bg-white/15"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="font-bold text-base truncate">@{profile.username}</h1>
          <div className="flex items-center gap-1">
            <button aria-label="Alerts" onClick={() => navigate({ to: "/alerts" })} className="size-10 grid place-items-center rounded-full hover:bg-white/15">
              <Bell className="size-5" />
            </button>
            <button aria-label="More" className="size-10 grid place-items-center rounded-full hover:bg-white/15">
              <MoreHorizontal className="size-5" />
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 pt-2 pb-6">
          <div className="flex items-center gap-4">
            <div className="size-24 rounded-full bg-white/20 ring-4 ring-white/40 overflow-hidden grid place-items-center text-3xl font-bold text-white shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="size-24 object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-2xl font-extrabold truncate">{displayName}</h2>
                {profile.is_verified && <CheckCircle2 className="size-5 fill-white text-primary shrink-0" />}
              </div>
              <p className="text-white/80 text-sm">@{profile.username}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 rounded-2xl bg-white/15 backdrop-blur p-2 text-center">
            <div className="py-2">
              <p className="text-xl font-extrabold">{profile.post_count ?? 0}</p>
              <p className="text-xs text-white/80">Posts</p>
            </div>
            <Link
              to="/u/$username/followers"
              params={{ username: profile.username ?? "" }}
              className="py-2 border-x border-white/20"
            >
              <p className="text-xl font-extrabold">{profile.follower_count ?? 0}</p>
              <p className="text-xs text-white/80">Followers</p>
            </Link>
            <Link
              to="/u/$username/following"
              params={{ username: profile.username ?? "" }}
              className="py-2"
            >
              <p className="text-xl font-extrabold">{profile.following_count ?? 0}</p>
              <p className="text-xs text-white/80">Following</p>
            </Link>
          </div>
        </div>
      </header>

      {/* Bio block */}
      <section className="mx-auto max-w-2xl px-4 pt-4">
        {profile.bio && <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{profile.bio}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
          {profile.location && (
            <span className="inline-flex items-center gap-1"><MapPin className="size-4 text-primary" /> {profile.location}</span>
          )}
          {profile.created_at && (
            <span className="inline-flex items-center gap-1"><Calendar className="size-4 text-primary" /> Joined {formatJoined(profile.created_at)}</span>
          )}
        </div>
        {profile.website && (
          <a href={profile.website} target="_blank" rel="noreferrer" className="inline-block mt-2 text-sm text-primary font-medium break-all">
            {profile.website}
          </a>
        )}

        {/* Actions */}
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mt-4">
          {isMe ? (
            <>
              <Link to="/profile" className="h-11 grid place-items-center rounded-xl bg-muted font-semibold text-sm">Edit Profile</Link>
              <Link to="/settings" className="h-11 grid place-items-center rounded-xl bg-muted font-semibold text-sm">Settings</Link>
            </>
          ) : (
            <>
              <FollowButton targetUserId={profile.id} className="h-11" onChange={() => qc.invalidateQueries({ queryKey: ["profile-by-username", username] })} />
              <Link to="/inbox" className="h-11 grid place-items-center rounded-xl bg-muted font-semibold text-sm gap-2 inline-flex">
                <MessageCircle className="size-4" /> Message
              </Link>
            </>
          )}
          <Link to="/create" aria-label="Create" className="size-11 grid place-items-center rounded-xl brand-gradient text-white">
            <Plus className="size-5" />
          </Link>
        </div>
      </section>

      {/* Tabs */}
      <nav className="mt-5 border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl grid grid-cols-3 text-sm font-semibold">
          {([
            { key: "posts", label: "Posts", icon: Grid3x3 },
            { key: "reels", label: "Reels", icon: Film },
            { key: "saved", label: "Saved", icon: Bookmark },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center justify-center gap-1.5 py-3 border-b-2 transition ${
                tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </nav>

      {tab === "posts" && (
        <div className="mx-auto max-w-2xl">
          {(!posts || posts.length === 0) ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No posts yet</div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 mt-0.5">
              {posts.map((p) => {
                const cover = p.media_urls?.[0];
                return (
                  <Link
                    key={p.id}
                    to="/p/$postId"
                    params={{ postId: p.id }}
                    className="relative aspect-square bg-muted overflow-hidden"
                  >
                    {cover ? (
                      <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full p-2 text-[11px] leading-tight bg-gradient-to-br from-primary/10 to-primary/5 line-clamp-6 overflow-hidden">
                        {p.content}
                      </div>
                    )}
                    {p.media_urls && p.media_urls.length > 1 && (
                      <Images className="absolute top-1.5 right-1.5 size-4 text-white drop-shadow" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "reels" && (
        <div className="py-16 text-center text-sm text-muted-foreground">Reels coming soon</div>
      )}
      {tab === "saved" && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {isMe ? "Posts you save will appear here" : "Only the owner can see saved posts"}
        </div>
      )}
    </div>
  );
}