// Server functions for notifications, tasks, commissions, and CGM sensors.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (supabase: unknown) => supabase as any;

// ---------- NOTIFICATIONS ----------
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = anyDb(context.supabase);
    const { data, error } = await db
      .from("notifications")
      .select("id, title, body, event_type, channel, status, read_at, created_at, patient_id")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

export const unreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = anyDb(context.supabase);
    const { count, error } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (error) throw error;
    return count ?? 0;
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const { error } = await db
      .from("notifications")
      .update({ read_at: new Date().toISOString(), status: "read" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = anyDb(context.supabase);
    const { error } = await db
      .from("notifications")
      .update({ read_at: new Date().toISOString(), status: "read" })
      .is("read_at", null);
    if (error) throw error;
    return { ok: true };
  });

export const listNotificationRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = anyDb(context.supabase);
    const { data, error } = await db
      .from("notification_rules")
      .select("*")
      .order("event_type");
    if (error) throw error;
    return data ?? [];
  });

export const updateNotificationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    offsets_days?: number[];
    channels?: string[];
    is_active?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const { id, ...patch } = data;
    const { error } = await db.from("notification_rules").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- TASKS ("My Day") ----------
export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } = {}) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    let q = db
      .from("tasks")
      .select("id, title, description, due_at, status, priority, source, patient_id, assigned_to, created_at")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("priority", { ascending: false })
      .limit(200);
    if (data?.status) q = q.eq("status", data.status);
    else q = q.in("status", ["open", "in_progress"]);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    title: string;
    description?: string;
    patient_id?: string | null;
    due_at?: string | null;
    priority?: "low" | "normal" | "high" | "urgent";
  }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const { error } = await db.from("tasks").insert({
      ...data,
      created_by: context.userId,
      assigned_to: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: string; priority?: string; due_at?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const { id, status, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (status) {
      patch.status = status;
      if (status === "done") patch.completed_at = new Date().toISOString();
    }
    const { error } = await db.from("tasks").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

// Auto-generate tasks from overdue payments, missed appts, sensor expiries.
export const generateMyDayTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = anyDb(context.supabase);
    const today = new Date();
    const in5 = new Date(today.getTime() + 5 * 86400000).toISOString();
    let created = 0;

    // Overdue payment schedule rows
    const { data: overdue } = await db
      .from("payment_schedule")
      .select("id, patient_id, amount_bdt, due_date, status")
      .lte("due_date", today.toISOString().slice(0, 10))
      .in("status", ["pending", "partial"]);
    for (const p of overdue ?? []) {
      const { data: existing } = await db
        .from("tasks")
        .select("id")
        .eq("ref_table", "payment_schedule")
        .eq("ref_id", p.id)
        .maybeSingle();
      if (existing) continue;
      await db.from("tasks").insert({
        patient_id: p.patient_id,
        title: `Overdue payment ৳${p.amount_bdt}`,
        description: `Due ${p.due_date}`,
        priority: "high",
        source: "overdue_payment",
        ref_table: "payment_schedule",
        ref_id: p.id,
        assigned_to: context.userId,
        created_by: context.userId,
      });
      created++;
    }

    // Sensors expiring in next 5 days
    const { data: sensors } = await db
      .from("sensor_applications")
      .select("id, patient_id, expires_at")
      .gte("expires_at", today.toISOString())
      .lte("expires_at", in5)
      .is("removed_at", null);
    for (const s of sensors ?? []) {
      const { data: existing } = await db
        .from("tasks")
        .select("id")
        .eq("ref_table", "sensor_applications")
        .eq("ref_id", s.id)
        .maybeSingle();
      if (existing) continue;
      await db.from("tasks").insert({
        patient_id: s.patient_id,
        title: "CGM sensor expiring soon",
        description: `Replace by ${new Date(s.expires_at).toLocaleDateString()}`,
        priority: "high",
        source: "sensor_expiry",
        ref_table: "sensor_applications",
        ref_id: s.id,
        assigned_to: context.userId,
        created_by: context.userId,
      });
      created++;
    }

    // Missed appointments (past scheduled, still 'scheduled')
    const { data: missed } = await db
      .from("appointments")
      .select("id, patient_id, scheduled_at")
      .lt("scheduled_at", today.toISOString())
      .eq("status", "scheduled");
    for (const a of missed ?? []) {
      const { data: existing } = await db
        .from("tasks")
        .select("id")
        .eq("ref_table", "appointments")
        .eq("ref_id", a.id)
        .maybeSingle();
      if (existing) continue;
      await db.from("tasks").insert({
        patient_id: a.patient_id,
        title: "Missed appointment follow-up",
        description: `Was ${new Date(a.scheduled_at).toLocaleString()}`,
        priority: "normal",
        source: "missed_appointment",
        ref_table: "appointments",
        ref_id: a.id,
        assigned_to: context.userId,
        created_by: context.userId,
      });
      created++;
    }

    return { created };
  });

// ---------- COMMISSIONS ----------
export const listCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } = {}) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    let q = db
      .from("referral_commissions")
      .select(`
        id, referrer_kind, basis, amount_bdt, percent, status, accrued_at, approved_at, paid_at,
        patient:patients(id, patient_code, full_name_en),
        doctor:doctors(id, name),
        hospital:hospitals(id, name)
      `)
      .order("accrued_at", { ascending: false })
      .limit(500);
    if (data?.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const setCommissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "approved" | "paid" | "void" }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "approved") patch.approved_at = new Date().toISOString();
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await db.from("referral_commissions").update(patch).eq("id", data.id);
    if (error) throw error;
    if (data.status === "paid") {
      const { data: row } = await db
        .from("referral_commissions")
        .select("amount_bdt")
        .eq("id", data.id)
        .single();
      if (row) {
        await db.from("commission_payments").insert({
          commission_id: data.id,
          amount_bdt: row.amount_bdt,
          created_by: context.userId,
        });
      }
    }
    return { ok: true };
  });

// ---------- SENSORS ----------
export const listSensors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = anyDb(context.supabase);
    const { data, error } = await db
      .from("sensor_applications")
      .select(`
        id, applied_at, expires_at, batch_no, removed_at,
        patient:patients(id, patient_code, full_name_en)
      `)
      .order("expires_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const recordSensorApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patient_id: string; applied_at?: string; batch_no?: string }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const applied = data.applied_at ?? new Date().toISOString();
    const { error } = await db.from("sensor_applications").insert({
      patient_id: data.patient_id,
      applied_at: applied,
      batch_no: data.batch_no,
      created_by: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const removeSensor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const { error } = await db
      .from("sensor_applications")
      .update({ removed_at: new Date().toISOString(), removal_reason: data.reason })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
