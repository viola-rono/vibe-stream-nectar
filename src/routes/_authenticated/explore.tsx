import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Compass } from "lucide-react";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({ meta: [{ title: "Explore — Embr" }] }),
  component: () => (
    <AppShell title="Explore">
      <div className="mt-20 flex flex-col items-center text-center px-6">
        <div className="size-20 rounded-full bg-muted grid place-items-center text-muted-foreground">
          <Compass className="size-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Discover what's hot</h2>
        <p className="text-sm text-muted-foreground mt-1">Trending posts, people and hashtags land here.</p>
      </div>
    </AppShell>
  ),
});