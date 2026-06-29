import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Flame, Loader2 } from "lucide-react";
import { z } from "zod";

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

const credsSchema = z.object({
  email: z.string().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});
const signupSchema = credsSchema.extend({
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(24)
    .regex(/^[a-z0-9_]+$/i, "Letters, numbers, underscore only"),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
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
      } else {
        const parsed = credsSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Check your details");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/home" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function forgot() {
    if (!email) return toast.error("Enter your email first");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success("Check your email for a reset link");
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
          <h1 className="text-3xl font-extrabold leading-tight">
            {mode === "signin" ? "Welcome back" : "Share the spark"}
          </h1>
          <p className="opacity-90 mt-2 text-sm">
            {mode === "signin"
              ? "Sign in to catch up with your people."
              : "Create an account to start posting."}
          </p>
        </div>
      </div>

      <div className="flex-1 -mt-6">
        <div className="mx-auto max-w-md px-4">
          <form onSubmit={submit} className="card-soft p-6 space-y-4">
            {mode === "signup" && (
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
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={forgot}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 brand-gradient text-white font-semibold rounded-xl shadow-md shadow-primary/20 hover:opacity-95"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "signin" ? "New to Embr?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
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