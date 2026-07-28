import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = (s: unknown) => s as any;

type Ev =
  | "sensor_change"
  | "doctor_consult"
  | "nutritionist_consult"
  | "lab_test"
  | "payment_due"
  | "program_renewal"
  | "device_return"
  | "medicine_review"
  | "custom";
type Ch = "in_app" | "whatsapp" | "email";

// ---------- Settings ----------
export const getNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = anyDb(context.supabase);
    const { data, error } = await db
      .from("notification_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const updateNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    wati_base_url?: string | null;
    wati_api_token?: string | null;
    wati_enabled?: boolean;
    email_from_name?: string;
    email_from_address?: string;
    email_enabled?: boolean;
    in_app_enabled?: boolean;
    default_quiet_start_hour?: number;
    default_quiet_end_hour?: number;
    retry_max_attempts?: number;
  }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const { error } = await db
      .from("notification_settings")
      .update({ ...data, updated_by: context.userId })
      .eq("id", 1);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Templates ----------
export const listNotificationTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = anyDb(context.supabase);
    const { data, error } = await db
      .from("notification_templates")
      .select("*")
      .order("event_type")
      .order("channel")
      .order("language");
    if (error) throw error;
    return data ?? [];
  });

export const upsertNotificationTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    template_key: string;
    event_type: Ev;
    channel: Ch;
    language: string;
    subject?: string | null;
    body: string;
    wati_template_name?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    if (data.id) {
      const { id, ...patch } = data;
      const { error } = await db.from("notification_templates").update(patch).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await db.from("notification_templates").insert(data);
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteNotificationTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const { error } = await db.from("notification_templates").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Patient preferences ----------
export const getPatientNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patient_id: string }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const { data: row, error } = await db
      .from("notification_preferences")
      .select("*")
      .eq("patient_id", data.patient_id)
      .maybeSingle();
    if (error) throw error;
    if (row) return row;
    const { data: created, error: e2 } = await db
      .from("notification_preferences")
      .insert({ patient_id: data.patient_id })
      .select("*")
      .single();
    if (e2) throw e2;
    return created;
  });

export const updatePatientNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    patient_id: string;
    whatsapp_enabled?: boolean;
    email_enabled?: boolean;
    in_app_enabled?: boolean;
    quiet_start_hour?: number;
    quiet_end_hour?: number;
    preferred_language?: "en" | "bn";
    disabled_event_types?: Ev[];
  }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const { patient_id, ...patch } = data;
    const { error } = await db
      .from("notification_preferences")
      .update(patch)
      .eq("patient_id", patient_id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Log ----------
export const listNotificationLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; status?: string } = {}) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    let q = db
      .from("notification_log")
      .select(
        `id, sent_at, channel, event_type, template_key, status, error, attempt,
         patient:patients(id, patient_code, full_name_en)`,
      )
      .order("sent_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

// ---------- Send (test or ad-hoc) ----------
export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    channel: Ch;
    event_type?: Ev;
    to_phone?: string;
    to_email?: string;
    body?: string;
    subject?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    // Admin-only
    const db = anyDb(context.supabase);
    const { data: isAdmin } = await db.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isSuper } = await db.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin && !isSuper) throw new Error("Forbidden");

    const { dispatchOne } = await import("./notifications-dispatch.server");
    return dispatchOne(
      {
        patient_id: null,
        event_type: data.event_type ?? "custom",
        channel: data.channel,
        variables: { patient_name: "Test User" },
        test_recipient: { phone: data.to_phone, email: data.to_email, name: "Test User" },
      },
      context.userId,
    );
  });

export const sendNotificationToPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    patient_id: string;
    event_type: Ev;
    channel: Ch;
    variables?: Record<string, string | number>;
    ref_table?: string | null;
    ref_id?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { dispatchOne } = await import("./notifications-dispatch.server");
    return dispatchOne(
      {
        patient_id: data.patient_id,
        event_type: data.event_type,
        channel: data.channel,
        variables: data.variables,
        ref_table: data.ref_table,
        ref_id: data.ref_id,
      },
      context.userId,
    );
  });

export const retryFailedNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { log_id: string }) => d)
  .handler(async ({ data, context }) => {
    const db = anyDb(context.supabase);
    const { data: log } = await db
      .from("notification_log")
      .select("*")
      .eq("id", data.log_id)
      .maybeSingle();
    if (!log) throw new Error("Log not found");
    const { dispatchOne } = await import("./notifications-dispatch.server");
    return dispatchOne(
      {
        patient_id: log.patient_id,
        event_type: log.event_type,
        channel: log.channel,
        variables: (log.payload ?? {}) as Record<string, string>,
      },
      context.userId,
    );
  });
