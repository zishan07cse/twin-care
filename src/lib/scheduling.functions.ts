import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSchedulingAccess(supabase: any, userId: string) {
  const [{ data: staff }, { data: doc }, { data: nut }] = await Promise.all([
    supabase.rpc("is_staff", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "doctor" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "nutritionist" }),
  ]);
  if (!staff && !doc && !nut) throw new Error("Forbidden");
}

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}

const apptSchema = z
  .object({
    patient_id: z.string().uuid(),
    provider_kind: z.enum(["doctor", "nutritionist", "coordinator"]),
    doctor_id: z.string().uuid().nullable().optional(),
    nutritionist_id: z.string().uuid().nullable().optional(),
    coordinator_user_id: z.string().uuid().nullable().optional(),
    scheduled_at: z.string(),
    duration_minutes: z.number().int().min(5).max(480).default(30),
    mode: z.enum(["in_person", "tele", "phone"]).default("in_person"),
    location: z.string().max(300).optional().nullable(),
    meeting_link: z.string().max(500).optional().nullable(),
    reason: z.string().max(500).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (v) =>
      (v.provider_kind === "doctor" && !!v.doctor_id) ||
      (v.provider_kind === "nutritionist" && !!v.nutritionist_id) ||
      v.provider_kind === "coordinator",
    { message: "Provider selection is required for chosen kind" },
  );

export type AppointmentValues = z.infer<typeof apptSchema>;

export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSchedulingAccess(context.supabase, context.userId);
    let query = context.supabase
      .from("appointments")
      .select(
        "*, patient:patients(id,patient_code,full_name,phone), doctor:doctors(id,full_name), nutritionist:nutritionists(id,full_name)",
      )
      .order("scheduled_at", { ascending: true })
      .limit(500);
    if (data.from) query = query.gte("scheduled_at", data.from);
    if (data.to) query = query.lte("scheduled_at", data.to);
    if (data.status && data.status !== "all") query = query.eq("status", data.status as any);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => apptSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const payload = {
      patient_id: data.patient_id,
      provider_kind: data.provider_kind,
      doctor_id: data.provider_kind === "doctor" ? data.doctor_id : null,
      nutritionist_id:
        data.provider_kind === "nutritionist" ? data.nutritionist_id : null,
      coordinator_user_id:
        data.provider_kind === "coordinator"
          ? data.coordinator_user_id ?? context.userId
          : null,
      scheduled_at: data.scheduled_at,
      duration_minutes: data.duration_minutes,
      mode: data.mode,
      location: data.location ?? null,
      meeting_link: data.meeting_link ?? null,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      created_by: context.userId,
    };
    const { error } = await context.supabase.from("appointments").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["scheduled", "completed", "missed", "cancelled", "rescheduled"]),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const patch: any = { status: data.status };
    if (data.status === "completed") patch.completed_at = new Date().toISOString();
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await context.supabase
      .from("appointments")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        scheduled_at: z.string(),
        duration_minutes: z.number().int().min(5).max(480).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const patch: any = {
      scheduled_at: data.scheduled_at,
      status: "scheduled",
    };
    if (data.duration_minutes) patch.duration_minutes = data.duration_minutes;
    const { error } = await context.supabase
      .from("appointments")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProvidersForScheduling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSchedulingAccess(context.supabase, context.userId);
    const [{ data: patients }, { data: doctors }, { data: nutritionists }] =
      await Promise.all([
        context.supabase
          .from("patients")
          .select("id, patient_code, full_name")
          .order("full_name"),
        context.supabase
          .from("doctors")
          .select("id, full_name, is_active")
          .order("full_name"),
        context.supabase
          .from("nutritionists")
          .select("id, full_name, is_active")
          .order("full_name"),
      ]);
    return {
      patients: patients ?? [],
      doctors: (doctors ?? []).filter((d: any) => d.is_active !== false),
      nutritionists: (nutritionists ?? []).filter(
        (n: any) => n.is_active !== false,
      ),
    };
  });
