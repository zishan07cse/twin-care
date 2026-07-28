import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}

const leadSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  age: z.number().int().min(0).max(120).nullable().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().nullable(),
  source: z
    .enum([
      "walk_in",
      "phone",
      "whatsapp",
      "facebook",
      "instagram",
      "website",
      "referral",
      "doctor",
      "event",
      "other",
    ])
    .default("other"),
  source_detail: z.string().trim().max(300).optional().nullable(),
  referrer_doctor_id: z.string().uuid().nullable().optional().or(z.literal("")),
  interest_summary: z.string().trim().max(2000).optional().nullable(),
  next_follow_up_at: z.string().nullable().optional().or(z.literal("")),
  assigned_to: z.string().uuid().nullable().optional().or(z.literal("")),
});

export type LeadValues = z.infer<typeof leadSchema>;

function normalize(v: LeadValues) {
  const out: any = { ...v };
  for (const k of [
    "email",
    "gender",
    "referrer_doctor_id",
    "next_follow_up_at",
    "assigned_to",
  ]) {
    if (out[k] === "") out[k] = null;
  }
  return out;
}

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("leads")
      .select("*, referrer:doctors(id,full_name)")
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: lead, error } = await context.supabase
      .from("leads")
      .select("*, referrer:doctors(id,full_name), patient:patients(id,patient_code,full_name)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: notes } = await context.supabase
      .from("lead_notes")
      .select("*")
      .eq("lead_id", data.id)
      .order("created_at", { ascending: false });
    return { lead, notes: notes ?? [] };
  });

export const upsertLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: leadSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const values = normalize(data.values);
    if (data.id) {
      const { error } = await context.supabase.from("leads").update(values).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("leads")
      .insert({ ...values, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const updateLeadStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        stage: z.enum(["new", "contacted", "qualified", "proposal", "converted", "lost"]),
        lost_reason: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const patch: any = { stage: data.stage };
    if (data.stage === "lost" && data.lost_reason) patch.lost_reason = data.lost_reason;
    const { error } = await context.supabase.from("leads").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addLeadNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        lead_id: z.string().uuid(),
        note: z.string().trim().min(1).max(2000),
        activity_type: z.string().max(50).default("note"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("lead_notes").insert({
      lead_id: data.lead_id,
      note: data.note,
      activity_type: data.activity_type,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Convert lead -> patient
export const convertLeadToPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: lead, error: lErr } = await context.supabase
      .from("leads")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (!lead) throw new Error("Lead not found");
    if (lead.converted_patient_id) throw new Error("Already converted");

    const dob = lead.age
      ? new Date(new Date().getFullYear() - lead.age, 0, 1).toISOString().slice(0, 10)
      : null;

    const { data: patient, error: pErr } = await context.supabase
      .from("patients")
      .insert({
        patient_code: "",
        full_name: lead.full_name,
        phone: lead.phone,
        email: lead.email,
        gender: lead.gender as any,
        date_of_birth: dob,
        city: lead.city,
        referring_doctor_id: lead.referrer_doctor_id,
        notes: lead.interest_summary,
        status: "active",
        created_by: context.userId,
      } as any)
      .select("id, patient_code")
      .single();
    if (pErr) throw new Error(pErr.message);

    const { error: uErr } = await context.supabase
      .from("leads")
      .update({
        stage: "converted",
        converted_patient_id: patient.id,
        converted_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, patient_id: patient.id, patient_code: patient.patient_code };
  });

export const listLeadRefData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: doctors } = await context.supabase
      .from("doctors")
      .select("id, full_name, is_active")
      .order("full_name");
    return {
      doctors: (doctors ?? []).filter((d: any) => d.is_active !== false),
    };
  });
