import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const patientSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  full_name_bn: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().min(1).max(40),
  alt_phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  date_of_birth: z.string().optional().nullable().or(z.literal("")),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  nid: z.string().trim().max(40).optional().nullable(),
  emergency_contact_name: z.string().trim().max(200).optional().nullable(),
  emergency_contact_phone: z.string().trim().max(40).optional().nullable(),
  preferred_language: z.enum(["en", "bn"]).default("en"),
  status: z.enum(["active", "paused", "completed", "dropped"]).default("active"),
  enrolled_on: z.string().optional().nullable().or(z.literal("")),
  height_cm: z.number().nullable().optional(),
  weight_kg: z.number().nullable().optional(),
  hba1c_baseline: z.number().nullable().optional(),
  fbg_baseline: z.number().nullable().optional(),
  ppbg_baseline: z.number().nullable().optional(),
  bp_systolic_baseline: z.number().int().nullable().optional(),
  bp_diastolic_baseline: z.number().int().nullable().optional(),
  diabetes_years: z.number().int().nullable().optional(),
  comorbidities: z.array(z.string()).optional().nullable(),
  current_medications: z.string().trim().max(4000).optional().nullable(),
  allergies: z.string().trim().max(1000).optional().nullable(),
  referring_doctor_id: z.string().uuid().nullable().optional().or(z.literal("")),
  treating_doctor_id: z.string().uuid().nullable().optional().or(z.literal("")),
  nutritionist_id: z.string().uuid().nullable().optional().or(z.literal("")),
  hospital_id: z.string().uuid().nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export type PatientValues = z.infer<typeof patientSchema>;

function normalize(v: PatientValues) {
  const clean: any = { ...v };
  const nullIfBlank = [
    "email", "date_of_birth", "enrolled_on",
    "referring_doctor_id", "treating_doctor_id", "nutritionist_id", "hospital_id",
  ];
  for (const k of nullIfBlank) if (clean[k] === "") clean[k] = null;
  return clean;
}

export const listPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("patients")
      .select(
        "*, treating_doctor:doctors!patients_treating_doctor_id_fkey(id, full_name), referring_doctor:doctors!patients_referring_doctor_id_fkey(id, full_name), nutritionist:nutritionists(id, full_name), hospital:hospitals(id, name)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPatient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: patient, error } = await context.supabase
      .from("patients")
      .select(
        "*, treating_doctor:doctors!patients_treating_doctor_id_fkey(id, full_name), referring_doctor:doctors!patients_referring_doctor_id_fkey(id, full_name), nutritionist:nutritionists(id, full_name), hospital:hospitals(id, name)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!patient) throw new Error("Not found");
    const { data: timeline } = await context.supabase
      .from("patient_timeline")
      .select("*")
      .eq("patient_id", data.id)
      .order("created_at", { ascending: false });
    return { patient, timeline: timeline ?? [] };
  });

export const upsertPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: patientSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const values = normalize(data.values);
    if (data.id) {
      const { error } = await context.supabase
        .from("patients")
        .update(values)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("patients")
      .insert({ ...values, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id };
  });

export const deletePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("patients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addTimelineNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        patient_id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(4000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("patient_timeline").insert({
      patient_id: data.patient_id,
      event_type: "note",
      title: data.title,
      description: data.description ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAssignmentOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const [doctors, nutritionists, hospitals] = await Promise.all([
      context.supabase.from("doctors").select("id, full_name, is_referrer, is_treating").eq("is_active", true).order("full_name"),
      context.supabase.from("nutritionists").select("id, full_name").eq("is_active", true).order("full_name"),
      context.supabase.from("hospitals").select("id, name").eq("is_active", true).order("name"),
    ]);
    return {
      doctors: doctors.data ?? [],
      nutritionists: nutritionists.data ?? [],
      hospitals: hospitals.data ?? [],
    };
  });

// Admin: link a patient record to an auth user by email (creates user via invite if needed).
export const linkPatientToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        patient_id: z.string().uuid(),
        email: z.string().trim().toLowerCase().email().max(255),
        invite: z.boolean().default(false),
        redirect_origin: z.string().url().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (!isSuper && !isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find existing auth user by email
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw new Error(listErr.message);
    let user = list.users.find((u) => u.email?.toLowerCase() === data.email);

    if (!user) {
      if (!data.invite) throw new Error("No account exists for this email. Enable invite to create one.");
      if (!data.redirect_origin) throw new Error("Missing redirect origin for invite");
      const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: `${data.redirect_origin.replace(/\/$/, "")}/set-password`,
      });
      if (invErr) throw new Error(invErr.message);
      user = invited.user;
    }
    if (!user) throw new Error("Failed to resolve user");

    // Ensure the user isn't already linked to a different patient
    const { data: existing } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("user_id", user.id)
      .neq("id", data.patient_id)
      .maybeSingle();
    if (existing) throw new Error("This account is already linked to another patient");

    // Update patient link + email
    const { error: upErr } = await supabaseAdmin
      .from("patients")
      .update({ user_id: user.id, email: data.email })
      .eq("id", data.patient_id);
    if (upErr) throw new Error(upErr.message);

    // Grant the patient role (idempotent)
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: user.id, role: "patient" as any })
      .then((r) => (r.error && !r.error.message.includes("duplicate") ? Promise.reject(new Error(r.error.message)) : null));

    return { ok: true, user_id: user.id };
  });

export const unlinkPatientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ patient_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (!isSuper && !isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("patients").update({ user_id: null }).eq("id", data.patient_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

