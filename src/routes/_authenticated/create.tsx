import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Globe, Image as ImageIcon, X, Smile, MapPin, Users, Music, Hash, Palette, Crown, Loader2, Lock, Check, Search, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { uploadPostMedia, compressImage } from "@/lib/upload";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({ meta: [{ title: "Create — Embr" }] }),
  component: CreatePage,
});

const MAX_LEN = 500;

const FEELINGS: { emoji: string; label: string }[] = [
  { emoji: "😊", label: "happy" }, { emoji: "🥰", label: "loved" }, { emoji: "😢", label: "sad" },
  { emoji: "😍", label: "in love" }, { emoji: "😤", label: "frustrated" }, { emoji: "😴", label: "sleepy" },
  { emoji: "🎉", label: "celebrating" }, { emoji: "🔥", label: "motivated" }, { emoji: "😎", label: "cool" },
  { emoji: "🤔", label: "thoughtful" }, { emoji: "😂", label: "laughing" }, { emoji: "🥳", label: "excited" },
  { emoji: "😇", label: "blessed" }, { emoji: "😌", label: "relaxed" }, { emoji: "🤩", label: "amazed" },
  { emoji: "😋", label: "hungry" }, { emoji: "🥶", label: "cold" }, { emoji: "🥵", label: "hot" },
];

const THEMES: { key: string; label: string; className: string }[] = [
  { key: "none", label: "None", className: "" },
  { key: "sunset", label: "Sunset", className: "bg-gradient-to-br from-orange-400 via-pink-500 to-rose-600 text-white" },
  { key: "ocean", label: "Ocean", className: "bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 text-white" },
  { key: "forest", label: "Forest", className: "bg-gradient-to-br from-emerald-400 via-green-600 to-teal-700 text-white" },
  { key: "berry", label: "Berry", className: "bg-gradient-to-br from-fuchsia-500 via-purple-600 to-violet-700 text-white" },
  { key: "gold", label: "Gold", className: "bg-gradient-to-br from-yellow-300 via-amber-500 to-orange-600 text-white" },
  { key: "night", label: "Night", className: "bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white" },
  { key: "candy", label: "Candy", className: "bg-gradient-to-br from-pink-300 via-fuchsia-400 to-purple-500 text-white" },
  { key: "mint", label: "Mint", className: "bg-gradient-to-br from-teal-300 via-emerald-400 to-cyan-500 text-white" },
  { key: "coral", label: "Coral", className: "bg-gradient-to-r from-rose-400 to-orange-400 text-white" },
  { key: "red", label: "Red", className: "bg-red-600 text-white" },
  { key: "blue", label: "Blue", className: "bg-blue-600 text-white" },
  { key: "black", label: "Black", className: "bg-black text-white" },
];

type FeelingSel = { emoji: string; label: string } | null;
type LocationSel = { name: string; lat?: number; lon?: number } | null;
type SongSel = { title: string; artist: string; artwork: string; preview: string } | null;
type PersonSel = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };

function CreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const fileInput = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [audience, setAudience] = useState<"public" | "followers" | "private">("public");
  const [feeling, setFeeling] = useState<FeelingSel>(null);
  const [location, setLocation] = useState<LocationSel>(null);
  const [song, setSong] = useState<SongSel>(null);
  const [tagged, setTagged] = useState<PersonSel[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [theme, setTheme] = useState<string>("none");
  const [openDlg, setOpenDlg] = useState<null | "feeling" | "location" | "people" | "song" | "hashtag" | "theme">(null);
  const themeObj = THEMES.find((t) => t.key === theme) ?? THEMES[0];

  const displayName =
    profile?.full_name ??
    profile?.username ??
    (user?.user_metadata?.username as string) ??
    user?.email?.split("@")[0] ??
    "you";

  const audienceOpts = [
    { key: "public", label: "Public", desc: "Anyone on Embr", icon: Globe },
    { key: "followers", label: "Followers", desc: "People who follow you", icon: Users },
    { key: "private", label: "Only me", desc: "Just for you", icon: Lock },
  ] as const;
  const currentAudience = audienceOpts.find((a) => a.key === audience)!;

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
        visibility: audience,
        status: "published",
        feeling: feeling ?? null,
        location: location ?? null,
        song: song ?? null,
        theme: theme === "none" ? null : theme,
        tagged_users: tagged.length ? tagged.map((t) => t.id) : null,
        hashtags: hashtags.length ? hashtags : null,
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
            <div className="size-12 rounded-full brand-gradient grid place-items-center text-white font-bold ring-2 ring-primary/30 overflow-hidden shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="size-12 object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p className="font-bold">
                {displayName}
                {feeling && <span className="font-normal text-muted-foreground"> is feeling {feeling.emoji} {feeling.label}</span>}
                {tagged.length > 0 && (
                  <span className="font-normal text-muted-foreground"> with <span className="font-semibold text-foreground">{tagged[0].full_name || tagged[0].username}</span>{tagged.length > 1 && ` and ${tagged.length - 1} other${tagged.length - 1 > 1 ? "s" : ""}`}</span>
                )}
                {location && <span className="font-normal text-muted-foreground"> at <span className="font-semibold text-foreground">{location.name}</span></span>}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border border-border bg-background hover:bg-muted transition">
                  <currentAudience.icon className="size-3.5" /> {currentAudience.label}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60">
                  {audienceOpts.map((opt) => (
                    <DropdownMenuItem key={opt.key} onClick={() => setAudience(opt.key)} className="gap-3">
                      <opt.icon className="size-4" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                      {audience === opt.key && <Check className="size-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {theme !== "none" && previews.length === 0 ? (
            <div className={`mt-3 rounded-xl p-6 min-h-[220px] grid place-items-center ${themeObj.className}`}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 150))}
                placeholder="What's on your mind?"
                rows={4}
                className="w-full resize-none bg-transparent text-center text-xl font-bold placeholder:text-white/70 focus:outline-none"
              />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
              placeholder="What's on your mind?"
              rows={5}
              className="mt-3 w-full resize-none bg-transparent text-[15px] placeholder:text-muted-foreground/70 focus:outline-none"
            />
          )}

          {song && (
            <div className="mt-2 flex items-center gap-3 p-2 rounded-lg bg-muted/60">
              <img src={song.artwork} alt="" className="size-10 rounded" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{song.title}</p>
                <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
              </div>
              <button onClick={() => setSong(null)} className="size-7 rounded-full hover:bg-background/60 grid place-items-center"><X className="size-4" /></button>
            </div>
          )}

          {hashtags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {hashtags.map((h) => (
                <span key={h} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">#{h}</span>
              ))}
            </div>
          )}

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
          <Row color="bg-yellow-100 text-yellow-600" icon={<Smile className="size-5" />} title="Feeling / Activity" subtitle={feeling ? `${feeling.emoji} ${feeling.label}` : "How are you feeling?"} onClick={() => setOpenDlg("feeling")} />
          <Row color="bg-blue-100 text-blue-600" icon={<MapPin className="size-5" />} title="Add Location" subtitle={location ? location.name : "Tag your location"} onClick={() => setOpenDlg("location")} />
          <Row color="bg-purple-100 text-purple-600" icon={<Users className="size-5" />} title="Tag People" subtitle={tagged.length ? `${tagged.length} tagged` : "Who are you with?"} onClick={() => setOpenDlg("people")} />
          <Row color="bg-violet-100 text-violet-600" icon={<Music className="size-5" />} title="Add Song" subtitle={song ? `${song.title} — ${song.artist}` : "Add music to your post"} onClick={() => setOpenDlg("song")} />
          <Row color="bg-emerald-100 text-emerald-600" icon={<Hash className="size-5" />} title="Add Hashtags" subtitle={hashtags.length ? hashtags.map((h) => `#${h}`).join(" ") : "Reach more people"} onClick={() => setOpenDlg("hashtag")} />
          <Row color="bg-orange-100 text-orange-600" icon={<Palette className="size-5" />} title="Post Theme" subtitle={theme === "none" ? "None" : themeObj.label} onClick={() => setOpenDlg("theme")} />
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

      <FeelingDialog open={openDlg === "feeling"} onOpenChange={(o) => setOpenDlg(o ? "feeling" : null)} onPick={(f) => { setFeeling(f); setOpenDlg(null); }} current={feeling} />
      <LocationDialog open={openDlg === "location"} onOpenChange={(o) => setOpenDlg(o ? "location" : null)} onPick={(l) => { setLocation(l); setOpenDlg(null); }} current={location} />
      <PeopleDialog open={openDlg === "people"} onOpenChange={(o) => setOpenDlg(o ? "people" : null)} tagged={tagged} setTagged={setTagged} meId={user?.id ?? null} />
      <SongDialog open={openDlg === "song"} onOpenChange={(o) => setOpenDlg(o ? "song" : null)} onPick={(s) => { setSong(s); setOpenDlg(null); }} />
      <HashtagDialog open={openDlg === "hashtag"} onOpenChange={(o) => setOpenDlg(o ? "hashtag" : null)} tags={hashtags} setTags={setHashtags} />
      <ThemeDialog open={openDlg === "theme"} onOpenChange={(o) => setOpenDlg(o ? "theme" : null)} theme={theme} setTheme={setTheme} />
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

