import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}

// ---- List enrollments approaching renewal ----
export const listExpiringEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days_ahead: z.number().int().min(1).max(365).default(90) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const today = new Date();
    const horizon = new Date();
    horizon.setUTCDate(horizon.getUTCDate() + data.days_ahead);
    const db: any = context.supabase;
    const { data: rows, error } = await db
      .from("patient_enrollments")
      .select(
        "id, start_date, end_date, status, net_amount_bdt, closure_type, patient:patients(id, patient_code, full_name, phone), plan:program_plans(id, name, duration_months)",
      )
      .eq("status", "active")
      .not("end_date", "is", null)
      .gte("end_date", today.toISOString().slice(0, 10))
      .lte("end_date", horizon.toISOString().slice(0, 10))
      .order("end_date", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => {
      const days = Math.ceil((new Date(r.end_date).getTime() - today.getTime()) / 86400000);
      return { ...r, days_to_end: days };
    });
  });

// ---- Close enrollment: renewed | completed | dropped ----
const closeSchema = z.object({
  enrollment_id: z.string().uuid(),
  closure_type: z.enum(["renewed", "completed", "dropped"]),
  reason: z.string().max(2000).optional().nullable(),
  recover_devices: z.boolean().default(true),
  // renewal-only
  new_plan_id: z.string().uuid().optional(),
  new_start_date: z.string().optional(),
  new_discount_bdt: z.number().min(0).default(0),
});

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export const closeEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => closeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const db: any = context.supabase;

    const { data: enr, error: enrErr } = await db
      .from("patient_enrollments")
      .select("id, patient_id, plan_id, status, start_date, end_date")
      .eq("id", data.enrollment_id)
      .maybeSingle();
    if (enrErr) throw new Error(enrErr.message);
    if (!enr) throw new Error("Enrollment not found");
    if (enr.status !== "active" && enr.status !== "paused")
      throw new Error("Only active or paused enrollments can be closed");

    let new_enrollment_id: string | null = null;

    if (data.closure_type === "renewed") {
      if (!data.new_plan_id || !data.new_start_date)
        throw new Error("Renewal requires new_plan_id and new_start_date");
      const { data: plan, error: planErr } = await db
        .from("program_plans")
        .select("id, total_price_bdt, duration_months, billing_frequency, installment_count")
        .eq("id", data.new_plan_id)
        .maybeSingle();
      if (planErr) throw new Error(planErr.message);
      if (!plan) throw new Error("New plan not found");

      const total = Number(plan.total_price_bdt);
      const net = Math.max(0, total - data.new_discount_bdt);
      const endDate = addMonths(data.new_start_date, plan.duration_months);

      const { data: created, error: createErr } = await db
        .from("patient_enrollments")
        .insert({
          patient_id: enr.patient_id,
          plan_id: plan.id,
          start_date: data.new_start_date,
          end_date: endDate,
          total_amount_bdt: total,
          discount_bdt: data.new_discount_bdt,
          net_amount_bdt: net,
          renewed_from_enrollment_id: enr.id,
          notes: data.reason ?? null,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (createErr) throw new Error(createErr.message);
      new_enrollment_id = created.id;

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
        const amount = i === count - 1 ? Math.round((net - accumulated) * 100) / 100 : per;
        accumulated += amount;
        rows.push({
          enrollment_id: created.id,
          installment_no: i + 1,
          due_date: addMonths(data.new_start_date, i * stepMonths),
          amount_bdt: amount,
        });
      }
      if (rows.length) {
        await db.from("payment_schedule").insert(rows);
      }
    }

    // Close old enrollment
    const newStatus = data.closure_type === "renewed" || data.closure_type === "completed" ? "completed" : "cancelled";
    const { error: updErr } = await db
      .from("patient_enrollments")
      .update({
        status: newStatus,
        closure_type: data.closure_type,
        closure_reason: data.reason ?? null,
        closed_at: new Date().toISOString(),
        closed_by: context.userId,
        end_date: enr.end_date ?? new Date().toISOString().slice(0, 10),
      })
      .eq("id", enr.id);
    if (updErr) throw new Error(updErr.message);

    // Device recovery: mark all active assignments returned
    let recovered = 0;
    if (data.recover_devices && data.closure_type !== "renewed") {
      const { data: assigns } = await db
        .from("inventory_assignments")
        .select("id")
        .eq("patient_id", enr.patient_id)
        .eq("status", "active");
      const ids = (assigns ?? []).map((a: any) => a.id);
      if (ids.length) {
        const { error: retErr } = await db
          .from("inventory_assignments")
          .update({ status: "returned", returned_at: new Date().toISOString() })
          .in("id", ids);
        if (!retErr) recovered = ids.length;
      }
    }

    // Timeline
    const titles: Record<string, string> = {
      renewed: "Program renewed",
      completed: "Program completed",
      dropped: "Program dropped",
    };
    await db.from("patient_timeline").insert({
      patient_id: enr.patient_id,
      event_type: "enrollment",
      title: titles[data.closure_type],
      description: [
        data.reason,
        recovered ? `${recovered} device(s) recovered` : null,
        new_enrollment_id ? "New enrollment created" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      created_by: context.userId,
    });

    return { ok: true, new_enrollment_id, recovered_devices: recovered };
  });

// ---- Churn report by month ----
export const getChurnReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ months: z.number().int().min(1).max(24).default(6) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const db: any = context.supabase;
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - data.months);
    since.setUTCDate(1);
    const { data: rows, error } = await db
      .from("patient_enrollments")
      .select("id, closed_at, closure_type, closure_reason, net_amount_bdt, patient:patients(id, patient_code, full_name), plan:program_plans(name)")
      .not("closure_type", "is", null)
      .gte("closed_at", since.toISOString())
      .order("closed_at", { ascending: false });
    if (error) throw new Error(error.message);

    const buckets: Record<string, { period: string; renewed: number; completed: number; dropped: number; drop_amount: number }> = {};
    for (const r of rows ?? []) {
      const p = (r.closed_at as string).slice(0, 7);
      if (!buckets[p]) buckets[p] = { period: p, renewed: 0, completed: 0, dropped: 0, drop_amount: 0 };
      const kind = r.closure_type as "renewed" | "completed" | "dropped";
      buckets[p][kind] += 1;
      if (kind === "dropped") buckets[p].drop_amount += Number(r.net_amount_bdt || 0);
    }

    const dropReasons: Record<string, number> = {};
    for (const r of rows ?? []) {
      if (r.closure_type === "dropped") {
        const k = (r.closure_reason || "unspecified").slice(0, 60);
        dropReasons[k] = (dropReasons[k] ?? 0) + 1;
      }
    }

    return {
      by_month: Object.values(buckets).sort((a, b) => (a.period < b.period ? 1 : -1)),
      recent: rows ?? [],
      drop_reasons: Object.entries(dropReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    };
  });

// ---- List active plans (helper for wizards) ----
export const listActivePlansSlim = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("program_plans")
      .select("id, name, duration_months, total_price_bdt")
      .eq("is_active", true)
      .order("name");
    return data ?? [];
  });
