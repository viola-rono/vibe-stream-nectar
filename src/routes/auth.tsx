import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Flame, Loader2, Search, ArrowLeft, ShieldCheck, Ban } from "lucide-react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { searchAccounts, startLoginApproval, pollApproval } from "@/lib/auth-approval.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Embr" },
      { name: "description", content: "Sign in or create your Embr account to start sharing." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home" });
  },
  component: AuthPage,
});

const signupSchema = z.object({
  email: z.string().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(24)
    .regex(/^[a-z0-9_]+$/i, "Letters, numbers, underscore only"),
});

type Account = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  // Sign-in stepped flow state
  const [step, setStep] = useState<"search" | "confirm" | "password" | "waiting">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Account[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Account | null>(null);
  const [signInPassword, setSignInPassword] = useState("");
  const [approval, setApproval] = useState<{ requestId: string; code: string; email: string } | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved" | "blocked" | "expired">("pending");

  const search = useServerFn(searchAccounts);
  const startApproval = useServerFn(startLoginApproval);
  const poll = useServerFn(pollApproval);

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (mode !== "signin" || step !== "search" || q.length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await search({ data: { q } });
        setResults(rows as Account[]);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, mode, step, search]);

  // Poll approval status when waiting
  useEffect(() => {
    if (step !== "waiting" || !approval) return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      attempts++;
      try {
        const res = await poll({ data: { requestId: approval.requestId } });
        if (cancelled) return;
        setApprovalStatus(res.status);
        if (res.status === "approved") {
          const { error } = await supabase.auth.signInWithPassword({ email: approval.email, password: signInPassword });
          if (error) { toast.error(error.message); return; }
          toast.success("Welcome back");
          navigate({ to: "/home" });
          return;
        }
        if (res.status === "blocked" || res.status === "expired") return;
      } catch {}
      if (!cancelled && attempts < 150) setTimeout(tick, 2000);
    };
    tick();
    return () => { cancelled = true; };
  }, [step, approval, signInPassword, poll, navigate]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setLoading(true);
    try {
      const res = await startApproval({ data: { userId: picked.id, password: signInPassword } });
      setApproval(res);
      setApprovalStatus("pending");
      setStep("waiting");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsed = signupSchema.safeParse({ email, password, username });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Check your details");
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/home`,
          data: { username, full_name: username },
        },
      });
      if (error) throw error;
      toast.success("Welcome to Embr!");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const heroTitle = useMemo(() => {
    if (mode === "signup") return "Share the spark";
    if (step === "waiting") return "Waiting for approval";
    return "Welcome back";
  }, [mode, step]);

  function initials(a: Account) {
    const n = a.full_name || a.username || "?";
    return n.charAt(0).toUpperCase();
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="brand-gradient text-white px-6 pt-14 pb-12">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-2 mb-6">
            <div className="size-11 rounded-2xl bg-white/20 grid place-items-center">
              <Flame className="size-6" />
            </div>
            <span className="text-2xl font-extrabold">Embr</span>
          </div>
          <h1 className="text-3xl font-extrabold leading-tight">{heroTitle}</h1>
          <p className="opacity-90 mt-2 text-sm">
            {mode === "signin"
              ? step === "waiting"
                ? "Approve this sign-in from another device you're already logged into."
                : "Find your account to sign in."
              : "Create an account to start posting."}
          </p>
        </div>
      </div>

      <div className="flex-1 -mt-6">
        <div className="mx-auto max-w-md px-4">
          {mode === "signup" ? (
            <form onSubmit={submitSignup} className="card-soft p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="armenam"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 brand-gradient text-white font-semibold rounded-xl shadow-md shadow-primary/20 hover:opacity-95">
                {loading ? <Loader2 className="size-5 animate-spin" /> : "Create account"}
              </Button>
            </form>
          ) : step === "search" ? (
            <div className="card-soft p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="find">Find your account</Label>
                <div className="relative">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="find"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Username or full name"
                    autoFocus
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="min-h-[80px]">
                {searching && <p className="text-sm text-muted-foreground">Searching…</p>}
                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <p className="text-sm text-muted-foreground">No matches. Check the spelling or create an account.</p>
                )}
                <ul className="space-y-2">
                  {results.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => { setPicked(a); setStep("confirm"); }}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition text-left"
                      >
                        <div className="size-11 rounded-full brand-gradient grid place-items-center text-white font-bold overflow-hidden shrink-0">
                          {a.avatar_url ? <img src={a.avatar_url} alt="" className="size-11 object-cover" /> : initials(a)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{a.full_name || a.username}</p>
                          {a.username && <p className="text-xs text-muted-foreground truncate">@{a.username}</p>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : step === "confirm" && picked ? (
            <div className="card-soft p-6 space-y-5 text-center">
              <button onClick={() => setStep("search")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" /> Not this account
              </button>
              <div className="size-24 rounded-full brand-gradient grid place-items-center text-white text-3xl font-bold mx-auto overflow-hidden">
                {picked.avatar_url ? <img src={picked.avatar_url} alt="" className="size-24 object-cover" /> : initials(picked)}
              </div>
              <div>
                <p className="text-xl font-bold">{picked.full_name || picked.username}</p>
                {picked.username && <p className="text-sm text-muted-foreground">@{picked.username}</p>}
              </div>
              <div className="space-y-2">
                <Button onClick={() => setStep("password")} className="w-full h-12 brand-gradient text-white font-semibold rounded-xl">This is me, continue</Button>
                <Button onClick={() => { setPicked(null); setStep("search"); }} variant="outline" className="w-full h-12 rounded-xl">Not my account</Button>
              </div>
            </div>
          ) : step === "password" && picked ? (
            <form onSubmit={submitPassword} className="card-soft p-6 space-y-4">
              <button type="button" onClick={() => setStep("confirm")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" /> Back
              </button>
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-full brand-gradient grid place-items-center text-white font-bold overflow-hidden">
                  {picked.avatar_url ? <img src={picked.avatar_url} alt="" className="size-11 object-cover" /> : initials(picked)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{picked.full_name || picked.username}</p>
                  {picked.username && <p className="text-xs text-muted-foreground truncate">@{picked.username}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" autoFocus required />
              </div>
              <Button type="submit" disabled={loading || signInPassword.length < 6} className="w-full h-12 brand-gradient text-white font-semibold rounded-xl">
                {loading ? <Loader2 className="size-5 animate-spin" /> : "Continue"}
              </Button>
            </form>
          ) : step === "waiting" && approval ? (
            <div className="card-soft p-6 text-center space-y-5">
              {approvalStatus === "pending" && (
                <>
                  <div className="size-16 rounded-full bg-primary/10 grid place-items-center mx-auto">
                    <Loader2 className="size-8 text-primary animate-spin" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">Approve on another device</p>
                    <p className="text-sm text-muted-foreground mt-1">Open Embr on a device you're already signed in on and tap "Yes, it's me".</p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-xs text-muted-foreground">Match this code on your other device</p>
                    <p className="text-3xl font-bold tracking-[0.4em] mt-1">{approval.code}</p>
                  </div>
                  <button
                    onClick={() => { setApproval(null); setStep("search"); setSignInPassword(""); }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </>
              )}
              {approvalStatus === "approved" && (
                <div className="space-y-3 py-4">
                  <div className="size-16 rounded-full bg-primary/10 grid place-items-center mx-auto">
                    <ShieldCheck className="size-8 text-primary" />
                  </div>
                  <p className="font-bold">Approved — signing you in…</p>
                </div>
              )}
              {(approvalStatus === "blocked" || approvalStatus === "expired") && (
                <div className="space-y-3 py-4">
                  <div className="size-16 rounded-full bg-destructive/10 grid place-items-center mx-auto">
                    <Ban className="size-8 text-destructive" />
                  </div>
                  <p className="font-bold">{approvalStatus === "blocked" ? "Login blocked" : "Request expired"}</p>
                  <p className="text-sm text-muted-foreground">
                    {approvalStatus === "blocked"
                      ? "This login was rejected on your other device. If that wasn't you, reset your password."
                      : "No one approved this request in time. Try again."}
                  </p>
                  <Button onClick={() => { setApproval(null); setStep("search"); setSignInPassword(""); }} className="w-full h-11 rounded-xl">Try again</Button>
                </div>
              )}
            </div>
          ) : null}

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "signin" ? "New to Embr?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setStep("search");
                setPicked(null);
                setSignInPassword("");
                setApproval(null);
                setQuery("");
              }}
              className="text-primary font-semibold hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}