import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertClinical(supabase: any, userId: string) {
  const [s, d, n] = await Promise.all([
    supabase.rpc("is_staff", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "doctor" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "nutritionist" }),
  ]);
  if (!(s.data || d.data || n.data)) throw new Error("Forbidden");
}

// ---- Lab tests catalog ----
const labTestSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  reference_low: z.number().nullable().optional(),
  reference_high: z.number().nullable().optional(),
  reference_text: z.string().trim().max(200).nullable().optional(),
  is_active: z.boolean().default(true),
});
export type LabTestValues = z.infer<typeof labTestSchema>;

export const listLabTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertClinical(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("lab_tests").select("*").order("name").limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertLabTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => labTestSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertClinical(context.supabase, context.userId);
    const payload: any = { ...data };
    if (!payload.id) payload.created_by = context.userId;
    const { error } = payload.id
      ? await context.supabase.from("lab_tests").update(payload).eq("id", payload.id)
      : await context.supabase.from("lab_tests").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLabTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lab_tests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Lab results ----
const labResultSchema = z.object({
  patient_id: z.string().uuid(),
  test_id: z.string().uuid().nullable().optional().or(z.literal("")),
  test_name: z.string().trim().min(1).max(200),
  value_numeric: z.number().nullable().optional(),
  value_text: z.string().trim().max(200).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  performed_on: z.string().optional(),
  lab_name: z.string().trim().max(200).nullable().optional(),
  file_url: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export type LabResultValues = z.infer<typeof labResultSchema>;

export const listLabResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ patient_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertClinical(context.supabase, context.userId);
    let q = context.supabase
      .from("lab_results")
      .select("*, patient:patients(id,patient_code,full_name), test:lab_tests(id,name,unit,reference_low,reference_high,reference_text)")
      .order("performed_on", { ascending: false }).limit(1000);
    if (data.patient_id) q = q.eq("patient_id", data.patient_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createLabResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => labResultSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertClinical(context.supabase, context.userId);
    const payload: any = { ...data, created_by: context.userId };
    if (payload.test_id === "") payload.test_id = null;
    const { error } = await context.supabase.from("lab_results").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLabResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lab_results").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Vitals ----
const vitalsSchema = z.object({
  patient_id: z.string().uuid(),
  recorded_on: z.string().optional(),
  weight_kg: z.number().nullable().optional(),
  height_cm: z.number().nullable().optional(),
  waist_cm: z.number().nullable().optional(),
  bp_systolic: z.number().int().nullable().optional(),
  bp_diastolic: z.number().int().nullable().optional(),
  pulse_bpm: z.number().int().nullable().optional(),
  fasting_glucose: z.number().nullable().optional(),
  post_meal_glucose: z.number().nullable().optional(),
  hba1c: z.number().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export type VitalsValues = z.infer<typeof vitalsSchema>;

export const listVitals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ patient_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertClinical(context.supabase, context.userId);
    let q = context.supabase
      .from("vitals")
      .select("*, patient:patients(id,patient_code,full_name)")
      .order("recorded_on", { ascending: false }).limit(1000);
    if (data.patient_id) q = q.eq("patient_id", data.patient_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createVitals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => vitalsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertClinical(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("vitals").insert({ ...data, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVitals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vitals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- support ----
export const listPatientsForLabs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertClinical(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("patients").select("id, patient_code, full_name").order("full_name").limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
