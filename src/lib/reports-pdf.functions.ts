import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_staff", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}

export const getPatientOutcome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ patient_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("patient_outcomes")
      .select("*")
      .eq("patient_id", data.patient_id)
      .maybeSingle();
    return row ?? null;
  });

export const getMonthlyCommissionStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        referrer_kind: z.enum(["doctor", "hospital"]),
        referrer_id: z.string().uuid(),
        period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const [year, month] = data.period.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(year, month, 1)).toISOString();

    const db: any = context.supabase;
    let q = db
      .from("referral_commissions")
      .select(
        "id, accrued_at, basis, amount_bdt, status, referrer_kind, doctor:doctors(id,full_name), hospital:hospitals(id,name), patient:patients(id,patient_code,full_name_en)",
      )
      .gte("accrued_at", start)
      .lt("accrued_at", end)
      .eq("referrer_kind", data.referrer_kind)
      .order("accrued_at", { ascending: true });
    if (data.referrer_kind === "doctor") q = q.eq("doctor_id", data.referrer_id);
    else q = q.eq("hospital_id", data.referrer_id);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let referrer_name = "—";
    if (data.referrer_kind === "doctor") {
      const { data: d } = await db.from("doctors").select("full_name").eq("id", data.referrer_id).maybeSingle();
      referrer_name = d?.full_name ?? "—";
    } else {
      const { data: h } = await db.from("hospitals").select("name").eq("id", data.referrer_id).maybeSingle();
      referrer_name = h?.name ?? "—";
    }

    return { rows: rows ?? [], referrer_name };
  });

export const listReferrersForStatements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const [docs, hosps] = await Promise.all([
      context.supabase.from("doctors").select("id,full_name").eq("is_referrer", true).order("full_name"),
      context.supabase.from("hospitals").select("id,name").order("name"),
    ]);
    return { doctors: docs.data ?? [], hospitals: hosps.data ?? [] };
  });
