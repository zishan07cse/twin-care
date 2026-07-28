import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSalesOrStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_sales_or_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data) return true;
  const { data: sa } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  return !!sa;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const DISTANCE_FLAG_M = 500; // flag if further than 500m from target

const visitTargetEnum = z.enum(["doctor", "hospital", "patient", "dealer", "pharmacy", "office", "other"]);

const visitSchema = z.object({
  target_type: visitTargetEnum,
  doctor_id: z.string().uuid().optional().nullable(),
  hospital_id: z.string().uuid().optional().nullable(),
  patient_id: z.string().uuid().optional().nullable(),
  dealer_id: z.string().uuid().optional().nullable(),
  pharmacy_id: z.string().uuid().optional().nullable(),
  other_name: z.string().trim().max(200).optional().nullable(),
  other_address: z.string().trim().max(500).optional().nullable(),
  planned_at: z.string().optional().nullable(),
  purpose: z.string().trim().max(500).optional().nullable(),
  action_plan: z.string().trim().max(2000).optional().nullable(),
  outcome: z.string().trim().max(2000).optional().nullable(),
  next_action: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  target_lat: z.number().optional().nullable(),
  target_lng: z.number().optional().nullable(),
  custom_data: z.record(z.string(), z.any()).default({}),
  assigned_to: z.string().uuid().optional(),
});

export type VisitValues = z.infer<typeof visitSchema>;

export const listVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        assignedTo: z.string().uuid().optional(),
        status: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    let q = context.supabase
      .from("visits")
      .select(
        "*, doctor:doctors(id,full_name), hospital:hospitals(id,name), patient:patients(id,full_name,patient_code), dealer:dealers(id,name), pharmacy:pharmacies(id,name)",
      )
      .order("planned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (data.from) q = q.gte("planned_at", data.from);
    if (data.to) q = q.lte("planned_at", data.to);
    if (data.assignedTo) q = q.eq("assigned_to", data.assignedTo);
    if (data.status) q = q.eq("status", data.status as "planned" | "checked_in" | "completed" | "cancelled" | "missed");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => visitSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    const values = {
      target_type: data.target_type,
      doctor_id: data.target_type === "doctor" ? data.doctor_id || null : null,
      hospital_id: data.target_type === "hospital" ? data.hospital_id || null : null,
      patient_id: data.target_type === "patient" ? data.patient_id || null : null,
      dealer_id: data.target_type === "dealer" ? data.dealer_id || null : null,
      pharmacy_id: data.target_type === "pharmacy" ? data.pharmacy_id || null : null,
      other_name: data.target_type === "other" ? data.other_name || null : null,
      other_address: data.target_type === "other" ? data.other_address || null : null,
      planned_at: data.planned_at || null,
      purpose: data.purpose || null,
      action_plan: data.action_plan || null,
      outcome: data.outcome || null,
      next_action: data.next_action || null,
      notes: data.notes || null,
      target_lat: data.target_lat ?? null,
      target_lng: data.target_lng ?? null,
      custom_data: data.custom_data || {},
      assigned_to: data.assigned_to || context.userId,
      created_by: context.userId,
    };
    const { data: row, error } = await context.supabase
      .from("visits")
      .insert(values)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), values: visitSchema.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("visits").update(data.values).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("visits").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkInVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        lat: z.number(),
        lng: z.number(),
        accuracy: z.number().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: v, error: e1 } = await context.supabase
      .from("visits")
      .select("target_lat,target_lng")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    let distance: number | null = null;
    let flagged = false;
    if (v.target_lat != null && v.target_lng != null) {
      distance = haversineMeters(
        { lat: data.lat, lng: data.lng },
        { lat: v.target_lat, lng: v.target_lng },
      );
      flagged = distance > DISTANCE_FLAG_M;
    }
    const { error } = await context.supabase
      .from("visits")
      .update({
        checkin_at: new Date().toISOString(),
        checkin_lat: data.lat,
        checkin_lng: data.lng,
        checkin_accuracy_m: data.accuracy ?? null,
        distance_from_target_m: distance,
        distance_flagged: flagged,
        status: "checked_in",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, distance, flagged };
  });

export const checkOutVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        lat: z.number(),
        lng: z.number(),
        accuracy: z.number().optional().nullable(),
        outcome: z.string().optional().nullable(),
        next_action: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        custom_data: z.record(z.string(), z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      checkout_at: new Date().toISOString(),
      checkout_lat: data.lat,
      checkout_lng: data.lng,
      checkout_accuracy_m: data.accuracy ?? null,
      status: "completed",
    };
    if (data.outcome !== undefined) patch.outcome = data.outcome;
    if (data.next_action !== undefined) patch.next_action = data.next_action;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.custom_data !== undefined) patch.custom_data = data.custom_data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).from("visits").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Custom form fields (admin) ----------
const fieldSchema = z.object({
  field_key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores"),
  label: z.string().trim().min(1).max(120),
  field_type: z.enum(["text", "textarea", "number", "select", "date", "checkbox"]),
  options: z.array(z.string().min(1).max(120)).optional().nullable(),
  placeholder: z.string().trim().max(200).optional().nullable(),
  required: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export type VisitFieldValues = z.infer<typeof fieldSchema>;

export const listVisitFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("visit_form_fields")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertVisitField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: fieldSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const values = { ...data.values, options: data.values.options ?? null };
    if (data.id) {
      const { error } = await context.supabase
        .from("visit_form_fields")
        .update(values)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("visit_form_fields").insert(values);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteVisitField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { error } = await context.supabase.from("visit_form_fields").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Target lookup lists (lightweight) ----------
export const listVisitTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const [doctors, hospitals, patients, dealers, pharmacies] = await Promise.all([
      sb
        .from("doctors")
        .select("id,full_name,bmdc_number,hospital:hospitals(id,name)")
        .eq("is_active", true)
        .order("full_name"),
      sb.from("hospitals").select("id,name,city").eq("is_active", true).order("name"),
      sb.from("patients").select("id,full_name,patient_code").order("full_name"),
      sb.from("dealers").select("id,name,dealer_code,city").eq("is_active", true).order("name"),
      sb.from("pharmacies").select("id,name,city").eq("is_active", true).order("name"),
    ]);
    return {
      doctors: doctors.data ?? [],
      hospitals: hospitals.data ?? [],
      patients: patients.data ?? [],
      dealers: dealers.data ?? [],
      pharmacies: pharmacies.data ?? [],
    };
  });
