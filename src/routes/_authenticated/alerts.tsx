import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alerts — Embr" }] }),
  component: () => (
    <AppShell title="Alerts">
      <div className="mt-20 flex flex-col items-center text-center px-6">
        <div className="size-20 rounded-full bg-muted grid place-items-center text-muted-foreground">
          <Bell className="size-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold">You're all caught up</h2>
        <p className="text-sm text-muted-foreground mt-1">Likes, follows and mentions will show up here.</p>
      </div>
    </AppShell>
  ),
});