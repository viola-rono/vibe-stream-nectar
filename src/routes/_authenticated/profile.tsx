import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { uploadAvatar } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Embr" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("username,full_name,bio,avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setFullName((data as any).full_name ?? "");
        setUsername((data as any).username ?? "");
        setBio((data as any).bio ?? "");
        setAvatarUrl((data as any).avatar_url ?? null);
      });
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          username: username.trim() || null,
          bio: bio.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, e.target.files[0]);
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      setAvatarUrl(url);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <AppShell title="Profile">
      <div className="card-soft mx-4 mt-3 p-6">
        <div className="flex flex-col items-center">
          <button
            onClick={() => fileInput.current?.click()}
            className="relative size-24 rounded-full brand-gradient grid place-items-center text-white text-3xl font-bold overflow-hidden"
            aria-label="Change avatar"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-24 object-cover" />
            ) : (
              (fullName || username || user?.email || "?").charAt(0).toUpperCase()
            )}
            <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] py-1 flex items-center justify-center gap-1">
              {uploading ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
              {uploading ? "Uploading" : "Change"}
            </span>
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
        </div>

        <div className="space-y-3 mt-6">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Display name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button
            onClick={save}
            disabled={saving}
            className="w-full h-11 brand-gradient text-white font-semibold rounded-xl"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}