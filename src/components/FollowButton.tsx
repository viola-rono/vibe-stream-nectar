import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, UserPlus, UserCheck } from "lucide-react";

export function FollowButton({
  targetUserId,
  className = "",
  size = "md",
  onChange,
}: {
  targetUserId: string;
  className?: string;
  size?: "sm" | "md";
  onChange?: (following: boolean) => void;
}) {
  const { user } = useAuth();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.id === targetUserId) {
      setFollowing(false);
      return;
    }
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle()
      .then(({ data }) => setFollowing(!!data));
  }, [user, targetUserId]);

  if (!user || user.id === targetUserId) return null;

  async function toggle() {
    if (!user || busy || following === null) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    onChange?.(next);
    try {
      if (next) {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: targetUserId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        if (error) throw error;
      }
    } catch (e) {
      setFollowing(!next);
      onChange?.(!next);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const base =
    size === "sm"
      ? "h-8 px-3 text-xs"
      : "h-10 px-5 text-sm";
  const variant = following
    ? "bg-muted text-foreground hover:bg-muted/70"
    : "brand-gradient text-white shadow-sm shadow-primary/30";
  return (
    <button
      onClick={toggle}
      disabled={busy || following === null}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition active:scale-95 disabled:opacity-60 ${base} ${variant} ${className}`}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : following ? (
        <>
          <UserCheck className="size-3.5" /> Following
        </>
      ) : (
        <>
          <UserPlus className="size-3.5" /> Follow
        </>
      )}
    </button>
  );
}