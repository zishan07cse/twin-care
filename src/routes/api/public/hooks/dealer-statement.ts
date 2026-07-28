// Public cron endpoint — monthly dealer statement.
// For each active dealer, snapshots current outstanding and queues a
// statement notification in dealer_dunning_log for staff review / send.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/dealer-statement")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = supabaseAdmin;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          .toISOString()
          .slice(0, 10);
        const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
          .toISOString()
          .slice(0, 10);

        const { data: dealers } = await db
          .from("dealers")
          .select("id, business_name, credit_limit_bdt, email, phone")
          .eq("status", "active");

        let logged = 0;
        for (const d of dealers ?? []) {
          const [invRes, payRes] = await Promise.all([
            db
              .from("trade_invoices")
              .select("total_bdt, paid_amount_bdt, invoice_date")
              .eq("dealer_id", d.id),
            db
              .from("dealer_payments")
              .select("amount_bdt, payment_date")
              .eq("dealer_id", d.id)
              .gte("payment_date", monthStart)
              .lte("payment_date", monthEnd),
          ]);

          const outstanding = (invRes.data ?? []).reduce(
            (s: number, r: { total_bdt: number; paid_amount_bdt: number }) =>
              s + Math.max(Number(r.total_bdt) - Number(r.paid_amount_bdt), 0),
            0,
          );
          const monthSales = (invRes.data ?? [])
            .filter((r: { invoice_date: string }) => r.invoice_date >= monthStart && r.invoice_date <= monthEnd)
            .reduce((s: number, r: { total_bdt: number }) => s + Number(r.total_bdt), 0);
          const monthPaid = (payRes.data ?? []).reduce(
            (s: number, r: { amount_bdt: number }) => s + Number(r.amount_bdt),
            0,
          );

          if (outstanding <= 0 && monthSales <= 0 && monthPaid <= 0) continue;

          await db.from("dealer_dunning_log").insert({
            event_type: "monthly_statement",
            dealer_id: d.id,
            subject: `Monthly statement ${monthStart} to ${monthEnd}: ${d.business_name}`,
            body:
              `Statement for ${d.business_name} (${monthStart} to ${monthEnd}).\n` +
              `Sales this period: ৳${monthSales.toLocaleString()}\n` +
              `Payments received: ৳${monthPaid.toLocaleString()}\n` +
              `Current outstanding: ৳${outstanding.toLocaleString()}\n` +
              `Credit limit: ৳${Number(d.credit_limit_bdt ?? 0).toLocaleString()}`,
            ref_table: "dealers",
            ref_id: d.id,
            status: "queued",
          });
          logged++;
        }

        return Response.json({ ok: true, logged, period: { from: monthStart, to: monthEnd } });
      },
    },
  },
});
