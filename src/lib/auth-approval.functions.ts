import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const startSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6).max(200),
});

const resolveSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["approve", "block"]),
});

const pollSchema = z.object({
  requestId: z.string().uuid(),
});

const searchSchema = z.object({
  q: z.string().trim().min(1).max(60),
});

function random6(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function requestMeta() {
  try {
    const req = getRequest();
    const ua = req?.headers.get("user-agent") ?? null;
    const fwd = req?.headers.get("x-forwarded-for") ?? "";
    const ip = fwd.split(",")[0]?.trim() || req?.headers.get("cf-connecting-ip") || null;
    const country = req?.headers.get("cf-ipcountry") ?? null;
    return { ip, ua, country };
  } catch {
    return { ip: null, ua: null, country: null };
  }
}

// Public: search up to 5 profiles by username or full_name.
export const searchAccounts = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => searchSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const term = data.q.replace(/[%_]/g, "\\$&");
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
      .limit(5);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Public: verify password, create pending approval request. Returns email for
// Device B to complete signInWithPassword once approved.
export const startLoginApproval = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => startSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");

    // Look up email for the target account.
    const { data: userLookup, error: userErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userErr || !userLookup?.user?.email) {
      throw new Error("Account not found");
    }
    const email = userLookup.user.email;

    // Verify password with a scratch (non-persisting) client.
    const scratch = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
    );
    const { data: signIn, error: signInErr } = await scratch.auth.signInWithPassword({ email, password: data.password });
    if (signInErr || !signIn?.user) {
      throw new Error("Incorrect password");
    }
    await scratch.auth.signOut().catch(() => {});

    const meta = requestMeta();
    const location = meta.country ? meta.country : null;

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("login_approval_requests")
      .insert({
        user_id: data.userId,
        code: random6(),
        status: "pending",
        ip: meta.ip,
        user_agent: meta.ua,
        location,
      })
      .select("id, code")
      .single();
    if (insErr || !inserted) throw new Error(insErr?.message ?? "Could not create approval request");

    return {
      requestId: inserted.id as string,
      code: inserted.code as string,
      email,
    };
  });

// Public: Device B polls status. Only returns non-sensitive fields.
export const pollApproval = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => pollSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("login_approval_requests")
      .select("id, status, expires_at")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { status: "expired" as const };
    if (row.status === "pending" && new Date(row.expires_at as string).getTime() < Date.now()) {
      await supabaseAdmin
        .from("login_approval_requests")
        .update({ status: "expired", resolved_at: new Date().toISOString() })
        .eq("id", data.requestId);
      return { status: "expired" as const };
    }
    return { status: row.status as "pending" | "approved" | "blocked" | "expired" };
  });

// Authenticated: signed-in user resolves an approval request for THEIR account.
export const resolveApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => resolveSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("login_approval_requests")
      .select("id, user_id, status, ip, user_agent, location, created_at")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Request not found");
    if (row.user_id !== context.userId) throw new Error("Forbidden");
    if (row.status !== "pending") return { ok: true, status: row.status };

    const nextStatus = data.action === "approve" ? "approved" : "blocked";
    const { error: updErr } = await supabaseAdmin
      .from("login_approval_requests")
      .update({ status: nextStatus, resolved_at: new Date().toISOString() })
      .eq("id", data.requestId);
    if (updErr) throw new Error(updErr.message);

    if (data.action === "block") {
      // Revoke every session for this user (kicks the attacker if they somehow got in).
      await supabaseAdmin.auth.admin.signOut(context.userId, "global").catch(() => {});
      console.warn("[security] Blocked login attempt", {
        userId: context.userId,
        ip: row.ip,
        userAgent: row.user_agent,
        location: row.location,
        at: row.created_at,
      });
    }

    return { ok: true, status: nextStatus };
  });