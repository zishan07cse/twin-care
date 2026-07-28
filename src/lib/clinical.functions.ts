import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertClinicalAccess(supabase: any, userId: string) {
  const [staff, doc, nut] = await Promise.all([
    supabase.rpc("is_staff", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "doctor" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "nutritionist" }),
  ]);
  if (!(staff.data || doc.data || nut.data)) throw new Error("Forbidden");
}

// ---------- Medicines ----------
const medicineSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  generic_name: z.string().trim().max(200).nullable().optional(),
  strength: z.string().trim().max(80).nullable().optional(),
  form: z.string().trim().max(60).nullable().optional(),
  manufacturer: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  is_active: z.boolean().default(true),
});
export type MedicineValues = z.infer<typeof medicineSchema>;

export const listMedicines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertClinicalAccess(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("medicines")
      .select("*")
      .order("name", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertMedicine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => medicineSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertClinicalAccess(context.supabase, context.userId);
    const payload: any = { ...data };
    if (!payload.id) payload.created_by = context.userId;
    const { error } = payload.id
      ? await context.supabase.from("medicines").update(payload).eq("id", payload.id)
      : await context.supabase.from("medicines").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMedicine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("medicines").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Prescriptions ----------
const rxItemSchema = z.object({
  medicine_id: z.string().uuid().nullable().optional().or(z.literal("")),
  medicine_name: z.string().trim().min(1).max(200),
  dose: z.string().trim().max(120).nullable().optional(),
  frequency: z.string().trim().max(120).nullable().optional(),
  duration: z.string().trim().max(120).nullable().optional(),
  instructions: z.string().trim().max(500).nullable().optional(),
});

const prescriptionSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid().nullable().optional().or(z.literal("")),
  appointment_id: z.string().uuid().nullable().optional().or(z.literal("")),
  diagnosis: z.string().trim().max(2000).nullable().optional(),
  advice: z.string().trim().max(4000).nullable().optional(),
  follow_up_at: z.string().nullable().optional().or(z.literal("")),
  items: z.array(rxItemSchema).min(1).max(50),
});
export type PrescriptionValues = z.infer<typeof prescriptionSchema>;

function nullifyEmpty<T extends Record<string, any>>(v: T, keys: string[]) {
  const o: any = { ...v };
  for (const k of keys) if (o[k] === "") o[k] = null;
  return o;
}

export const listPrescriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ patient_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertClinicalAccess(context.supabase, context.userId);
    let q = context.supabase
      .from("prescriptions")
      .select(
        "*, patient:patients(id,patient_code,full_name), doctor:doctors(id,full_name), items:prescription_items(*)",
      )
      .order("issued_at", { ascending: false })
      .limit(500);
    if (data.patient_id) q = q.eq("patient_id", data.patient_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => prescriptionSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertClinicalAccess(context.supabase, context.userId);
    const payload = nullifyEmpty(
      {
        patient_id: data.patient_id,
        doctor_id: data.doctor_id,
        appointment_id: data.appointment_id,
        diagnosis: data.diagnosis,
        advice: data.advice,
        follow_up_at: data.follow_up_at,
        created_by: context.userId,
      },
      ["doctor_id", "appointment_id", "follow_up_at"],
    );
    const { data: rx, error } = await context.supabase
      .from("prescriptions")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const items = data.items.map((it, idx) => ({
      prescription_id: rx.id,
      medicine_id: it.medicine_id && it.medicine_id !== "" ? it.medicine_id : null,
      medicine_name: it.medicine_name,
      dose: it.dose || null,
      frequency: it.frequency || null,
      duration: it.duration || null,
      instructions: it.instructions || null,
      sort_order: idx,
    }));
    const { error: itErr } = await context.supabase.from("prescription_items").insert(items);
    if (itErr) throw new Error(itErr.message);
    return { id: rx.id };
  });

export const deletePrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("prescriptions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Diet Plans ----------
const mealSchema = z.object({
  meal: z.string().trim().min(1).max(60),
  time: z.string().trim().max(20).optional().nullable(),
  items: z.string().trim().max(1000),
});
const dietPlanSchema = z.object({
  id: z.string().uuid().optional(),
  patient_id: z.string().uuid(),
  nutritionist_id: z.string().uuid().nullable().optional().or(z.literal("")),
  title: z.string().trim().min(1).max(200),
  start_date: z.string(),
  end_date: z.string().nullable().optional().or(z.literal("")),
  daily_calories: z.number().int().min(0).max(10000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  meals: z.array(mealSchema).default([]),
  is_active: z.boolean().default(true),
});
export type DietPlanValues = z.infer<typeof dietPlanSchema>;

export const listDietPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ patient_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertClinicalAccess(context.supabase, context.userId);
    let q = context.supabase
      .from("diet_plans")
      .select("*, patient:patients(id,patient_code,full_name), nutritionist:nutritionists(id,full_name)")
      .order("start_date", { ascending: false })
      .limit(500);
    if (data.patient_id) q = q.eq("patient_id", data.patient_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertDietPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dietPlanSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertClinicalAccess(context.supabase, context.userId);
    const payload: any = nullifyEmpty(
      { ...data, meals: data.meals as any },
      ["nutritionist_id", "end_date"],
    );
    if (!payload.id) payload.created_by = context.userId;
    const { error } = payload.id
      ? await context.supabase.from("diet_plans").update(payload).eq("id", payload.id)
      : await context.supabase.from("diet_plans").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDietPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("diet_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Medication Reductions ----------
const reductionSchema = z.object({
  patient_id: z.string().uuid(),
  medicine_id: z.string().uuid().nullable().optional().or(z.literal("")),
  medicine_name: z.string().trim().min(1).max(200),
  baseline_dose: z.string().trim().max(120).nullable().optional(),
  current_dose: z.string().trim().max(120).nullable().optional(),
  recorded_on: z.string().optional(),
  reduction_percent: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export type ReductionValues = z.infer<typeof reductionSchema>;

export const listReductions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ patient_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertClinicalAccess(context.supabase, context.userId);
    let q = context.supabase
      .from("medication_reductions")
      .select("*, patient:patients(id,patient_code,full_name)")
      .order("recorded_on", { ascending: false })
      .limit(1000);
    if (data.patient_id) q = q.eq("patient_id", data.patient_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createReduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reductionSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertClinicalAccess(context.supabase, context.userId);
    const payload: any = nullifyEmpty({ ...data, created_by: context.userId }, ["medicine_id"]);
    const { error } = await context.supabase.from("medication_reductions").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Support ----------
export const listPatientsForClinical = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertClinicalAccess(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("patients")
      .select("id, patient_code, full_name")
      .order("full_name", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listDoctorsForClinical = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertClinicalAccess(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("doctors")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name")
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listNutritionistsForClinical = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertClinicalAccess(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("nutritionists")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name")
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
