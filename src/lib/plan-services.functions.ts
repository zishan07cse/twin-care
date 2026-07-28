// Plan service inclusions — configurable services (doctor visits, nutritionist,
// lab tests, teleconsults, etc.) shipped with each program plan.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (s: unknown) => s as any;

async function assertAdmin(supabase: unknown, userId: string) {
  const db = anyDb(supabase);
  const [{ data: a }, { data: sa }] = await Promise.all([
    db.rpc("has_role", { _user_id: userId, _role: "admin" }),
    db.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
  ]);
  if (!a && !sa) throw new Error("Admin required");
}

export const PLAN_SERVICE_TYPES = [
  "doctor_visit",
  "nutritionist_visit",
  "care_coordinator_checkin",
  "lab_test",
  "group_session",
  "home_visit",
  "teleconsult",
  "custom",
] as const;

export const PLAN_SERVICE_FREQUENCIES = [
  "total",
  "per_month",
  "per_quarter",
  "unlimited",
] as const;

const serviceSchema = z.object({
  plan_id: z.string().uuid(),
  service_type: z.enum(PLAN_SERVICE_TYPES),
  label: z.string().trim().min(1).max(200),
  label_bn: z.string().trim().max(200).optional().nullable(),
  quantity: z.number().int().min(0).default(1),
  frequency: z.enum(PLAN_SERVICE_FREQUENCIES).default("total"),
  notes: z.string().max(1000).optional().nullable(),
  sort_order: z.number().int().default(0),
});
export type PlanServiceValues = z.infer<typeof serviceSchema>;

export const listPlanServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await anyDb(context.supabase)
      .from("plan_service_inclusions")
      .select("*")
      .eq("plan_id", data.plan_id)
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPlanService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: serviceSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = anyDb(context.supabase);
    if (data.id) {
      const { error } = await db
        .from("plan_service_inclusions")
        .update(data.values)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("plan_service_inclusions").insert(data.values);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePlanService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await anyDb(context.supabase)
      .from("plan_service_inclusions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Combined snapshot used by the enroll dialog to preview "what's in this package".
export const getPlanInclusionsPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const [devicesRes, servicesRes] = await Promise.all([
      db
        .from("package_device_entitlements")
        .select("id, quantity, ownership_mode, deposit_bdt, item:inventory_items(id,name_en,name_bn,category)")
        .eq("plan_id", data.plan_id),
      db
        .from("plan_service_inclusions")
        .select("*")
        .eq("plan_id", data.plan_id)
        .order("sort_order"),
    ]);
    if (devicesRes.error) throw new Error(devicesRes.error.message);
    if (servicesRes.error) throw new Error(servicesRes.error.message);
    return { devices: devicesRes.data ?? [], services: servicesRes.data ?? [] };
  });
