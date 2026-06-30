import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, User as UserIcon, Lock, Bell, Palette, Globe, HelpCircle, FileText,
  LogOut, ChevronRight, Crown, Shield, Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Embr" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="brand-gradient text-white sticky top-0 z-30">
        <div className="mx-auto max-w-2xl px-3 py-3 flex items-center gap-2">
          <button onClick={() => navigate({ to: "/hub" })} aria-label="Back" className="size-10 grid place-items-center rounded-full hover:bg-white/15">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="font-bold text-base flex-1">Settings</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
        <div className="card-soft p-4 flex items-center gap-3 brand-gradient text-white">
          <Crown className="size-6" />
          <div className="flex-1">
            <p className="font-bold">Upgrade to Embr Plus</p>
            <p className="text-xs text-white/85">Verified badge, longer posts and more.</p>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-white text-primary text-xs font-bold">Soon</span>
        </div>

        <SettingsSection title="Account">
          <SettingsRow icon={UserIcon} label="Edit profile" to="/profile" />
          <SettingsRow icon={Lock} label="Password & security" />
          <SettingsRow icon={Shield} label="Privacy" />
        </SettingsSection>

        <SettingsSection title="Preferences">
          <SettingsRow icon={Bell} label="Notifications" />
          <SettingsRow icon={Palette} label="Appearance" />
          <SettingsRow icon={Globe} label="Language & region" />
        </SettingsSection>

        <SettingsSection title="Support">
          <SettingsRow icon={HelpCircle} label="Help center" />
          <SettingsRow icon={FileText} label="Terms & privacy" />
        </SettingsSection>

        <button onClick={signOut} className="card-soft w-full p-4 flex items-center justify-center gap-2 text-destructive font-semibold">
          <LogOut className="size-5" /> Sign out
        </button>

        <button className="card-soft w-full p-4 flex items-center justify-center gap-2 text-muted-foreground font-medium text-sm">
          <Trash2 className="size-4" /> Delete account
        </button>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="card-soft divide-y divide-border/60">{children}</div>
    </section>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  to,
}: {
  icon: typeof UserIcon;
  label: string;
  to?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 p-4">
      <div className="size-9 rounded-full bg-muted grid place-items-center"><Icon className="size-4" /></div>
      <span className="flex-1 font-medium text-sm">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return <button className="w-full text-left" onClick={() => toastSoon(label)}>{inner}</button>;
}

function toastSoon(what: string) {
  toast(`${what} — coming soon`);
}