function FeelingDialog({ open, onOpenChange, onPick, current }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (f: FeelingSel) => void; current: FeelingSel }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>How are you feeling?</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
          {FEELINGS.map((f) => (
            <button key={f.label} onClick={() => onPick(f)} className={`p-3 rounded-lg text-center hover:bg-muted transition ${current?.label === f.label ? "bg-primary/10 ring-1 ring-primary" : ""}`}>
              <div className="text-3xl">{f.emoji}</div>
              <div className="text-xs font-medium mt-1 capitalize">{f.label}</div>
            </button>
          ))}
        </div>
        {current && <button onClick={() => onPick(null)} className="text-sm text-destructive mt-2">Clear feeling</button>}
      </DialogContent>
    </Dialog>
  );
}

function LocationDialog({ open, onOpenChange, onPick, current }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (l: LocationSel) => void; current: LocationSel }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1&q=${encodeURIComponent(q)}`, { headers: { "Accept-Language": "en" } });
        const data = await r.json();
        setResults(Array.isArray(data) ? data : []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add location</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places..." className="pl-9" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto -mx-2">
          {loading && <p className="text-sm text-muted-foreground px-3 py-2">Searching…</p>}
          {!loading && q && results.length === 0 && <p className="text-sm text-muted-foreground px-3 py-2">No places found</p>}
          {results.map((r: any) => (
            <button key={r.place_id} onClick={() => onPick({ name: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) })} className="w-full text-left px-3 py-2 hover:bg-muted rounded-lg flex items-start gap-2">
              <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
              <span className="text-sm">{r.display_name}</span>
            </button>
          ))}
        </div>
        {current && <button onClick={() => onPick(null)} className="text-sm text-destructive mt-2">Remove location</button>}
      </DialogContent>
    </Dialog>
  );
}

function PeopleDialog({ open, onOpenChange, tagged, setTagged, meId }: { open: boolean; onOpenChange: (o: boolean) => void; tagged: PersonSel[]; setTagged: (v: PersonSel[]) => void; meId: string | null }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PersonSel[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || !meId) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        if (q.trim().length === 0) {
          // Load followers/following as default suggestions
          const { data: follows } = await supabase.from("follows").select("following_id, follower_id").or(`follower_id.eq.${meId},following_id.eq.${meId}`).limit(50);
          const ids = Array.from(new Set((follows ?? []).flatMap((f: any) => [f.follower_id, f.following_id]).filter((id) => id !== meId)));
          if (ids.length) {
            const { data: profs } = await supabase.from("profiles").select("id,username,full_name,avatar_url").in("id", ids).limit(30);
            setResults((profs ?? []) as PersonSel[]);
          } else setResults([]);
        } else {
          const term = q.trim();
          const { data: profs } = await supabase.from("profiles").select("id,username,full_name,avatar_url").or(`username.ilike.%${term}%,full_name.ilike.%${term}%`).neq("id", meId).limit(20);
          setResults((profs ?? []) as PersonSel[]);
        }
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, meId]);
  function toggle(p: PersonSel) {
    if (tagged.find((t) => t.id === p.id)) setTagged(tagged.filter((t) => t.id !== p.id));
    else setTagged([...tagged, p]);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Tag people</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search followers & friends..." className="pl-9" />
        </div>
        {tagged.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tagged.map((t) => (
              <span key={t.id} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full inline-flex items-center gap-1">
                @{t.username ?? "user"}<button onClick={() => toggle(t)}><X className="size-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="max-h-[45vh] overflow-y-auto -mx-2">
          {loading && <p className="text-sm text-muted-foreground px-3 py-2">Loading…</p>}
          {results.map((p) => {
            const on = !!tagged.find((t) => t.id === p.id);
            return (
              <button key={p.id} onClick={() => toggle(p)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg text-left">
                <div className="size-9 rounded-full brand-gradient overflow-hidden grid place-items-center text-white text-sm font-bold shrink-0">
                  {p.avatar_url ? <img src={p.avatar_url} alt="" className="size-9 object-cover" /> : (p.full_name ?? p.username ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.full_name ?? p.username}</p>
                  <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                </div>
                {on && <Check className="size-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SongDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (s: SongSel) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!open || q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`https://itunes.apple.com/search?media=music&entity=song&limit=15&term=${encodeURIComponent(q)}`);
        const data = await r.json();
        setResults(data.results ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, open]);
  useEffect(() => { return () => { audioRef.current?.pause(); }; }, []);
  function togglePlay(url: string) {
    if (!audioRef.current) audioRef.current = new Audio();
    if (playing === url) { audioRef.current.pause(); setPlaying(null); return; }
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
    setPlaying(url);
  }
  function choose(t: any) {
    audioRef.current?.pause();
    onPick({ title: t.trackName, artist: t.artistName, artwork: t.artworkUrl100?.replace("100x100", "200x200") ?? t.artworkUrl100, preview: t.previewUrl });
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) audioRef.current?.pause(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add a song</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs, artists..." className="pl-9" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto -mx-2 space-y-1">
          {loading && <p className="text-sm text-muted-foreground px-3 py-2">Searching…</p>}
          {results.map((t: any) => (
            <div key={t.trackId} className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg">
              <img src={t.artworkUrl100} alt="" className="size-10 rounded" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{t.trackName}</p>
                <p className="text-xs text-muted-foreground truncate">{t.artistName}</p>
              </div>
              {t.previewUrl && (
                <button onClick={() => togglePlay(t.previewUrl)} className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center">
                  {playing === t.previewUrl ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
              )}
              <button onClick={() => choose(t)} className="text-xs font-semibold px-3 py-1.5 rounded-full brand-gradient text-white">Add</button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HashtagDialog({ open, onOpenChange, tags, setTags }: { open: boolean; onOpenChange: (o: boolean) => void; tags: string[]; setTags: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  function add() {
    const parts = input.split(/[\s,]+/).map((s) => s.replace(/^#/, "").trim().toLowerCase()).filter(Boolean);
    const next = Array.from(new Set([...tags, ...parts])).slice(0, 15);
    setTags(next);
    setInput("");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add hashtags</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input autoFocus value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="travel, food, sunset" />
          <button onClick={add} className="px-4 rounded-md brand-gradient text-white text-sm font-semibold">Add</button>
        </div>
        <div className="flex flex-wrap gap-1.5 min-h-[40px]">
          {tags.map((t) => (
            <span key={t} className="text-sm bg-primary/10 text-primary px-2.5 py-1 rounded-full inline-flex items-center gap-1">
              #{t}<button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="size-3" /></button>
            </span>
          ))}
          {tags.length === 0 && <p className="text-xs text-muted-foreground">Separate multiple tags with spaces or commas.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ThemeDialog({ open, onOpenChange, theme, setTheme }: { open: boolean; onOpenChange: (o: boolean) => void; theme: string; setTheme: (t: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Post theme</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Themes apply to short text posts (≤150 chars) with no photos.</p>
        <div className="grid grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto">
          {THEMES.map((t) => (
            <button key={t.key} onClick={() => { setTheme(t.key); onOpenChange(false); }} className={`aspect-square rounded-lg grid place-items-center text-xs font-bold p-2 text-center ${t.className || "bg-muted text-foreground"} ${theme === t.key ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
              {t.label}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}