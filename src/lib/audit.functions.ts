// Server functions for audit log browsing + backup snapshots to Storage.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (s: unknown) => s as any;

const BACKUP_BUCKET = "db-backups";

// Tables included in JSON snapshots. Keep in dependency-safe order for readability.
export const BACKUP_TABLES = [
  "profiles",
  "user_roles",
  "access_requests",
  "doctors",
  "hospitals",
  "nutritionists",
  "medicines",
  "lab_tests",
  "inventory_items",
  "program_plans",
  "leads",
  "lead_notes",
  "patients",
  "patient_enrollments",
  "patient_timeline",
  "patient_outcomes",
  "appointments",
  "prescriptions",
  "prescription_items",
  "diet_plans",
  "medication_reductions",
  "vitals",
  "lab_results",
  "inventory_assignments",
  "sensor_applications",
  "payment_schedule",
  "payments",
  "referral_commissions",
  "commission_payments",
  "tasks",
  "notifications",
  "notification_rules",
  "notification_preferences",
  "notification_templates",
  "notification_log",
  "whatsapp_templates",
  "message_log",
  "announcements",
  "audit_log",
] as const;

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const db = anyDb(context.supabase);
  const { data, error } = await db.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw error;
  const { data: sa } = await db.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (!data && !sa) throw new Error("Forbidden");
}

// ---------- AUDIT LOG ----------
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    table_name?: string;
    action?: string;
    actor?: string;
    from?: string;
    to?: string;
    limit?: number;
  } = {}) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = anyDb(context.supabase);
    let q = db
      .from("audit_log")
      .select("id, table_name, record_id, action, actor, before, after, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (data.table_name) q = q.eq("table_name", data.table_name);
    if (data.action) q = q.eq("action", data.action);
    if (data.actor) q = q.eq("actor", data.actor);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const listAuditTables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = anyDb(context.supabase);
    const { data, error } = await db
      .from("audit_log")
      .select("table_name")
      .limit(2000);
    if (error) throw error;
    const set = new Set<string>();
    for (const r of data ?? []) set.add((r as { table_name: string }).table_name);
    return Array.from(set).sort();
  });

// ---------- BACKUPS ----------
type SnapshotMeta = { name: string; size: number; created_at: string };

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SnapshotMeta[]> => {
    await assertAdmin(context);
    const db = anyDb(context.supabase);
    const { data, error } = await db.storage
      .from(BACKUP_BUCKET)
      .list("snapshots", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw error;
    return (data ?? []).map((f: { name: string; created_at: string; metadata?: { size?: number } }) => ({
      name: f.name,
      size: f.metadata?.size ?? 0,
      created_at: f.created_at,
    }));
  });

export const getBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = anyDb(context.supabase);
    const { data: signed, error } = await db.storage
      .from(BACKUP_BUCKET)
      .createSignedUrl(`snapshots/${data.name}`, 300);
    if (error) throw error;
    return { url: signed.signedUrl as string };
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = anyDb(context.supabase);
    const { error } = await db.storage.from(BACKUP_BUCKET).remove([`snapshots/${data.name}`]);
    if (error) throw error;
    return { ok: true };
  });

// Build a full JSON snapshot of all tables and upload to the bucket.
export const createBackupSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    return runSnapshot(context.userId);
  });

// Shared snapshot routine, also used by the cron route.
export async function runSnapshot(actor: string | null): Promise<{ name: string; size: number; tables: number; rows: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = anyDb(supabaseAdmin);
  const snapshot: Record<string, unknown> = {
    meta: {
      created_at: new Date().toISOString(),
      actor,
      version: 1,
      tables: BACKUP_TABLES,
    },
    data: {},
  };
  let totalRows = 0;
  for (const table of BACKUP_TABLES) {
    const { data, error } = await db.from(table).select("*");
    if (error) throw new Error(`Snapshot failed at ${table}: ${error.message}`);
    (snapshot.data as Record<string, unknown>)[table] = data ?? [];
    totalRows += data?.length ?? 0;
  }
  const body = JSON.stringify(snapshot);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `${ts}.json`;
  const { error: upErr } = await db.storage
    .from(BACKUP_BUCKET)
    .upload(`snapshots/${name}`, body, {
      contentType: "application/json",
      upsert: false,
    });
  if (upErr) throw upErr;
  return { name, size: body.length, tables: BACKUP_TABLES.length, rows: totalRows };
}
