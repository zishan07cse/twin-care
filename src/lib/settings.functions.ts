import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = [
  "super_admin",
  "admin",
  "care_coordinator",
  "doctor",
  "nutritionist",
  "inventory_manager",
  "finance",
] as const;

async function assertAdmin(supabase: any, userId: string) {
  const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  if (!isSuper && !isAdmin) throw new Error("Forbidden");
  return { isSuper: !!isSuper };
}

// ---------- Profile ----------
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  preferred_language: z.enum(["en", "bn"]).default("en"),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone || null,
        preferred_language: data.preferred_language,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Users & roles (admin) ----------
export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: users, error: uerr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (uerr) throw new Error(uerr.message);

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id,full_name,phone,preferred_language");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role");

    const pMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
    const rMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rMap.set(r.user_id, arr);
    });

    return users.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        profile: pMap.get(u.id) ?? null,
        roles: rMap.get(u.id) ?? [],
      }))
      .sort((a, b) => (a.email > b.email ? 1 : -1));
  });

const grantSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(ROLES),
});

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => grantSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isSuper } = await assertAdmin(context.supabase, context.userId);
    if (data.role === "super_admin" && !isSuper) throw new Error("Only a super admin may grant super_admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => grantSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isSuper } = await assertAdmin(context.supabase, context.userId);
    if (data.role === "super_admin" && !isSuper) throw new Error("Only a super admin may revoke super_admin");
    // Prevent revoking your own last admin/super_admin role -> lockout guard
    if (data.user_id === context.userId && (data.role === "super_admin" || data.role === "admin")) {
      throw new Error("You cannot revoke your own admin role");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ROLE_VALUES = ROLES;

// Replace ALL roles of a user with a single new role (super_admin only).
const setRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(ROLES),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isSuper } = await assertAdmin(context.supabase, context.userId);
    if (!isSuper) throw new Error("Only a super admin may change a user's role");
    if (data.user_id === context.userId && data.role !== "super_admin") {
      throw new Error("You cannot change your own super_admin role");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: derr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (derr) throw new Error(derr.message);
    const { error: ierr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (ierr) throw new Error(ierr.message);
    return { ok: true };
  });

// ---------- Password reset (super_admin only) ----------
const resetPwSchema = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(8).max(200).optional(),
  send_reset_email: z.boolean().optional(),
});

export const adminResetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resetPwSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Only a super admin may reset passwords");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.send_reset_email) {
      const { data: u, error: uerr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
      if (uerr) throw new Error(uerr.message);
      const email = u.user?.email;
      if (!email) throw new Error("User has no email");
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.SITE_URL ?? ""}/set-password`,
      });
      if (error) throw new Error(error.message);
      return { ok: true, mode: "email" as const };
    }

    if (!data.new_password) throw new Error("Provide a new password or choose email reset");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    return { ok: true, mode: "direct" as const };
  });

// ---------- Create user (super_admin only) ----------
const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  temp_password: z.string().min(8).max(200),
  role: z.enum(ROLES).optional(),
  send_invite_email: z.boolean().default(true),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Only a super admin may create users");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: cerr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.temp_password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone || null,
      },
    });
    if (cerr) throw new Error(cerr.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("User creation failed");

    // Ensure profile fields populated (trigger may already have inserted)
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: newUserId, full_name: data.full_name, phone: data.phone || null },
        { onConflict: "id" },
      );

    if (data.role) {
      const { error: rerr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: data.role });
      if (rerr && !rerr.message.includes("duplicate")) throw new Error(rerr.message);
    }

    let inviteSent = false;
    if (data.send_invite_email) {
      const siteUrl = process.env.SITE_URL || "";
      const { error: perr } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${siteUrl}/set-password`,
      });
      if (!perr) inviteSent = true;
    }

    return { ok: true, user_id: newUserId, invite_sent: inviteSent };
  });
