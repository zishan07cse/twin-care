import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertBillingAccess(supabase: any, userId: string) {
  const [{ data: staff }, { data: fin }] = await Promise.all([
    supabase.rpc("is_staff", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "finance" }),
  ]);
  if (!staff && !fin) throw new Error("Forbidden");
}

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}

// ---------- Program Plans ----------
const planSchema = z.object({
  name: z.string().trim().min(1).max(200),
  name_bn: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  duration_months: z.number().int().min(1).max(120).default(12),
  total_price_bdt: z.number().min(0),
  billing_frequency: z.enum(["one_time", "monthly", "quarterly", "custom"]).default("monthly"),
  installment_count: z.number().int().min(1).max(60).nullable().optional(),
  is_active: z.boolean().default(true),
});

export type PlanValues = z.infer<typeof planSchema>;

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBillingAccess(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("program_plans")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: planSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    if (data.id) {
      const { error } = await context.supabase
        .from("program_plans")
        .update(data.values)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("program_plans")
        .insert({ ...data.values, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("program_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Enrollments ----------
const enrollmentSchema = z.object({
  patient_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  start_date: z.string(),
  discount_bdt: z.number().min(0).default(0),
  notes: z.string().max(2000).optional().nullable(),
});

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export const enrollPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => enrollmentSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertBillingAccess(context.supabase, context.userId);
    const { data: plan, error: planErr } = await context.supabase
      .from("program_plans")
      .select("*")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (planErr) throw new Error(planErr.message);
    if (!plan) throw new Error("Plan not found");

    const total = Number(plan.total_price_bdt);
    const net = Math.max(0, total - data.discount_bdt);
    const endDate = addMonths(data.start_date, plan.duration_months);

    const { data: enrollment, error } = await context.supabase
      .from("patient_enrollments")
      .insert({
        patient_id: data.patient_id,
        plan_id: data.plan_id,
        start_date: data.start_date,
        end_date: endDate,
        total_amount_bdt: total,
        discount_bdt: data.discount_bdt,
        net_amount_bdt: net,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Generate schedule
    let count = 1;
    let stepMonths = plan.duration_months;
    switch (plan.billing_frequency) {
      case "one_time":
        count = 1;
        stepMonths = 0;
        break;
      case "monthly":
        count = plan.duration_months;
        stepMonths = 1;
        break;
      case "quarterly":
        count = Math.max(1, Math.ceil(plan.duration_months / 3));
        stepMonths = 3;
        break;
      case "custom":
        count = plan.installment_count ?? 1;
        stepMonths = Math.max(1, Math.floor(plan.duration_months / count));
        break;
    }
    const per = Math.round((net / count) * 100) / 100;
    const rows = [];
    let accumulated = 0;
    for (let i = 0; i < count; i++) {
      const amount =
        i === count - 1 ? Math.round((net - accumulated) * 100) / 100 : per;
      accumulated += amount;
      rows.push({
        enrollment_id: enrollment.id,
        installment_no: i + 1,
        due_date: addMonths(data.start_date, i * stepMonths),
        amount_bdt: amount,
      });
    }
    if (rows.length) {
      const { error: schedErr } = await context.supabase
        .from("payment_schedule")
        .insert(rows);
      if (schedErr) throw new Error(schedErr.message);
    }

    // Timeline
    await context.supabase.from("patient_timeline").insert({
      patient_id: data.patient_id,
      event_type: "enrollment",
      title: "Enrolled in plan: " + plan.name,
      description: `Net ৳${net.toLocaleString()} over ${count} installment(s).`,
      created_by: context.userId,
    });

    return { ok: true, enrollment_id: enrollment.id };
  });

export const listEnrollmentsForPatient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ patient_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertBillingAccess(context.supabase, context.userId);
    const { data: enrollments, error } = await context.supabase
      .from("patient_enrollments")
      .select("*, plan:program_plans(id,name,billing_frequency,duration_months)")
      .eq("patient_id", data.patient_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!enrollments?.length) return [];

    const ids = enrollments.map((e: any) => e.id);
    const [{ data: schedule }, { data: payments }] = await Promise.all([
      context.supabase
        .from("payment_schedule")
        .select("*")
        .in("enrollment_id", ids)
        .order("installment_no"),
      context.supabase
        .from("payments")
        .select("*")
        .in("enrollment_id", ids)
        .order("paid_on", { ascending: false }),
    ]);

    return enrollments.map((e: any) => ({
      ...e,
      schedule: (schedule ?? []).filter((s: any) => s.enrollment_id === e.id),
      payments: (payments ?? []).filter((p: any) => p.enrollment_id === e.id),
    }));
  });

export const listAllPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBillingAccess(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("payments")
      .select(
        "*, enrollment:patient_enrollments(id, patient:patients(id, patient_code, full_name), plan:program_plans(name))",
      )
      .order("paid_on", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Record payment ----------
const paymentSchema = z.object({
  enrollment_id: z.string().uuid(),
  schedule_id: z.string().uuid().nullable().optional(),
  amount_bdt: z.number().positive(),
  method: z.enum(["cash", "bkash", "nagad", "card", "bank_transfer", "cheque", "other"]),
  reference: z.string().max(200).optional().nullable(),
  paid_on: z.string(),
  notes: z.string().max(2000).optional().nullable(),
});

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => paymentSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertBillingAccess(context.supabase, context.userId);
    const { error } = await context.supabase.from("payments").insert({
      receipt_no: "",
      enrollment_id: data.enrollment_id,
      schedule_id: data.schedule_id || null,
      amount_bdt: data.amount_bdt,
      method: data.method,
      reference: data.reference || null,
      paid_on: data.paid_on,
      notes: data.notes || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPatientsForBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBillingAccess(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("patients")
      .select("id, patient_code, full_name, phone")
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
