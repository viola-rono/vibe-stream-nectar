import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resolveApproval } from "@/lib/auth-approval.functions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, MapPin, Monitor, Loader2 } from "lucide-react";
import { toast } from "sonner";

type PendingRow = {
  id: string;
  code: string;
  ip: string | null;
  user_agent: string | null;
  location: string | null;
  created_at: string;
  status: string;
};

function describeUA(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown device";
}

export function DeviceApprovalWatcher() {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingRow | null>(null);
  const [busy, setBusy] = useState(false);
  const resolve = useServerFn(resolveApproval);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    // Catch any pending request that already existed when this device mounted.
    (async () => {
      const { data } = await supabase
        .from("login_approval_requests")
        .select("id, code, ip, user_agent, location, created_at, status, expires_at")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setPending(data as PendingRow);
    })();

    const channel = supabase
      .channel(`login-approvals-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "login_approval_requests",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as PendingRow;
          if (row.status === "pending") setPending(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function handle(action: "approve" | "block") {
    if (!pending) return;
    setBusy(true);
    try {
      await resolve({ data: { requestId: pending.id, action } });
      toast.success(action === "approve" ? "Login approved" : "Login blocked and sessions signed out");
      setPending(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!pending) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && setPending(null)}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0 sm:rounded-2xl">
        <div className="brand-gradient text-white p-6 flex flex-col items-center text-center">
          <div className="size-14 rounded-full bg-white/20 grid place-items-center mb-3">
            <ShieldAlert className="size-7" />
          </div>
          <DialogTitle className="text-xl font-bold">Is this you signing in?</DialogTitle>
          <p className="opacity-90 text-sm mt-1">Approve this login attempt from another device.</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl border p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Monitor className="size-4 text-muted-foreground" />
              <span className="font-medium">{describeUA(pending.user_agent)}</span>
            </div>
            {(pending.location || pending.ip) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4" />
                <span>{pending.location ?? pending.ip}</span>
              </div>
            )}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Verification code</p>
              <p className="text-2xl font-bold tracking-[0.4em]">{pending.code}</p>
              <p className="text-xs text-muted-foreground mt-1">Make sure the code matches on your other device.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => handle("approve")}
              disabled={busy}
              className="h-12 brand-gradient text-white font-semibold rounded-xl"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Yes, it's me"}
            </Button>
            <Button
              onClick={() => handle("block")}
              disabled={busy}
              variant="outline"
              className="h-12 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Not me — block and sign out everywhere
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}