import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSalesOrStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_sales_or_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// ============ Sales Orders ============
const orderItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  unit_price_bdt: z.number().min(0),
  discount_pct: z.number().min(0).max(100).default(0),
});

const orderSchema = z.object({
  dealer_id: z.string().uuid(),
  order_date: z.string().optional(),
  vat_pct: z.number().min(0).max(100).default(15),
  ait_pct: z.number().min(0).max(100).default(5),
  discount_bdt: z.number().min(0).default(0),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(orderItemSchema).min(1),
  credit_override_reason: z.string().max(500).optional().nullable(),
});

export type OrderValues = z.infer<typeof orderSchema>;

function computeOrderTotals(
  items: z.infer<typeof orderItemSchema>[],
  discount_bdt: number,
  vat_pct: number,
  ait_pct: number,
) {
  const lines = items.map((it) => {
    const gross = it.quantity * it.unit_price_bdt;
    const line = gross * (1 - it.discount_pct / 100);
    return { ...it, line_total_bdt: Math.round(line * 100) / 100 };
  });
  const subtotal = lines.reduce((s, l) => s + l.line_total_bdt, 0);
  const taxable = Math.max(subtotal - discount_bdt, 0);
  const vat = Math.round(taxable * (vat_pct / 100) * 100) / 100;
  const ait = Math.round(taxable * (ait_pct / 100) * 100) / 100;
  const total = Math.round((taxable + vat + ait) * 100) / 100;
  return { lines, subtotal, vat, ait, total };
}

export const listSalesOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dealer_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (context.supabase as any)
      .from("sales_orders")
      .select("*, dealer:dealers(id,business_name,dealer_code)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.dealer_id) q = q.eq("dealer_id", data.dealer_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getSalesOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const [order, items, challans] = await Promise.all([
      sb.from("sales_orders").select("*, dealer:dealers(*)").eq("id", data.id).maybeSingle(),
      sb
        .from("sales_order_items")
        .select("*, item:inventory_items(id,name_en,name_bn,sku)")
        .eq("order_id", data.id),
      sb
        .from("delivery_challans")
        .select("*")
        .eq("order_id", data.id)
        .order("dispatch_date", { ascending: false }),
    ]);
    if (order.error) throw new Error(order.error.message);
    if (items.error) throw new Error(items.error.message);
    if (challans.error) throw new Error(challans.error.message);
    return { order: order.data, items: items.data ?? [], challans: challans.data ?? [] };
  });

