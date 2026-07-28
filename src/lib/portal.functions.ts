import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getPatientId(supabase: any): Promise<string | null> {
  const { data } = await supabase.rpc("current_patient_id");
  return (data as string | null) ?? null;
}

export const getMyPatient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await getPatientId(context.supabase);
    if (!pid) return null;
    const { data, error } = await context.supabase
      .from("patients")
      .select("*")
      .eq("id", pid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const getMyPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const pid = await getPatientId(sb);
    if (!pid) {
      return { linked: false as const };
    }

    const nowIso = new Date().toISOString();
    const [
      patientRes,
      timelineRes,
      apptRes,
      prescRes,
      dietRes,
      vitalsRes,
      labsRes,
      enrRes,
      schedRes,
    ] = await Promise.all([
      sb.from("patients").select("id,patient_code,full_name,phone,preferred_language,status").eq("id", pid).maybeSingle(),
      sb.from("patient_timeline").select("id,event_type,title,description,created_at").eq("patient_id", pid).order("created_at", { ascending: false }).limit(20),
      sb.from("appointments").select("id,scheduled_at,status,provider_kind,notes").eq("patient_id", pid).gte("scheduled_at", nowIso).order("scheduled_at").limit(10),
      sb.from("prescriptions").select("id,issued_at,diagnosis,advice,prescription_items(medicine_name,dose,frequency,duration,instructions)").eq("patient_id", pid).order("issued_at", { ascending: false }).limit(10),
      sb.from("diet_plans").select("id,title,start_date,end_date,daily_calories,meals").eq("patient_id", pid).order("start_date", { ascending: false }).limit(10),
      sb.from("vitals").select("id,measured_at,weight_kg,bp_systolic,bp_diastolic,hba1c,fasting_glucose").eq("patient_id", pid).order("measured_at", { ascending: false }).limit(10),
      sb.from("lab_results").select("id,test_name,value_text,value_numeric,unit,result_date,is_abnormal").eq("patient_id", pid).order("result_date", { ascending: false }).limit(20),
      sb.from("patient_enrollments").select("id,started_at,status,program_plans(name,total_price_bdt)").eq("patient_id", pid),
      sb
        .from("payment_schedule")
        .select("id,amount_bdt,paid_amount_bdt,due_date,status,enrollment_id,patient_enrollments!inner(patient_id)")
        .eq("patient_enrollments.patient_id", pid)
        .order("due_date"),
    ]);

    return {
      linked: true as const,
      patient: patientRes.data,
      timeline: timelineRes.data ?? [],
      appointments: apptRes.data ?? [],
      prescriptions: prescRes.data ?? [],
      dietPlans: dietRes.data ?? [],
      vitals: vitalsRes.data ?? [],
      labs: labsRes.data ?? [],
      enrollments: enrRes.data ?? [],
      schedule: schedRes.data ?? [],
    };
  });
