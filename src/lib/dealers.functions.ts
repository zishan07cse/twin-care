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
async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// ============ Dealers ============
const dealerSchema = z.object({
  business_name: z.string().trim().min(1).max(200),
  business_name_bn: z.string().trim().max(200).optional().nullable(),
  proprietor_name: z.string().trim().max(200).optional().nullable(),
  trade_license_no: z.string().trim().max(100).optional().nullable(),
  tin: z.string().trim().max(50).optional().nullable(),
  bin: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  district: z.string().trim().max(120).optional().nullable(),
  division: z.string().trim().max(120).optional().nullable(),
  territory: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  dealer_type: z.enum(["distributor", "sub_dealer", "retailer", "pharmacy", "hospital_shop"]),
  onboarded_at: z.string().optional(),
  agreement_url: z.string().trim().max(500).optional().nullable(),
  security_deposit_bdt: z.number().min(0).default(0),
  status: z.enum(["active", "suspended", "terminated"]).default("active"),
  sales_officer_id: z.string().uuid().nullable().optional().or(z.literal("")),
  price_tier: z.enum(["distributor", "dealer", "retailer"]).default("dealer"),
  credit_limit_bdt: z.number().min(0).default(0),
  credit_period: z.enum(["cash", "net_7", "net_15", "net_30", "net_45"]).default("cash"),
  early_payment_discount_pct: z.number().min(0).max(100).default(0),
  penalty_pct: z.number().min(0).max(100).default(0),
  overdue_grace_days: z.number().int().min(0).max(365).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type DealerValues = z.infer<typeof dealerSchema>;

export const listDealers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("dealers")
      .select("*")
      .order("business_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDealer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("dealers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Dealer not found");
    return row;
  });

export const upsertDealer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: dealerSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    const values = {
      ...data.values,
      email: data.values.email || null,
      sales_officer_id: data.values.sales_officer_id || null,
      onboarded_at: data.values.onboarded_at || undefined,
    };
    if (data.id) {
      const { error } = await context.supabase.from("dealers").update(values).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error } = await (context.supabase as any)
      .from("dealers")
      .insert({ ...values, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id as string };
  });

export const deleteDealer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("dealers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Sales officer directory ============
export const listSalesOfficers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["sales_officer", "admin", "super_admin"]);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((roles ?? []).map((r: { user_id: string }) => r.user_id)));
    if (ids.length === 0) return [];
    const { data: profs, error: pErr } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    return profs ?? [];
  });

// ============ Trade catalog (items + tier prices) ============
export const listTradeCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    const [items, prices] = await Promise.all([
      context.supabase
        .from("inventory_items")
        .select(
          "id,name_en,name_bn,sku,category,unit_price_bdt,mrp_bdt,stock_qty,trade_stock_qty,is_trade_sellable,is_active",
        )
        .order("name_en"),
      context.supabase.from("dealer_price_tiers").select("id,item_id,tier,unit_price_bdt"),
    ]);
    if (items.error) throw new Error(items.error.message);
    if (prices.error) throw new Error(prices.error.message);
    return { items: items.data ?? [], prices: prices.data ?? [] };
  });

export const updateItemTradeFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        mrp_bdt: z.number().min(0),
        is_trade_sellable: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("inventory_items")
      .update({ mrp_bdt: data.mrp_bdt, is_trade_sellable: data.is_trade_sellable })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertTierPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        item_id: z.string().uuid(),
        tier: z.enum(["distributor", "dealer", "retailer"]),
        unit_price_bdt: z.number().min(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("dealer_price_tiers")
      .upsert(
        {
          item_id: data.item_id,
          tier: data.tier,
          unit_price_bdt: data.unit_price_bdt,
        },
        { onConflict: "item_id,tier" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Stock allocation program <-> trade ============
export const listStockAllocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ item_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (context.supabase as any)
      .from("stock_allocations")
      .select("*, item:inventory_items(id,name_en,name_bn)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.item_id) q = q.eq("item_id", data.item_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const allocateStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        item_id: z.string().uuid(),
        from_pool: z.enum(["program", "trade"]),
        to_pool: z.enum(["program", "trade"]),
        quantity: z.number().int().min(1),
        note: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    if (data.from_pool === data.to_pool) throw new Error("Choose different pools");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).from("stock_allocations").insert({
      item_id: data.item_id,
      from_pool: data.from_pool,
      to_pool: data.to_pool,
      quantity: data.quantity,
      note: data.note || null,
      moved_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Dealer targets ============
const targetSchema = z.object({
  dealer_id: z.string().uuid(),
  period: z.enum(["month", "quarter", "year"]),
  period_start: z.string(),
  target_bdt: z.number().min(0).default(0),
  target_units: z.number().int().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
});
export type TargetValues = z.infer<typeof targetSchema>;

export const listDealerTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dealer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (context.supabase as any)
      .from("dealer_targets")
      .select("*")
      .eq("dealer_id", data.dealer_id)
      .order("period_start", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertDealerTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), values: targetSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    if (data.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (context.supabase as any)
        .from("dealer_targets")
        .update(data.values)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (context.supabase as any)
        .from("dealer_targets")
        .insert({ ...data.values, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteDealerTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("dealer_targets")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
