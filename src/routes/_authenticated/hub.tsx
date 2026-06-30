import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, LogOut, User as UserIcon, Settings, Bookmark, Shield } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/hub")({
  head: () => ({ meta: [{ title: "Hub — Embr" }] }),
  component: HubPage,
});

function HubPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const username = profile?.username ?? (user?.user_metadata?.username as string) ?? user?.email?.split("@")[0] ?? "you";
  const hasUsername = !!profile?.username;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell title="Hub">
      {hasUsername ? (
        <Link
          to="/u/$username"
          params={{ username: profile!.username! }}
          className="card-soft mx-4 mt-3 p-4 flex items-center gap-4"
        >
          <ProfileHeader profile={profile} username={username} />
        </Link>
      ) : (
        <Link to="/profile" className="card-soft mx-4 mt-3 p-4 flex items-center gap-4">
          <ProfileHeader profile={profile} username={username} />
        </Link>
      )}

      <div className="card-soft mx-4 mt-3 divide-y divide-border/60">
        {hasUsername ? (
          <Link to="/u/$username" params={{ username: profile!.username! }} className="flex items-center gap-3 p-4">
            <div className="size-10 rounded-full bg-muted grid place-items-center"><UserIcon className="size-5" /></div>
            <span className="flex-1 font-medium">My profile</span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </Link>
        ) : null}
        <Link to="/profile" className="flex items-center gap-3 p-4">
          <div className="size-10 rounded-full bg-muted grid place-items-center"><UserIcon className="size-5" /></div>
          <span className="flex-1 font-medium">Edit profile</span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
        <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => toast("Saved — coming soon")}>
          <div className="size-10 rounded-full bg-muted grid place-items-center"><Bookmark className="size-5" /></div>
          <span className="flex-1 font-medium">Saved</span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
        <Link to="/settings" className="flex items-center gap-3 p-4">
          <div className="size-10 rounded-full bg-muted grid place-items-center"><Settings className="size-5" /></div>
          <span className="flex-1 font-medium">Settings</span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
        <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => toast("Privacy — coming soon")}>
          <div className="size-10 rounded-full bg-muted grid place-items-center"><Shield className="size-5" /></div>
          <span className="flex-1 font-medium">Privacy</span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
      </div>

      <button
        onClick={signOut}
        className="mx-4 mt-4 w-[calc(100%-2rem)] card-soft p-4 flex items-center justify-center gap-2 text-destructive font-semibold"
      >
        <LogOut className="size-5" /> Sign out
      </button>
    </AppShell>
  );
}

function ProfileHeader({
  profile,
  username,
}: {
  profile: { full_name: string | null; username: string | null; avatar_url: string | null } | null | undefined;
  username: string;
}) {
  return (
    <>
        <div className="size-14 rounded-full brand-gradient grid place-items-center text-white text-xl font-bold overflow-hidden">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="size-14 object-cover" />
          ) : (
            username.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base truncate">{profile?.full_name ?? username}</p>
          <p className="text-xs text-muted-foreground truncate">@{username}</p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" />
    </>
  );
}