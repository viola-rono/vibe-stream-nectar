import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Globe, Image as ImageIcon, X, Smile, MapPin, Users, Music, Hash, Palette, Crown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadPostMedia, compressImage } from "@/lib/upload";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({ meta: [{ title: "Create — Embr" }] }),
  component: CreatePage,
});

const MAX_LEN = 500;

function CreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const username = (user?.user_metadata?.username as string) ?? user?.email?.split("@")[0] ?? "you";

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, 4 - files.length);
    if (!picked.length) return;
    const compressed = await Promise.all(picked.map(compressImage));
    setFiles((cur) => [...cur, ...compressed].slice(0, 4));
    setPreviews((cur) => [...cur, ...compressed.map((f) => URL.createObjectURL(f))].slice(0, 4));
    e.target.value = "";
  }

  function removeAt(i: number) {
    URL.revokeObjectURL(previews[i]);
    setFiles((cur) => cur.filter((_, idx) => idx !== i));
    setPreviews((cur) => cur.filter((_, idx) => idx !== i));
  }

  async function share() {
    if (!user) return;
    const text = content.trim();
    if (!text && files.length === 0) {
      toast.error("Add some text or a photo first");
      return;
    }
    setSubmitting(true);
    try {
      const media_urls = files.length ? await uploadPostMedia(user.id, files) : [];
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: text || null,
        media_urls: media_urls.length ? media_urls : null,
        media_type: media_urls.length ? "image" : null,
        visibility: "public",
        status: "published",
      });
      if (error) throw error;
      toast.success("Post shared!");
      qc.invalidateQueries({ queryKey: ["feed"] });
      navigate({ to: "/home" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const canShare = (content.trim().length > 0 || files.length > 0) && !submitting;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="brand-gradient text-white sticky top-0 z-30">
        <div className="mx-auto max-w-2xl px-3 py-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <button
            onClick={() => navigate({ to: "/home" })}
            aria-label="Back"
            className="size-10 grid place-items-center rounded-full hover:bg-white/15"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-center font-bold text-lg">Create Post</h1>
          <button
            onClick={share}
            disabled={!canShare}
            className="px-5 h-10 rounded-full bg-white/25 disabled:opacity-50 font-semibold text-sm flex items-center gap-2"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Share
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-3 pt-3 pb-32 space-y-3">
        <section className="card-soft p-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full brand-gradient grid place-items-center text-white font-bold ring-2 ring-primary/30">
              {username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold">{username}</p>
              <button className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border border-border bg-background">
                <Globe className="size-3.5" /> Public
              </button>
            </div>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
            placeholder="What's on your mind?"
            rows={5}
            className="mt-3 w-full resize-none bg-transparent text-[15px] placeholder:text-muted-foreground/70 focus:outline-none"
          />

          {previews.length > 0 && (
            <div className={`grid gap-2 mt-2 ${previews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="w-full aspect-square object-cover rounded-lg" />
                  <button
                    onClick={() => removeAt(i)}
                    aria-label="Remove"
                    className="absolute top-1.5 right-1.5 size-7 rounded-full bg-black/60 text-white grid place-items-center"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/60 text-xs">
            <span className="text-muted-foreground">
              {content.length}/{MAX_LEN}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
              <Crown className="size-3.5" /> 1K on Plus
            </span>
          </div>
        </section>

        <section className="card-soft divide-y divide-border/60">
          <Row
            color="bg-pink-100 text-pink-600"
            icon={<ImageIcon className="size-5" />}
            title="Photo / Video"
            subtitle={`Add up to 4 photos — auto-compressed${files.length ? ` (${files.length}/4)` : ""}`}
            onClick={() => fileInput.current?.click()}
          />
          <Row color="bg-yellow-100 text-yellow-600" icon={<Smile className="size-5" />} title="Feeling / Activity" subtitle="How are you feeling?" />
          <Row color="bg-blue-100 text-blue-600" icon={<MapPin className="size-5" />} title="Add Location" subtitle="Tag your location" />
          <Row color="bg-purple-100 text-purple-600" icon={<Users className="size-5" />} title="Tag People" subtitle="Who are you with?" />
          <Row color="bg-violet-100 text-violet-600" icon={<Music className="size-5" />} title="Add Song" subtitle="Add music to your post" />
          <Row color="bg-emerald-100 text-emerald-600" icon={<Hash className="size-5" />} title="Add Hashtags" subtitle="Reach more people" />
          <Row color="bg-orange-100 text-orange-600" icon={<Palette className="size-5" />} title="Post Theme" subtitle="None" />
        </section>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPick}
        />
      </main>
    </div>
  );
}

function Row({
  color,
  icon,
  title,
  subtitle,
  onClick,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-4 text-left hover:bg-muted/40 transition"
    >
      <div className={`size-11 rounded-full grid place-items-center ${color} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="font-bold text-[15px] truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
    </button>
  );
}