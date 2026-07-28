// Dealer portal — read-only server fns scoped to the signed-in dealer via RLS.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDealerId(supabase: any): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_dealer_id");
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export const portalGetMyDealer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const dealerId = await getDealerId(context.supabase);
    if (!dealerId) return { dealer: null, summary: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const [dealer, inv, pay, cheq] = await Promise.all([
      sb.from("dealers").select("*").eq("id", dealerId).maybeSingle(),
      sb.from("trade_invoices").select("total_bdt,paid_amount_bdt,due_date,status").eq("dealer_id", dealerId),
      sb.from("dealer_payments").select("amount_bdt,payment_date").eq("dealer_id", dealerId),
      sb.from("cheques").select("id,status").eq("dealer_id", dealerId).in("status", ["received", "deposited"]),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const outstanding = (inv.data ?? []).reduce(
      (s: number, r: { total_bdt: number; paid_amount_bdt: number }) =>
        s + Math.max(Number(r.total_bdt) - Number(r.paid_amount_bdt), 0),
      0,
    );
    const overdue = (inv.data ?? [])
      .filter((r: { due_date: string; status: string }) => r.due_date && r.due_date < today && r.status !== "paid")
      .reduce(
        (s: number, r: { total_bdt: number; paid_amount_bdt: number }) =>
          s + Math.max(Number(r.total_bdt) - Number(r.paid_amount_bdt), 0),
        0,
      );
    const totalPaid = (pay.data ?? []).reduce((s: number, r: { amount_bdt: number }) => s + Number(r.amount_bdt), 0);
    return {
      dealer: dealer.data,
      summary: {
        outstanding: Math.round(outstanding * 100) / 100,
        overdue: Math.round(overdue * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        openInvoices: (inv.data ?? []).filter((r: { status: string }) => r.status !== "paid" && r.status !== "void").length,
        chequesPending: (cheq.data ?? []).length,
      },
    };
  });

export const portalListInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const dealerId = await getDealerId(context.supabase);
    if (!dealerId) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("trade_invoices")
      .select("id,invoice_no,invoice_date,due_date,total_bdt,paid_amount_bdt,status")
      .eq("dealer_id", dealerId)
      .order("invoice_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const portalListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const dealerId = await getDealerId(context.supabase);
    if (!dealerId) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("sales_orders")
      .select("id,order_no,order_date,total_bdt,status")
      .eq("dealer_id", dealerId)
      .order("order_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const portalListPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const dealerId = await getDealerId(context.supabase);
    if (!dealerId) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("dealer_payments")
      .select("id,payment_date,method,amount_bdt,reference,unallocated_bdt")
      .eq("dealer_id", dealerId)
      .order("payment_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const portalListDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const dealerId = await getDealerId(context.supabase);
    if (!dealerId) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("delivery_challans")
      .select("id,challan_no,challan_date,status,order_id")
      .eq("dealer_id", dealerId)
      .order("challan_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
