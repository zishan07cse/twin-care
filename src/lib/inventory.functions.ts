import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertInventoryAccess(supabase: any, userId: string) {
  const [{ data: staff }, { data: inv }] = await Promise.all([
    supabase.rpc("is_staff", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "inventory_manager" }),
  ]);
  if (!staff && !inv) throw new Error("Forbidden");
}

const itemSchema = z.object({
  name_en: z.string().trim().min(1).max(200),
  name_bn: z.string().trim().max(200).optional().nullable(),
  sku: z.string().trim().max(100).optional().nullable(),
  category: z.enum(["device", "consumable", "sensor", "medicine", "other"]),
  is_returnable: z.boolean().default(false),
  unit_price_bdt: z.number().min(0).default(0),
  stock_qty: z.number().int().min(0).default(0),
  reorder_level: z.number().int().min(0).default(0),
  lifespan_days: z.number().int().min(1).max(3650).nullable().optional(),
  notes: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().default(true),
});

export type InventoryItemValues = z.infer<typeof itemSchema>;

export const listInventoryItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("inventory_items")
      .select("*")
      .order("name_en");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: itemSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    if (data.id) {
      const { error } = await context.supabase
        .from("inventory_items")
        .update(data.values)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("inventory_items")
        .insert({ ...data.values, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("inventory_items")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Assignments ----------
const assignmentSchema = z.object({
  item_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
  assigned_at: z.string().optional(),
  expires_at: z.string().nullable().optional(),
  deposit_bdt: z.number().min(0).default(0),
  notes: z.string().max(2000).optional().nullable(),
  extra_issuance_id: z.string().uuid().nullable().optional(),
});

export type AssignmentValues = z.infer<typeof assignmentSchema>;

export const listAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ patient_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    let q = context.supabase
      .from("inventory_assignments")
      .select(
        "*, item:inventory_items(id,name_en,name_bn,category,is_returnable), patient:patients(id,patient_code,full_name)",
      )
      .order("assigned_at", { ascending: false })
      .limit(500);
    if (data.patient_id) q = q.eq("patient_id", data.patient_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignmentSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    const { data: item, error: iErr } = await context.supabase
      .from("inventory_items")
      .select("stock_qty,is_active")
      .eq("id", data.item_id)
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!item) throw new Error("Item not found");
    if (!item.is_active) throw new Error("Item is inactive");
    if (item.stock_qty < data.quantity)
      throw new Error(`Insufficient stock (${item.stock_qty} available)`);

    // Entitlement validation happens in a DB trigger; over-issuance requires an
    // approved extra_issuance_id which we pass through here.
    const { data: inserted, error } = await context.supabase
      .from("inventory_assignments")
      .insert({
        item_id: data.item_id,
        patient_id: data.patient_id,
        quantity: data.quantity,
        assigned_at: data.assigned_at || new Date().toISOString(),
        expires_at: data.expires_at || null,
        deposit_bdt: data.deposit_bdt,
        notes: data.notes || null,
        extra_issuance_id: data.extra_issuance_id || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Link the assignment back onto the extra_issuance so the row flips to consumed.
    if (data.extra_issuance_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (context.supabase as any)
        .from("extra_issuances")
        .update({ assignment_id: inserted.id })
        .eq("id", data.extra_issuance_id);
    }
    return { ok: true };
  });

export const updateAssignmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["active", "returned", "consumed", "lost", "expired"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("inventory_assignments")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPatientsForInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("patients")
      .select("id, patient_code, full_name")
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Purchases (restock) ----------
const purchaseSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  unit_cost_bdt: z.number().min(0).default(0),
  supplier: z.string().trim().max(200).optional().nullable(),
  invoice_no: z.string().trim().max(100).optional().nullable(),
  purchased_at: z.string().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export type PurchaseValues = z.infer<typeof purchaseSchema>;

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ item_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (context.supabase as any)
      .from("inventory_purchases")
      .select("*, item:inventory_items(id,name_en,name_bn)")
      .order("purchased_at", { ascending: false })
      .limit(500);
    if (data.item_id) q = q.eq("item_id", data.item_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => purchaseSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertInventoryAccess(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("inventory_purchases")
      .insert({
        item_id: data.item_id,
        quantity: data.quantity,
        unit_cost_bdt: data.unit_cost_bdt,
        supplier: data.supplier || null,
        invoice_no: data.invoice_no || null,
        purchased_at: data.purchased_at || new Date().toISOString(),
        notes: data.notes || null,
        created_by: context.userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("inventory_purchases")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
