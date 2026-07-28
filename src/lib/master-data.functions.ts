import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// ---------- Hospitals ----------
const hospitalSchema = z.object({
  name: z.string().trim().min(1).max(200),
  name_bn: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const listHospitals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("hospitals")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertHospital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: hospitalSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const values = {
      ...data.values,
      email: data.values.email || null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("hospitals")
        .update(values)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("hospitals")
        .insert({ ...values, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteHospital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("hospitals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Doctors ----------
const doctorSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  full_name_bn: z.string().trim().max(200).optional().nullable(),
  bmdc_number: z.string().trim().max(60).optional().nullable(),
  specialization: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  hospital_id: z.string().uuid().optional().nullable().or(z.literal("")),
  is_referrer: z.boolean().default(false),
  is_treating: z.boolean().default(true),
  referral_commission_pct: z.number().min(0).max(100).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const listDoctors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("doctors")
      .select("*, hospital:hospitals(id, name)")
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertDoctor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: doctorSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const values = {
      ...data.values,
      email: data.values.email || null,
      hospital_id: data.values.hospital_id || null,
      bmdc_number: data.values.bmdc_number || null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("doctors").update(values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("doctors")
        .insert({ ...values, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteDoctor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("doctors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Nutritionists ----------
const nutritionistSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  full_name_bn: z.string().trim().max(200).optional().nullable(),
  qualification: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const listNutritionists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("nutritionists")
      .select("*")
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertNutritionist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: nutritionistSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const values = { ...data.values, email: data.values.email || null };
    if (data.id) {
      const { error } = await context.supabase
        .from("nutritionists")
        .update(values)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("nutritionists")
        .insert({ ...values, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteNutritionist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("nutritionists").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type HospitalValues = z.infer<typeof hospitalSchema>;
export type DoctorValues = z.infer<typeof doctorSchema>;
export type NutritionistValues = z.infer<typeof nutritionistSchema>;
