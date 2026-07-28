import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REQUESTABLE_ROLES = [
  "admin",
  "care_coordinator",
  "doctor",
  "nutritionist",
  "inventory_manager",
  "finance",
] as const;

// Public: does the system need its first super admin?
export const getBootstrapStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { needsBootstrap: (count ?? 0) === 0 };
  },
);

// Public: submit an access request
const submitSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  requested_role: z.enum(REQUESTABLE_ROLES),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const submitAccessRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reject if a user with that email already exists
    const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(listErr.message);
    if (usersList.users.some((u) => u.email?.toLowerCase() === data.email)) {
      throw new Error("An account with this email already exists. Please sign in.");
    }

    // Upsert on email (pending state) so a resubmission updates the prior request
    const { error } = await supabaseAdmin
      .from("access_requests")
      .upsert(
        {
          email: data.email,
          full_name: data.full_name,
          phone: data.phone || null,
          requested_role: data.requested_role,
          message: data.message || null,
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
        },
        { onConflict: "email" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: list all access requests
export const listAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    if (!isSuper && !isAdmin) throw new Error("Forbidden");

    const { data, error } = await supabase
      .from("access_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Admin: approve a request and invite the user via email
export const approveAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), redirect_origin: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    if (!isSuper && !isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Mark approved first so trigger picks the role up on signup
    const { data: req, error: updErr } = await supabaseAdmin
      .from("access_requests")
      .update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (updErr) throw new Error(updErr.message);
    if (!req) throw new Error("Request not found");

    // Send invite email (Supabase built-in). User sets their password on the link.
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(req.email, {
      data: { full_name: req.full_name, phone: req.phone },
      redirectTo: `${data.redirect_origin.replace(/\/$/, "")}/set-password`,
    });
    if (inviteErr) {
      // Roll status back so admin can retry
      await supabaseAdmin
        .from("access_requests")
        .update({ status: "pending", reviewed_by: null, reviewed_at: null })
        .eq("id", data.id);
      throw new Error(inviteErr.message);
    }
    return { ok: true };
  });

// Admin: reject a request
export const rejectAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    if (!isSuper && !isAdmin) throw new Error("Forbidden");

    const { error } = await supabase
      .from("access_requests")
      .update({ status: "rejected", reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: resend invite for an already-approved request
export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), redirect_origin: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    if (!isSuper && !isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req, error } = await supabaseAdmin
      .from("access_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Request not found");

    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(req.email, {
      data: { full_name: req.full_name, phone: req.phone },
      redirectTo: `${data.redirect_origin.replace(/\/$/, "")}/set-password`,
    });
    if (inviteErr) throw new Error(inviteErr.message);
    return { ok: true };
  });

export const REQUESTABLE_ROLE_VALUES = REQUESTABLE_ROLES;
