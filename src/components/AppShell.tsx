import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Compass, Bell, User as UserIcon, Plus, MessageCircle, Search, Flame } from "lucide-react";
import { type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";

type Props = {
  title?: string;
  children: ReactNode;
  headerRight?: ReactNode;
  showHeader?: boolean;
};

export function AppShell({ title = "Embr", children, headerRight, showHeader = true }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const profileTo = profile?.username ? `/u/${profile.username}` : "/hub";

  const navItems = [
    { to: "/home", label: "Home", icon: Home },
    { to: "/explore", label: "Explore", icon: Compass },
    { to: "/create", label: "Create", icon: Plus, primary: true },
    { to: "/alerts", label: "Alerts", icon: Bell },
    { to: profileTo, label: "Profile", icon: UserIcon },
  ] as const;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {showHeader && (
        <header className="brand-gradient text-white sticky top-0 z-30 shadow-md">
          <div className="mx-auto max-w-2xl px-4 py-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight truncate flex items-center gap-2">
              <Flame className="size-6 shrink-0" aria-hidden />
              <span>{title}</span>
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              {headerRight ?? (
                <>
                  <button
                    onClick={() => navigate({ to: "/inbox" })}
                    aria-label="Inbox"
                    className="size-10 grid place-items-center rounded-full bg-white/20 hover:bg-white/30 transition"
                  >
                    <MessageCircle className="size-5" />
                  </button>
                  <button
                    onClick={() => navigate({ to: "/explore" })}
                    aria-label="Search"
                    className="size-10 grid place-items-center rounded-full bg-white/20 hover:bg-white/30 transition"
                  >
                    <Search className="size-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 mx-auto w-full max-w-2xl pb-28">{children}</main>

      <nav
        aria-label="Primary"
        className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto max-w-2xl grid grid-cols-5 items-end h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || (item.label === "Profile" && location.pathname.startsWith("/u/"));
            if ("primary" in item && item.primary) {
              return (
                <li key={item.to} className="flex justify-center -mt-6">
                  <Link
                    to={item.to}
                    aria-label={item.label}
                    className="size-14 rounded-full brand-gradient text-white grid place-items-center shadow-lg shadow-primary/30 active:scale-95 transition"
                  >
                    <Icon className="size-6" strokeWidth={2.5} />
                  </Link>
                </li>
              );
            }
            return (
              <li key={item.to} className="flex">
                <Link
                  to={item.to}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export async function signOut(then: () => void) {
  await supabase.auth.signOut();
  then();
}

export { Button };