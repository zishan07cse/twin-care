// Public cron endpoint — daily dealer dunning:
// - Overdue invoice reminders (T-3, T-0, T+7, T+15, T+30)
// - Credit-limit breach alerts
// - Cheque follow-ups (deposited > 3 days, no clearing)
// Writes to notification_log so staff can see what fired.
import { createFileRoute } from "@tanstack/react-router";

const OFFSETS = [-3, 0, 7, 15, 30] as const;

export const Route = createFileRoute("/api/public/hooks/dealer-dunning")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = supabaseAdmin;

        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        let logged = 0;

        // 1) Invoices due/overdue at target offsets
        for (const offset of OFFSETS) {
          const target = new Date(now.getTime() - offset * 86400000).toISOString().slice(0, 10);
          const { data: invs } = await db
            .from("trade_invoices")
            .select("id,invoice_no,dealer_id,due_date,total_bdt,paid_amount_bdt,dealer:dealers(business_name,phone,email)")
            .eq("due_date", target)
            .in("status", ["unpaid", "partial", "overdue"]);
          for (const inv of invs ?? []) {
            const outstanding = Number(inv.total_bdt) - Number(inv.paid_amount_bdt);
            if (outstanding <= 0) continue;
            const label =
              offset < 0
                ? `Due in ${Math.abs(offset)} days`
                : offset === 0
                ? "Due today"
                : `Overdue by ${offset} days`;
            const already = await db
              .from("dealer_dunning_log")
              .select("id")
              .eq("ref_table", "trade_invoices")
              .eq("ref_id", inv.id)
              .eq("event_type", `dunning_${offset}`)
              .limit(1)
              .maybeSingle();
            if (already.data) continue;
            await db.from("dealer_dunning_log").insert({
              event_type: `dunning_${offset}`,
              
              dealer_id: inv.dealer_id,
              subject: `${label}: ${inv.invoice_no}`,
              body: `${inv.dealer?.business_name}: ${label}. Outstanding ৳${outstanding.toLocaleString()} on invoice ${inv.invoice_no}.`,
              ref_table: "trade_invoices",
              ref_id: inv.id,
              status: "queued",
            });
            logged++;
          }
        }

        // 2) Credit-limit breach — one alert per dealer per day
        const { data: openInvs } = await db
          .from("trade_invoices")
          .select("dealer_id,total_bdt,paid_amount_bdt,dealer:dealers(business_name,credit_limit_bdt)")
          .neq("status", "void")
          .neq("status", "paid");
        const byDealer = new Map<string, { name: string; limit: number; outstanding: number }>();
        for (const i of openInvs ?? []) {
          const bal = Number(i.total_bdt) - Number(i.paid_amount_bdt);
          if (bal <= 0) continue;
          const cur = byDealer.get(i.dealer_id) ?? {
            name: i.dealer?.business_name ?? "",
            limit: Number(i.dealer?.credit_limit_bdt ?? 0),
            outstanding: 0,
          };
          cur.outstanding += bal;
          byDealer.set(i.dealer_id, cur);
        }
        for (const [dealer_id, row] of byDealer.entries()) {
          if (row.limit <= 0 || row.outstanding <= row.limit) continue;
          const already = await db
            .from("dealer_dunning_log")
            .select("id")
            .eq("event_type", "credit_breach")
            .eq("ref_table", "dealers")
            .eq("ref_id", dealer_id)
            .gte("created_at", `${today}T00:00:00Z`)
            .limit(1)
            .maybeSingle();
          if (already.data) continue;
          await db.from("dealer_dunning_log").insert({
            event_type: "credit_breach",
            
            dealer_id: dealer_id,
            subject: `Credit limit breached: ${row.name}`,
            body: `${row.name}: outstanding ৳${row.outstanding.toLocaleString()} exceeds credit limit ৳${row.limit.toLocaleString()}.`,
            ref_table: "dealers",
            ref_id: dealer_id,
            status: "queued",
          });
          logged++;
        }

        // 3) Cheques deposited > 3 days without clearing
        const cutoff = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10);
        const { data: cheques } = await db
          .from("cheques")
          .select("id,cheque_no,dealer_id,amount_bdt,deposited_on,dealer:dealers(business_name)")
          .eq("status", "deposited")
          .lte("deposited_on", cutoff);
        for (const ch of cheques ?? []) {
          const already = await db
            .from("dealer_dunning_log")
            .select("id")
            .eq("event_type", "cheque_pending")
            .eq("ref_table", "cheques")
            .eq("ref_id", ch.id)
            .gte("created_at", `${today}T00:00:00Z`)
            .limit(1)
            .maybeSingle();
          if (already.data) continue;
          await db.from("dealer_dunning_log").insert({
            event_type: "cheque_pending",
            
            dealer_id: ch.dealer_id,
            subject: `Cheque clearing pending: ${ch.cheque_no}`,
            body: `${ch.dealer?.business_name}: cheque ${ch.cheque_no} of ৳${Number(ch.amount_bdt).toLocaleString()} deposited ${ch.deposited_on} still not cleared.`,
            ref_table: "cheques",
            ref_id: ch.id,
            status: "queued",
          });
          logged++;
        }

        return Response.json({ ok: true, logged, ran_at: today });
      },
    },
  },
});
