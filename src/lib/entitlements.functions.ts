// Phase 1: Package Device Entitlements
// Server functions for the package matrix, patient snapshots, and extra-issuance approvals.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (s: unknown) => s as any;

async function assertInventoryAccess(supabase: unknown, userId: string) {
  const db = anyDb(supabase);
  const [{ data: staff }, { data: inv }] = await Promise.all([
    db.rpc("is_staff", { _user_id: userId }),
    db.rpc("has_role", { _user_id: userId, _role: "inventory_manager" }),
  ]);
  if (!staff && !inv) throw new Error("Forbidden");
}
async function assertAdmin(supabase: unknown, userId: string) {
  const db = anyDb(supabase);
  const [{ data: a }, { data: sa }] = await Promise.all([
    db.rpc("has_role", { _user_id: userId, _role: "admin" }),
    db.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
  ]);
  if (!a && !sa) throw new Error("Admin required");
}

// ---------- Package matrix ----------
const packageEntitlementSchema = z.object({
  plan_id: z.string().uuid(),
  item_id: z.string().uuid(),
  quantity: z.number().int().min(0),
  ownership_mode: z.enum(["free", "deposit", "sold"]).default("free"),
  deposit_bdt: z.number().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
});
export type PackageEntitlementValues = z.infer<typeof packageEntitlementSchema>;

export const listPackageEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    const { data: rows, error } = await anyDb(context.supabase)
      .from("package_device_entitlements")
      .select("*, item:inventory_items(id,name_en,name_bn,category,is_returnable,unit_price_bdt)")
      .eq("plan_id", data.plan_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPackageEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: packageEntitlementSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    const db = anyDb(context.supabase);
    if (data.id) {
      const { error } = await db
        .from("package_device_entitlements")
        .update(data.values)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from("package_device_entitlements")
        .upsert(data.values, { onConflict: "plan_id,item_id" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePackageEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    const { error } = await anyDb(context.supabase)
      .from("package_device_entitlements")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Patient snapshot ----------
export const listPatientEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ patient_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Staff, inventory, or the patient themselves — RLS enforces this
    const { data: rows, error } = await anyDb(context.supabase)
      .from("patient_entitlements")
      .select(
        "*, item:inventory_items(id,name_en,name_bn,category,is_returnable), enrollment:patient_enrollments(id,plan_id,status,start_date)",
      )
      .eq("patient_id", data.patient_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Extra issuances ----------
const extraIssuanceSchema = z.object({
  patient_id: z.string().uuid(),
  item_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  reason: z.string().trim().min(1).max(500),
  chargeable: z.boolean().default(false),
  amount_bdt: z.number().min(0).default(0),
  notes: z.string().max(1000).optional().nullable(),
});
export type ExtraIssuanceValues = z.infer<typeof extraIssuanceSchema>;

export const listExtraIssuances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        patient_id: z.string().uuid().optional(),
        status: z.enum(["pending", "approved", "rejected", "consumed", "all"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    let q = anyDb(context.supabase)
      .from("extra_issuances")
      .select(
        "*, item:inventory_items(id,name_en,category), patient:patients(id,patient_code,full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.patient_id) q = q.eq("patient_id", data.patient_id);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const requestExtraIssuance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => extraIssuanceSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    const { data: row, error } = await anyDb(context.supabase)
      .from("extra_issuances")
      .insert({ ...data, requested_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const decideExtraIssuance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await anyDb(context.supabase)
      .from("extra_issuances")
      .update({
        status: data.decision,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Reports: consumption by package + demand forecast ----------
export const getInventoryDemandForecast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    const db = anyDb(context.supabase);
    // Sum undelivered entitlements from active/paused enrollments per item
    const { data: ents, error } = await db
      .from("patient_entitlements")
      .select(
        "item_id, quantity_entitled, quantity_delivered, item:inventory_items(id,name_en,category,stock_qty,reorder_level), enrollment:patient_enrollments!inner(status)",
      )
      .in("enrollment.status", ["active", "paused"]);
    if (error) throw new Error(error.message);

    type Row = {
      item_id: string;
      name_en: string;
      category: string;
      stock_qty: number;
      reorder_level: number;
      undelivered: number;
      shortfall: number;
    };
    const map = new Map<string, Row>();
    for (const e of ents ?? []) {
      const item = (e as { item: { id: string; name_en: string; category: string; stock_qty: number; reorder_level: number } }).item;
      if (!item) continue;
      const key = item.id;
      const remaining = Math.max(
        0,
        (e as { quantity_entitled: number }).quantity_entitled -
          (e as { quantity_delivered: number }).quantity_delivered,
      );
      const cur =
        map.get(key) ??
        {
          item_id: key,
          name_en: item.name_en,
          category: item.category,
          stock_qty: item.stock_qty,
          reorder_level: item.reorder_level,
          undelivered: 0,
          shortfall: 0,
        };
      cur.undelivered += remaining;
      cur.shortfall = Math.max(0, cur.undelivered - cur.stock_qty);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.shortfall - a.shortfall);
  });

export const getConsumptionByPackage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    const db = anyDb(context.supabase);
    // Group patient_entitlements delivered qty per plan × item
    const { data, error } = await db
      .from("patient_entitlements")
      .select(
        "quantity_entitled, quantity_delivered, item:inventory_items(id,name_en,category), enrollment:patient_enrollments!inner(plan_id, plan:program_plans(id,name))",
      );
    if (error) throw new Error(error.message);
    type Row = {
      plan_id: string;
      plan_name: string;
      item_id: string;
      item_name: string;
      category: string;
      entitled: number;
      delivered: number;
    };
    const map = new Map<string, Row>();
    for (const e of data ?? []) {
      const row = e as {
        quantity_entitled: number;
        quantity_delivered: number;
        item: { id: string; name_en: string; category: string } | null;
        enrollment: { plan_id: string; plan: { id: string; name: string } | null } | null;
      };
      if (!row.item || !row.enrollment?.plan) continue;
      const key = `${row.enrollment.plan_id}:${row.item.id}`;
      const cur =
        map.get(key) ??
        {
          plan_id: row.enrollment.plan_id,
          plan_name: row.enrollment.plan.name,
          item_id: row.item.id,
          item_name: row.item.name_en,
          category: row.item.category,
          entitled: 0,
          delivered: 0,
        };
      cur.entitled += row.quantity_entitled;
      cur.delivered += row.quantity_delivered;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort(
      (a, b) => a.plan_name.localeCompare(b.plan_name) || b.delivered - a.delivered,
    );
  });