export const createSalesOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { lines, subtotal, vat, ait, total } = computeOrderTotals(
      data.items,
      data.discount_bdt,
      data.vat_pct,
      data.ait_pct,
    );

    const { data: order, error } = await sb
      .from("sales_orders")
      .insert({
        dealer_id: data.dealer_id,
        order_date: data.order_date || undefined,
        vat_pct: data.vat_pct,
        ait_pct: data.ait_pct,
        discount_bdt: data.discount_bdt,
        subtotal_bdt: subtotal,
        vat_bdt: vat,
        ait_bdt: ait,
        total_bdt: total,
        notes: data.notes || null,
        credit_override_reason: data.credit_override_reason || null,
        credit_override_by: data.credit_override_reason ? context.userId : null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const itemRows = lines.map((l) => ({
      order_id: order.id,
      item_id: l.item_id,
      quantity: l.quantity,
      unit_price_bdt: l.unit_price_bdt,
      discount_pct: l.discount_pct,
      line_total_bdt: l.line_total_bdt,
    }));
    const { error: itErr } = await sb.from("sales_order_items").insert(itemRows);
    if (itErr) throw new Error(itErr.message);
    return { ok: true, id: order.id as string };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum([
          "draft",
          "confirmed",
          "partially_delivered",
          "delivered",
          "closed",
          "cancelled",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("sales_orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Delivery Challans ============
const challanSchema = z.object({
  order_id: z.string().uuid(),
  dispatch_date: z.string().optional(),
  courier: z.string().max(200).optional().nullable(),
  transport_ref: z.string().max(200).optional().nullable(),
  receiver_ack_url: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  auto_invoice: z.boolean().default(true),
  items: z
    .array(
      z.object({
        order_item_id: z.string().uuid(),
        item_id: z.string().uuid(),
        delivered_qty: z.number().int().min(1),
        serials: z.string().max(2000).optional().nullable(),
        batch_no: z.string().max(100).optional().nullable(),
        expiry_date: z.string().optional().nullable(),
        unit_price_bdt: z.number().min(0),
      }),
    )
    .min(1),
});

export type ChallanValues = z.infer<typeof challanSchema>;

export const listChallans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from("delivery_challans")
      .select("*, dealer:dealers(business_name,dealer_code), order:sales_orders(order_no)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createChallan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => challanSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;

    const { data: order, error: oErr } = await sb
      .from("sales_orders")
      .select("id,dealer_id,vat_pct,ait_pct")
      .eq("id", data.order_id)
      .single();
    if (oErr) throw new Error(oErr.message);

    const { data: challan, error } = await sb
      .from("delivery_challans")
      .insert({
        order_id: data.order_id,
        dealer_id: order.dealer_id,
        dispatch_date: data.dispatch_date || undefined,
        courier: data.courier || null,
        transport_ref: data.transport_ref || null,
        receiver_ack_url: data.receiver_ack_url || null,
        notes: data.notes || null,
        delivered_by: context.userId,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const rows = data.items.map((it) => ({
      challan_id: challan.id,
      order_item_id: it.order_item_id,
      item_id: it.item_id,
      delivered_qty: it.delivered_qty,
      serials: it.serials
        ? it.serials
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : null,
      batch_no: it.batch_no || null,
      expiry_date: it.expiry_date || null,
      unit_price_bdt: it.unit_price_bdt,
      line_total_bdt: Math.round(it.delivered_qty * it.unit_price_bdt * 100) / 100,
    }));
    const { error: cErr } = await sb.from("challan_items").insert(rows);
    if (cErr) throw new Error(cErr.message);

    let invoice_id: string | null = null;
    if (data.auto_invoice) {
      const subtotal = rows.reduce((s, r) => s + r.line_total_bdt, 0);
      const vat = Math.round(subtotal * (order.vat_pct / 100) * 100) / 100;
      const ait = Math.round(subtotal * (order.ait_pct / 100) * 100) / 100;
      const total = Math.round((subtotal + vat + ait) * 100) / 100;

      const { data: dealerRow } = await sb
        .from("dealers")
        .select("credit_period")
        .eq("id", order.dealer_id)
        .single();
      const days =
        dealerRow?.credit_period === "net_7"
          ? 7
          : dealerRow?.credit_period === "net_15"
            ? 15
            : dealerRow?.credit_period === "net_30"
              ? 30
              : dealerRow?.credit_period === "net_45"
                ? 45
                : 0;
      const due = new Date();
      due.setDate(due.getDate() + days);

      const { data: inv, error: iErr } = await sb
        .from("trade_invoices")
        .insert({
          dealer_id: order.dealer_id,
          challan_id: challan.id,
          order_id: data.order_id,
          due_date: due.toISOString().slice(0, 10),
          vat_pct: order.vat_pct,
          ait_pct: order.ait_pct,
          subtotal_bdt: subtotal,
          vat_bdt: vat,
          ait_bdt: ait,
          total_bdt: total,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (iErr) throw new Error(iErr.message);
      invoice_id = inv.id;

      const invItems = rows.map((r) => ({
        invoice_id: inv.id,
        item_id: r.item_id,
        quantity: r.delivered_qty,
        unit_price_bdt: r.unit_price_bdt,
        line_total_bdt: r.line_total_bdt,
      }));
      const { error: iiErr } = await sb.from("trade_invoice_items").insert(invItems);
      if (iiErr) throw new Error(iiErr.message);
    }

    return { ok: true, id: challan.id as string, invoice_id };
  });

// ============ Trade Invoices ============
export const listTradeInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dealer_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (context.supabase as any)
      .from("trade_invoices")
      .select("*, dealer:dealers(id,business_name,dealer_code)")
      .order("invoice_date", { ascending: false })
      .limit(500);
    if (data.dealer_id) q = q.eq("dealer_id", data.dealer_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const [inv, items, allocs] = await Promise.all([
      sb.from("trade_invoices").select("*, dealer:dealers(*)").eq("id", data.id).maybeSingle(),
      sb
        .from("trade_invoice_items")
        .select("*, item:inventory_items(name_en,name_bn,sku)")
        .eq("invoice_id", data.id),
      sb
        .from("payment_allocations")
        .select("*, payment:dealer_payments(payment_date,method,reference)")
        .eq("invoice_id", data.id),
    ]);
    if (inv.error) throw new Error(inv.error.message);
    if (items.error) throw new Error(items.error.message);
    if (allocs.error) throw new Error(allocs.error.message);
    return { invoice: inv.data, items: items.data ?? [], allocations: allocs.data ?? [] };
  });

// ============ Dealer Payments ============
const paymentSchema = z.object({
  dealer_id: z.string().uuid(),
  amount_bdt: z.number().min(0.01),
  payment_date: z.string().optional(),
  method: z.enum(["cash", "bank", "cheque", "bkash", "nagad", "card", "other"]),
  reference: z.string().max(200).optional().nullable(),
  deposit_slip_url: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  auto_allocate: z.boolean().default(true),
  allocations: z
    .array(z.object({ invoice_id: z.string().uuid(), amount_bdt: z.number().min(0.01) }))
    .optional(),
  cheque: z
    .object({
      cheque_no: z.string().min(1),
      bank: z.string().optional().nullable(),
      branch: z.string().optional().nullable(),
      cheque_date: z.string(),
    })
    .optional(),
});

export type PaymentValues = z.infer<typeof paymentSchema>;

export const listDealerPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dealer_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (context.supabase as any)
      .from("dealer_payments")
      .select("*, dealer:dealers(id,business_name,dealer_code)")
      .order("payment_date", { ascending: false })
      .limit(500);
    if (data.dealer_id) q = q.eq("dealer_id", data.dealer_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const recordDealerPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => paymentSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;

    const { data: pay, error } = await sb
      .from("dealer_payments")
      .insert({
        dealer_id: data.dealer_id,
        amount_bdt: data.amount_bdt,
        payment_date: data.payment_date || undefined,
        method: data.method,
        reference: data.reference || null,
        deposit_slip_url: data.deposit_slip_url || null,
        notes: data.notes || null,
        unallocated_bdt: data.amount_bdt,
        received_by: context.userId,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.method === "cheque" && data.cheque) {
      const { error: cErr } = await sb.from("cheques").insert({
        payment_id: pay.id,
        dealer_id: data.dealer_id,
        cheque_no: data.cheque.cheque_no,
        bank: data.cheque.bank || null,
        branch: data.cheque.branch || null,
        cheque_date: data.cheque.cheque_date,
        amount_bdt: data.amount_bdt,
        created_by: context.userId,
      });
      if (cErr) throw new Error(cErr.message);
    }

    // Manual allocations
    if (data.allocations && data.allocations.length > 0) {
      const rows = data.allocations.map((a) => ({
        payment_id: pay.id,
        invoice_id: a.invoice_id,
        amount_bdt: a.amount_bdt,
      }));
      const { error: aErr } = await sb.from("payment_allocations").insert(rows);
      if (aErr) throw new Error(aErr.message);
    } else if (data.auto_allocate) {
      // FIFO auto-allocate against unpaid/partial invoices oldest-first
      const { data: invs, error: iErr } = await sb
        .from("trade_invoices")
        .select("id,total_bdt,paid_amount_bdt,status")
        .eq("dealer_id", data.dealer_id)
        .in("status", ["unpaid", "partial", "overdue"])
        .order("invoice_date", { ascending: true });
      if (iErr) throw new Error(iErr.message);
      let remaining = data.amount_bdt;
      for (const inv of invs ?? []) {
        if (remaining <= 0) break;
        const outstanding = Number(inv.total_bdt) - Number(inv.paid_amount_bdt);
        if (outstanding <= 0) continue;
        const amt = Math.min(outstanding, remaining);
        const { error: aErr } = await sb.from("payment_allocations").insert({
          payment_id: pay.id,
          invoice_id: inv.id,
          amount_bdt: amt,
        });
        if (aErr) throw new Error(aErr.message);
        remaining = Math.round((remaining - amt) * 100) / 100;
      }
    }

    return { ok: true, id: pay.id as string };
  });

// ============ Cheques ============
export const listCheques = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from("cheques")
      .select("*, dealer:dealers(business_name,dealer_code)")
      .order("cheque_date", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateChequeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["received", "deposited", "cleared", "bounced", "cancelled"]),
        bounce_reason: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    const today = new Date().toISOString().slice(0, 10);
    const patch = {
      status: data.status,
      deposited_on: data.status === "deposited" ? today : null,
      cleared_on: data.status === "cleared" ? today : null,
      bounced_on: data.status === "bounced" ? today : null,
      bounce_reason: data.status === "bounced" ? data.bounce_reason || null : null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).from("cheques").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Ledger / Aging summary for a dealer ============
export const getDealerLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dealer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const [invs, pays] = await Promise.all([
      sb
        .from("trade_invoices")
        .select("id,invoice_no,invoice_date,due_date,total_bdt,paid_amount_bdt,status")
        .eq("dealer_id", data.dealer_id)
        .order("invoice_date", { ascending: false }),
      sb
        .from("dealer_payments")
        .select("id,payment_date,method,amount_bdt,reference,unallocated_bdt")
        .eq("dealer_id", data.dealer_id)
        .order("payment_date", { ascending: false }),
    ]);
    if (invs.error) throw new Error(invs.error.message);
    if (pays.error) throw new Error(pays.error.message);

    const today = new Date();
    const aging = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
    let outstanding = 0;
    for (const inv of invs.data ?? []) {
      const bal = Number(inv.total_bdt) - Number(inv.paid_amount_bdt);
      if (bal <= 0) continue;
      outstanding += bal;
      const due = new Date(inv.due_date);
      const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
      if (days <= 0) aging.current += bal;
      else if (days <= 30) aging.d30 += bal;
      else if (days <= 60) aging.d60 += bal;
      else if (days <= 90) aging.d90 += bal;
      else aging.d90plus += bal;
    }
    return { invoices: invs.data ?? [], payments: pays.data ?? [], aging, outstanding };
  });

// ============ Credit / Debit notes ============
const creditNoteSchema = z.object({
  dealer_id: z.string().uuid(),
  invoice_id: z.string().uuid().nullable().optional(),
  cn_date: z.string().optional(),
  reason: z.enum(["return", "discount", "adjustment", "damage", "other"]).default("adjustment"),
  amount_bdt: z.number().positive(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listCreditNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dealer_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (context.supabase as any)
      .from("credit_notes")
      .select("*, dealer:dealers(business_name,dealer_code), invoice:trade_invoices(invoice_no)")
      .order("cn_date", { ascending: false })
      .limit(500);
    if (data.dealer_id) q = q.eq("dealer_id", data.dealer_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createCreditNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => creditNoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (context.supabase as any)
      .from("credit_notes")
      .insert({ ...data, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const debitNoteSchema = z.object({
  dealer_id: z.string().uuid(),
  invoice_id: z.string().uuid().nullable().optional(),
  dn_date: z.string().optional(),
  reason: z.enum(["freight", "penalty", "extra_charge", "adjustment", "other"]).default("adjustment"),
  amount_bdt: z.number().positive(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listDebitNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dealer_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (context.supabase as any)
      .from("debit_notes")
      .select("*, dealer:dealers(business_name,dealer_code), invoice:trade_invoices(invoice_no)")
      .order("dn_date", { ascending: false })
      .limit(500);
    if (data.dealer_id) q = q.eq("dealer_id", data.dealer_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createDebitNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => debitNoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (context.supabase as any)
      .from("debit_notes")
      .insert({ ...data, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============ Sales returns ============
const returnItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  good_qty: z.number().int().min(0).default(0),
  damaged_qty: z.number().int().min(0).default(0),
  unit_price_bdt: z.number().min(0).default(0),
  notes: z.string().max(500).nullable().optional(),
});

const returnSchema = z.object({
  dealer_id: z.string().uuid(),
  invoice_id: z.string().uuid().nullable().optional(),
  return_date: z.string().optional(),
  reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  items: z.array(returnItemSchema).min(1),
});

export const listSalesReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dealer_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (context.supabase as any)
      .from("sales_returns")
      .select("*, dealer:dealers(business_name,dealer_code), invoice:trade_invoices(invoice_no)")
      .order("return_date", { ascending: false })
      .limit(500);
    if (data.dealer_id) q = q.eq("dealer_id", data.dealer_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getSalesReturn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const [ret, items] = await Promise.all([
      sb.from("sales_returns").select("*, dealer:dealers(business_name)").eq("id", data.id).single(),
      sb
        .from("sales_return_items")
        .select("*, item:inventory_items(name_en,sku)")
        .eq("return_id", data.id),
    ]);
    if (ret.error) throw new Error(ret.error.message);
    if (items.error) throw new Error(items.error.message);
    return { ret: ret.data, items: items.data ?? [] };
  });

export const createSalesReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => returnSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: ret, error } = await sb
      .from("sales_returns")
      .insert({
        dealer_id: data.dealer_id,
        invoice_id: data.invoice_id ?? null,
        return_date: data.return_date,
        reason: data.reason ?? null,
        notes: data.notes ?? null,
        status: "received",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const rows = data.items.map((it) => ({
      return_id: ret.id,
      item_id: it.item_id,
      quantity: it.quantity,
      good_qty: it.good_qty,
      damaged_qty: it.damaged_qty,
      unit_price_bdt: it.unit_price_bdt,
      line_total_bdt: Math.round(it.quantity * it.unit_price_bdt * 100) / 100,
      notes: it.notes ?? null,
    }));
    const { error: e2 } = await sb.from("sales_return_items").insert(rows);
    if (e2) throw new Error(e2.message);
    return ret;
  });

export const updateReturnStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "received", "restocked", "closed", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("sales_returns")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Warranty claims ============
const warrantySchema = z.object({
  dealer_id: z.string().uuid(),
  item_id: z.string().uuid(),
  serial_no: z.string().max(100).nullable().optional(),
  batch_no: z.string().max(100).nullable().optional(),
  claim_date: z.string().optional(),
  issue_description: z.string().max(2000).nullable().optional(),
});

export const listWarrantyClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dealer_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (context.supabase as any)
      .from("warranty_claims")
      .select("*, dealer:dealers(business_name,dealer_code), item:inventory_items(name_en,sku)")
      .order("claim_date", { ascending: false })
      .limit(500);
    if (data.dealer_id) q = q.eq("dealer_id", data.dealer_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createWarrantyClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => warrantySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (context.supabase as any)
      .from("warranty_claims")
      .insert({ ...data, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateWarrantyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "under_review", "approved", "rejected", "replaced", "closed"]),
        resolution: z.string().max(2000).nullable().optional(),
        replaced_serial: z.string().max(100).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("warranty_claims")
      .update({
        status: data.status,
        resolution: data.resolution ?? null,
        replaced_serial: data.replaced_serial ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Aging report (all dealers) ============
export const dealerAgingReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: invs, error } = await sb
      .from("trade_invoices")
      .select("dealer_id,due_date,total_bdt,paid_amount_bdt,status,dealer:dealers(business_name,dealer_code,credit_limit_bdt)")
      .neq("status", "void")
      .neq("status", "paid");
    if (error) throw new Error(error.message);
    const map = new Map<
      string,
      {
        dealer_id: string;
        dealer_code: string;
        business_name: string;
        credit_limit_bdt: number;
        current: number;
        d30: number;
        d60: number;
        d90: number;
        d90plus: number;
        outstanding: number;
      }
    >();
    const today = new Date();
    for (const inv of invs ?? []) {
      const bal = Number(inv.total_bdt) - Number(inv.paid_amount_bdt);
      if (bal <= 0) continue;
      const row =
        map.get(inv.dealer_id) ??
        {
          dealer_id: inv.dealer_id,
          dealer_code: inv.dealer?.dealer_code ?? "",
          business_name: inv.dealer?.business_name ?? "",
          credit_limit_bdt: Number(inv.dealer?.credit_limit_bdt ?? 0),
          current: 0,
          d30: 0,
          d60: 0,
          d90: 0,
          d90plus: 0,
          outstanding: 0,
        };
      const days = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000);
      if (days <= 0) row.current += bal;
      else if (days <= 30) row.d30 += bal;
      else if (days <= 60) row.d60 += bal;
      else if (days <= 90) row.d90 += bal;
      else row.d90plus += bal;
      row.outstanding += bal;
      map.set(inv.dealer_id, row);
    }
    return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
  });

// ============ Statement rows (ledger view) ============
export const getDealerStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        dealer_id: z.string().uuid(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSalesOrStaff(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (context.supabase as any)
      .from("dealer_ledger_view")
      .select("*")
      .eq("dealer_id", data.dealer_id)
      .order("entry_date", { ascending: true });
    if (data.from) q = q.gte("entry_date", data.from);
    if (data.to) q = q.lte("entry_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let balance = 0;
    const withBalance = (rows ?? []).map((r: { debit_bdt: number; credit_bdt: number }) => {
      balance += Number(r.debit_bdt) - Number(r.credit_bdt);
      return { ...r, balance_bdt: Math.round(balance * 100) / 100 };
    });
    return { rows: withBalance, closing_balance: Math.round(balance * 100) / 100 };
  });

// ============ Phase D: Distribution Dashboard & Reports ============

export const distributionDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSalesOrStaff(supabase, userId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    const [inv, invAll, pay, cheq, dealers, lowStock] = await Promise.all([
      supabase
        .from("trade_invoices")
        .select("total_bdt, paid_amount_bdt, status, invoice_date")
        .gte("invoice_date", monthStart),
      supabase
        .from("trade_invoices")
        .select("total_bdt, paid_amount_bdt, due_date, status, dealer_id"),
      supabase
        .from("dealer_payments")
        .select("amount_bdt, payment_date")
        .gte("payment_date", monthStart),
      supabase
        .from("cheques")
        .select("id, status, cheque_no, amount_bdt, deposited_on")
        .in("status", ["received", "deposited"]),
      supabase.from("dealers").select("id, status").eq("status", "active"),
      supabase
        .from("inventory_items")
        .select("id, name_en, trade_stock_qty, reorder_level")
        .gt("reorder_level", 0),
    ]);

    const mtdRevenue = (inv.data ?? []).reduce((s, r) => s + Number(r.total_bdt ?? 0), 0);
    const mtdCollections = (pay.data ?? []).reduce((s, r) => s + Number(r.amount_bdt ?? 0), 0);
    const outstanding = (invAll.data ?? []).reduce(
      (s, r) => s + Math.max(Number(r.total_bdt ?? 0) - Number(r.paid_amount_bdt ?? 0), 0),
      0,
    );
    const overdue = (invAll.data ?? [])
      .filter((r) => r.due_date && r.due_date < today && r.status !== "paid")
      .reduce(
        (s, r) => s + Math.max(Number(r.total_bdt ?? 0) - Number(r.paid_amount_bdt ?? 0), 0),
        0,
      );
    const chequesPending = (cheq.data ?? []).length;
    const chequesPendingAmount = (cheq.data ?? []).reduce(
      (s, r) => s + Number(r.amount_bdt ?? 0),
      0,
    );
    const activeDealers = (dealers.data ?? []).length;
    const lowStockItems = (lowStock.data ?? []).filter(
      (r: { trade_stock_qty: number | null; reorder_level: number | null }) =>
        Number(r.trade_stock_qty ?? 0) <= Number(r.reorder_level ?? 0),
    );

    // Top 5 dealers by MTD revenue
    const { data: topInvRows } = await supabase
      .from("trade_invoices")
      .select("dealer_id, total_bdt, dealers(business_name, dealer_code)")
      .gte("invoice_date", monthStart);
    const dealerRevMap = new Map<string, { name: string; code: string; revenue: number }>();
    for (const r of (topInvRows ?? []) as Array<{
      dealer_id: string;
      total_bdt: number;
      dealers: { business_name: string; dealer_code: string } | null;
    }>) {
      const key = r.dealer_id;
      const prev = dealerRevMap.get(key) ?? {
        name: r.dealers?.business_name ?? "—",
        code: r.dealers?.dealer_code ?? "",
        revenue: 0,
      };
      prev.revenue += Number(r.total_bdt ?? 0);
      dealerRevMap.set(key, prev);
    }
    const topDealers = Array.from(dealerRevMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      mtdRevenue: Math.round(mtdRevenue * 100) / 100,
      mtdCollections: Math.round(mtdCollections * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      overdue: Math.round(overdue * 100) / 100,
      chequesPending,
      chequesPendingAmount: Math.round(chequesPendingAmount * 100) / 100,
      activeDealers,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.slice(0, 10),
      topDealers,
    };
  });

const reportRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const salesByDealer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => reportRangeSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSalesOrStaff(supabase, userId);
    let q = supabase
      .from("trade_invoices")
      .select("dealer_id, total_bdt, paid_amount_bdt, dealers(business_name, dealer_code, territory)");
    if (data.from) q = q.gte("invoice_date", data.from);
    if (data.to) q = q.lte("invoice_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const map = new Map<
      string,
      { dealer_code: string; name: string; territory: string; invoices: number; total: number; paid: number; outstanding: number }
    >();
    for (const r of (rows ?? []) as Array<{
      dealer_id: string;
      total_bdt: number;
      paid_amount_bdt: number;
      dealers: { business_name: string; dealer_code: string; territory: string | null } | null;
    }>) {
      const key = r.dealer_id;
      const prev = map.get(key) ?? {
        dealer_code: r.dealers?.dealer_code ?? "",
        name: r.dealers?.business_name ?? "—",
        territory: r.dealers?.territory ?? "—",
        invoices: 0,
        total: 0,
        paid: 0,
        outstanding: 0,
      };
      prev.invoices += 1;
      prev.total += Number(r.total_bdt ?? 0);
      prev.paid += Number(r.paid_amount_bdt ?? 0);
      prev.outstanding += Math.max(Number(r.total_bdt ?? 0) - Number(r.paid_amount_bdt ?? 0), 0);
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  });

export const salesByProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => reportRangeSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSalesOrStaff(supabase, userId);
    let inv = supabase.from("trade_invoices").select("id, invoice_date");
    if (data.from) inv = inv.gte("invoice_date", data.from);
    if (data.to) inv = inv.lte("invoice_date", data.to);
    const { data: invoices, error: iErr } = await inv;
    if (iErr) throw new Error(iErr.message);
    const invoiceIds = (invoices ?? []).map((r) => r.id);
    if (invoiceIds.length === 0) return [];
    const { data: items, error } = await supabase
      .from("trade_invoice_items")
      .select("item_id, quantity, line_total_bdt, inventory_items(name_en, sku, category)")
      .in("invoice_id", invoiceIds);
    if (error) throw new Error(error.message);
    const map = new Map<
      string,
      { sku: string; name: string; category: string; qty: number; revenue: number }
    >();
    for (const r of (items ?? []) as Array<{
      item_id: string;
      quantity: number;
      line_total_bdt: number;
      inventory_items: { name_en: string; sku: string; category: string } | null;
    }>) {
      const prev = map.get(r.item_id) ?? {
        sku: r.inventory_items?.sku ?? "",
        name: r.inventory_items?.name_en ?? "—",
        category: r.inventory_items?.category ?? "—",
        qty: 0,
        revenue: 0,
      };
      prev.qty += Number(r.quantity ?? 0);
      prev.revenue += Number(r.line_total_bdt ?? 0);
      map.set(r.item_id, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  });

export const salesByTerritory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => reportRangeSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSalesOrStaff(supabase, userId);
    let q = supabase
      .from("trade_invoices")
      .select("total_bdt, paid_amount_bdt, dealers(territory, division, district)");
    if (data.from) q = q.gte("invoice_date", data.from);
    if (data.to) q = q.lte("invoice_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const map = new Map<
      string,
      { territory: string; division: string; invoices: number; total: number; outstanding: number }
    >();
    for (const r of (rows ?? []) as Array<{
      total_bdt: number;
      paid_amount_bdt: number;
      dealers: { territory: string | null; division: string | null; district: string | null } | null;
    }>) {
      const territory = r.dealers?.territory ?? r.dealers?.district ?? "—";
      const division = r.dealers?.division ?? "—";
      const key = `${division}|${territory}`;
      const prev = map.get(key) ?? { territory, division, invoices: 0, total: 0, outstanding: 0 };
      prev.invoices += 1;
      prev.total += Number(r.total_bdt ?? 0);
      prev.outstanding += Math.max(Number(r.total_bdt ?? 0) - Number(r.paid_amount_bdt ?? 0), 0);
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  });

export const chequeRegister = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => reportRangeSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSalesOrStaff(supabase, userId);
    let q = supabase
      .from("cheques")
      .select(
        "id, cheque_no, bank, branch, cheque_date, deposited_on, cleared_on, amount_bdt, status, dealers(business_name, dealer_code)",
      )
      .order("cheque_date", { ascending: false });
    if (data.from) q = q.gte("cheque_date", data.from);
    if (data.to) q = q.lte("cheque_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

