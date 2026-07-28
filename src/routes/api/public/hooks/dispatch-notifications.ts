// Public cron endpoint — iterates reminder rules and dispatches due notifications.
// Called by pg_cron (see notification_rules) with the Supabase anon key in the `apikey` header.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/dispatch-notifications")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { dispatchOne } = await import("@/lib/notifications-dispatch.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = supabaseAdmin;

        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        let dispatched = 0;

        const { data: rules } = await db
          .from("notification_rules")
          .select("*")
          .eq("is_active", true);

        for (const rule of rules ?? []) {
          const offsets: number[] = rule.offsets_days ?? [];
          for (const offset of offsets) {
            const target = new Date(now.getTime() + offset * 86400000)
              .toISOString()
              .slice(0, 10);

            if (rule.event_type === "payment_due") {
              const { data: due } = await db
                .from("payment_schedule")
                .select("id, patient_id, amount_bdt, due_date")
                .eq("due_date", target)
                .in("status", ["pending", "partial"]);
              for (const row of due ?? []) {
                for (const ch of rule.channels ?? []) {
                  const already = await alreadySent(db, row.patient_id, "payment_due", ch, row.id);
                  if (already) continue;
                  await dispatchOne({
                    patient_id: row.patient_id,
                    event_type: "payment_due",
                    channel: ch,
                    variables: { amount: row.amount_bdt, date: row.due_date },
                    ref_table: "payment_schedule",
                    ref_id: row.id,
                  });
                  dispatched++;
                }
              }
            } else if (rule.event_type === "sensor_change") {
              const { data: sensors } = await db
                .from("sensor_applications")
                .select("id, patient_id, expires_at")
                .gte("expires_at", `${target}T00:00:00Z`)
                .lte("expires_at", `${target}T23:59:59Z`)
                .is("removed_at", null);
              for (const row of sensors ?? []) {
                for (const ch of rule.channels ?? []) {
                  const already = await alreadySent(db, row.patient_id, "sensor_change", ch, row.id);
                  if (already) continue;
                  await dispatchOne({
                    patient_id: row.patient_id,
                    event_type: "sensor_change",
                    channel: ch,
                    variables: { date: (row.expires_at as string).slice(0, 10) },
                    ref_table: "sensor_applications",
                    ref_id: row.id,
                  });
                  dispatched++;
                }
              }
            } else if (
              rule.event_type === "doctor_consult" ||
              rule.event_type === "nutritionist_consult"
            ) {
              const kind = rule.event_type === "doctor_consult" ? "doctor" : "nutritionist";
              const { data: appts } = await db
                .from("appointments")
                .select("id, patient_id, scheduled_at, provider_kind")
                .gte("scheduled_at", `${target}T00:00:00Z`)
                .lte("scheduled_at", `${target}T23:59:59Z`)
                .eq("provider_kind", kind)
                .eq("status", "scheduled");
              for (const row of appts ?? []) {
                const dt = new Date(row.scheduled_at);
                for (const ch of rule.channels ?? []) {
                  const already = await alreadySent(db, row.patient_id, rule.event_type, ch, row.id);
                  if (already) continue;
                  await dispatchOne({
                    patient_id: row.patient_id,
                    event_type: rule.event_type,
                    channel: ch,
                    variables: {
                      date: dt.toISOString().slice(0, 10),
                      time: dt.toISOString().slice(11, 16),
                      provider: kind,
                    },
                    ref_table: "appointments",
                    ref_id: row.id,
                  });
                  dispatched++;
                }
              }
            } else if (rule.event_type === "program_renewal") {
              const { data: enrolls } = await db
                .from("patient_enrollments")
                .select("id, patient_id, end_date, plan:program_plans(name)")
                .eq("end_date", target)
                .eq("status", "active");
              for (const row of enrolls ?? []) {
                for (const ch of rule.channels ?? []) {
                  const already = await alreadySent(db, row.patient_id, "program_renewal", ch, row.id);
                  if (already) continue;
                  await dispatchOne({
                    patient_id: row.patient_id,
                    event_type: "program_renewal",
                    channel: ch,
                    variables: {
                      date: row.end_date,
                      days: Math.abs(offset),
                      plan: row.plan?.name ?? "",
                    },
                    ref_table: "patient_enrollments",
                    ref_id: row.id,
                  });
                  dispatched++;
                }
              }
            } else if (rule.event_type === "device_return") {
              const { data: enrolls } = await db
                .from("patient_enrollments")
                .select("id, patient_id, end_date")
                .eq("end_date", target)
                .eq("status", "active");
              for (const row of enrolls ?? []) {
                for (const ch of rule.channels ?? []) {
                  const already = await alreadySent(db, row.patient_id, "device_return", ch, row.id);
                  if (already) continue;
                  await dispatchOne({
                    patient_id: row.patient_id,
                    event_type: "device_return",
                    channel: ch,
                    variables: { date: row.end_date },
                    ref_table: "patient_enrollments",
                    ref_id: row.id,
                  });
                  dispatched++;
                }
              }
            }
          }
        }

        return Response.json({ ok: true, dispatched, ran_at: today });
      },
    },
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function alreadySent(db: any, patient_id: string, event_type: string, channel: string, ref_id: string) {
  const { data } = await db
    .from("notifications")
    .select("id")
    .eq("patient_id", patient_id)
    .eq("event_type", event_type)
    .eq("channel", channel)
    .eq("ref_id", ref_id)
    .in("status", ["sent", "pending"])
    .limit(1)
    .maybeSingle();
  return !!data;
}
