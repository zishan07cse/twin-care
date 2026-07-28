import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}

type MonthBucket = { month: string; value: number };

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function last6Months(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(monthKey(d));
  }
  return out;
}

export const getReportsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const sb = context.supabase;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const sixMonthsAgo = new Date(monthStart);
    sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5);

    const [
      patientsRes,
      leadsRes,
      enrollmentsRes,
      paymentsRes,
      scheduleRes,
      apptRes,
      invRes,
      topOutstandingRes,
    ] = await Promise.all([
      sb.from("patients").select("id,status,created_at"),
      sb.from("leads").select("id,stage,created_at"),
      sb.from("patient_enrollments").select("id,started_at,status").gte("started_at", sixMonthsAgo.toISOString()),
      sb.from("payments").select("id,amount_bdt,paid_at").gte("paid_at", sixMonthsAgo.toISOString()),
      sb
        .from("payment_schedule")
        .select("id,amount_bdt,paid_amount_bdt,due_date,status")
        .in("status", ["pending", "partial", "overdue"]),
      sb.from("appointments").select("id,status,scheduled_at"),
      sb.from("inventory_items").select("id,name_en,stock_qty,reorder_level").order("stock_qty", { ascending: true }).limit(20),
      sb
        .from("payment_schedule")
        .select("amount_bdt,paid_amount_bdt,enrollment_id,patient_enrollments!inner(patient_id,patients!inner(patient_code,full_name))")
        .in("status", ["pending", "partial", "overdue"])
        .limit(500),
    ]);

    // Patients by status
    const patientsByStatus: Record<string, number> = {};
    (patientsRes.data ?? []).forEach((p: any) => {
      patientsByStatus[p.status] = (patientsByStatus[p.status] ?? 0) + 1;
    });
    const activePatients = patientsByStatus["active"] ?? 0;

    // Leads by stage
    const leadsByStage: Record<string, number> = {};
    (leadsRes.data ?? []).forEach((l: any) => {
      leadsByStage[l.stage] = (leadsByStage[l.stage] ?? 0) + 1;
    });

    // Enrollments per month
    const months = last6Months();
    const enrollBuckets: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
    (enrollmentsRes.data ?? []).forEach((e: any) => {
      const k = monthKey(new Date(e.started_at));
      if (k in enrollBuckets) enrollBuckets[k] += 1;
    });
    const enrollmentsPerMonth: MonthBucket[] = months.map((m) => ({ month: m, value: enrollBuckets[m] }));

    const currentMonth = monthKey(monthStart);
    const newEnrollmentsThisMonth = enrollBuckets[currentMonth] ?? 0;

    // Collections per month
    const collBuckets: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
    (paymentsRes.data ?? []).forEach((p: any) => {
      if (!p.paid_at) return;
      const k = monthKey(new Date(p.paid_at));
      if (k in collBuckets) collBuckets[k] += Number(p.amount_bdt ?? 0);
    });
    const collectionsPerMonth: MonthBucket[] = months.map((m) => ({ month: m, value: collBuckets[m] }));
    const collectionsThisMonth = collBuckets[currentMonth] ?? 0;

    // Outstanding + overdue
    const today = new Date().toISOString().slice(0, 10);
    let outstandingTotal = 0;
    let overdueTotal = 0;
    (scheduleRes.data ?? []).forEach((s: any) => {
      const rem = Number(s.amount_bdt ?? 0) - Number(s.paid_amount_bdt ?? 0);
      if (rem > 0) {
        outstandingTotal += rem;
        if (s.due_date && s.due_date < today) overdueTotal += rem;
      }
    });

    // Appointments summary
    const apptByStatus: Record<string, number> = {};
    let upcoming = 0;
    const now = new Date();
    (apptRes.data ?? []).forEach((a: any) => {
      apptByStatus[a.status] = (apptByStatus[a.status] ?? 0) + 1;
      if (a.status === "scheduled" && new Date(a.scheduled_at) >= now) upcoming += 1;
    });

    // Low stock
    const lowStock = (invRes.data ?? []).filter(
      (i: any) => i.reorder_level != null && i.stock_qty <= i.reorder_level,
    );

    // Top outstanding by patient
    const patAgg: Record<string, { code: string; name: string; outstanding: number }> = {};
    (topOutstandingRes.data ?? []).forEach((row: any) => {
      const enr = row.patient_enrollments;
      const pat = enr?.patients;
      if (!pat) return;
      const key = enr.patient_id;
      const rem = Number(row.amount_bdt ?? 0) - Number(row.paid_amount_bdt ?? 0);
      if (rem <= 0) return;
      if (!patAgg[key]) patAgg[key] = { code: pat.patient_code, name: pat.full_name, outstanding: 0 };
      patAgg[key].outstanding += rem;
    });
    const topOutstanding = Object.values(patAgg)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 10);

    return {
      kpi: {
        activePatients,
        newEnrollmentsThisMonth,
        collectionsThisMonth,
        outstandingTotal,
        overdueTotal,
        upcomingAppointments: upcoming,
        totalPatients: (patientsRes.data ?? []).length,
        totalLeads: (leadsRes.data ?? []).length,
      },
      patientsByStatus,
      leadsByStage,
      enrollmentsPerMonth,
      collectionsPerMonth,
      appointmentsByStatus: apptByStatus,
      lowStock,
      topOutstanding,
    };
  });

export const getRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("patient_timeline")
      .select("id,event_type,title,description,created_at,patient_id,patients:patient_id(patient_code,full_name)")
      .order("created_at", { ascending: false })
      .limit(15);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

