import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Check, PenSquare, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox — Embr" }] }),
  component: InboxPage,
});

const TABS = ["All", "Unread", "Groups", "Archived"] as const;
type Tab = (typeof TABS)[number];

function InboxPage() {
  const [tab, setTab] = useState<Tab>("All");
  const navigate = useNavigate();

  return (
    <AppShell showHeader={false}>
      <header className="brand-gradient text-white -mx-[max(0px,calc((100vw-42rem)/2))] px-4 pt-4 pb-5 rounded-b-none">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">Inbox</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate({ to: "/home" })} aria-label="Mark all read" className="size-10 grid place-items-center rounded-full bg-white/20 hover:bg-white/30">
              <Check className="size-5" />
            </button>
            <button aria-label="New message" className="size-10 grid place-items-center rounded-full bg-white/20 hover:bg-white/30">
              <PenSquare className="size-5" />
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-2xl mt-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/80" />
            <input
              placeholder="Search messages..."
              className="w-full h-11 rounded-full bg-white/20 text-white placeholder:text-white/80 px-11 outline-none focus:bg-white/30 transition"
            />
          </div>
        </div>
      </header>

      <nav className="grid grid-cols-4 border-b border-border bg-card">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 text-sm font-semibold relative ${tab === t ? "text-primary" : "text-muted-foreground"}`}
          >
            {t}
            {tab === t && <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-12 brand-gradient rounded-full" />}
          </button>
        ))}
      </nav>

      <div className="mt-20 flex flex-col items-center text-center px-6">
        <div className="size-20 rounded-full bg-muted grid place-items-center text-muted-foreground">
          <Search className="size-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold">No messages yet</h2>
        <p className="text-sm text-muted-foreground mt-1">Start a conversation</p>
      </div>
    </AppShell>
  );
}