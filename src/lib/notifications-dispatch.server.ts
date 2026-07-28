// Server-only dispatcher for WhatsApp (WATI) + Email (Resend) + in-app notifications.
// Do NOT import this from client code.
import { supabaseAdmin as _admin } from "@/integrations/supabase/client.server";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAdmin: any = _admin;

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export type NotifChannel = "in_app" | "whatsapp" | "email";
export type NotifEvent =
  | "sensor_change"
  | "doctor_consult"
  | "nutritionist_consult"
  | "lab_test"
  | "payment_due"
  | "program_renewal"
  | "device_return"
  | "medicine_review"
  | "custom";

export interface DispatchInput {
  patient_id: string | null;
  event_type: NotifEvent;
  channel: NotifChannel;
  variables?: Record<string, string | number | null | undefined>;
  ref_table?: string | null;
  ref_id?: string | null;
  language_override?: "en" | "bn";
  test_recipient?: { phone?: string; email?: string; name?: string };
}

interface Settings {
  wati_base_url: string | null;
  wati_api_token: string | null;
  wati_enabled: boolean;
  email_from_name: string;
  email_from_address: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  default_quiet_start_hour: number;
  default_quiet_end_hour: number;
  retry_max_attempts: number;
}

function render(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

function inQuietHours(now: Date, startH: number, endH: number): boolean {
  const h = now.getUTCHours() + 6; // Asia/Dhaka approx (UTC+6)
  const cur = h % 24;
  if (startH === endH) return false;
  if (startH < endH) return cur >= startH && cur < endH;
  return cur >= startH || cur < endH; // wraps midnight
}

export async function loadSettings(): Promise<Settings> {
  const { data } = await supabaseAdmin
    .from("notification_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return (
    (data as Settings) ?? {
      wati_base_url: null,
      wati_api_token: null,
      wati_enabled: false,
      email_from_name: "Twin Care",
      email_from_address: "onboarding@resend.dev",
      email_enabled: true,
      in_app_enabled: true,
      default_quiet_start_hour: 21,
      default_quiet_end_hour: 8,
      retry_max_attempts: 3,
    }
  );
}

async function loadTemplate(
  event: NotifEvent,
  channel: NotifChannel,
  lang: string,
) {
  const { data } = await supabaseAdmin
    .from("notification_templates")
    .select("*")
    .eq("event_type", event)
    .eq("channel", channel)
    .eq("language", lang)
    .maybeSingle();
  if (data) return data;
  const { data: fallback } = await supabaseAdmin
    .from("notification_templates")
    .select("*")
    .eq("event_type", event)
    .eq("channel", channel)
    .eq("language", "en")
    .maybeSingle();
  return fallback;
}

async function sendWati(
  settings: Settings,
  toPhone: string,
  body: string,
): Promise<{ ok: boolean; provider_ref?: string; error?: string }> {
  if (!settings.wati_enabled || !settings.wati_base_url || !settings.wati_api_token) {
    return { ok: false, error: "WATI not configured" };
  }
  const base = settings.wati_base_url.replace(/\/+$/, "");
  const url = `${base}/api/v1/sendSessionMessage/${encodeURIComponent(toPhone)}`;
  try {
    const res = await fetch(`${url}?messageText=${encodeURIComponent(body)}`, {
      method: "POST",
      headers: {
        Authorization: settings.wati_api_token.startsWith("Bearer ")
          ? settings.wati_api_token
          : `Bearer ${settings.wati_api_token}`,
      },
    });
    const txt = await res.text();
    if (!res.ok) return { ok: false, error: `WATI ${res.status}: ${txt}` };
    return { ok: true, provider_ref: txt.slice(0, 200) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function sendResend(
  settings: Settings,
  toEmail: string,
  subject: string,
  htmlBody: string,
): Promise<{ ok: boolean; provider_ref?: string; error?: string }> {
  if (!settings.email_enabled) return { ok: false, error: "Email disabled" };
  const key = process.env.LOVABLE_API_KEY;
  const rk = process.env.RESEND_API_KEY;
  if (!key || !rk) return { ok: false, error: "Resend not configured" };
  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "X-Connection-Api-Key": rk,
      },
      body: JSON.stringify({
        from: `${settings.email_from_name} <${settings.email_from_address}>`,
        to: [toEmail],
        subject,
        html: htmlBody,
      }),
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${body}` };
    try {
      const j = JSON.parse(body) as { id?: string };
      return { ok: true, provider_ref: j.id };
    } catch {
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function dispatchOne(input: DispatchInput, actorUserId?: string) {
  const settings = await loadSettings();

  // Resolve patient + preferences
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let patient: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prefs: any = null;

  if (input.patient_id) {
    const { data: p } = await supabaseAdmin
      .from("patients")
      .select("id, full_name, full_name_bn, phone, email, user_id")
      .eq("id", input.patient_id)
      .maybeSingle();
    patient = p ?? null;
    const { data: pr } = await supabaseAdmin
      .from("notification_preferences")
      .select("*")
      .eq("patient_id", input.patient_id)
      .maybeSingle();
    prefs = pr ?? null;
  }

  const lang =
    input.language_override ??
    (prefs?.preferred_language as "en" | "bn" | undefined) ??
    "en";

  if (prefs?.disabled_event_types?.includes(input.event_type)) {
    await logAttempt(input, "skipped", "Event disabled in prefs");
    return { status: "skipped", reason: "prefs" };
  }

  const qStart = prefs?.quiet_start_hour ?? settings.default_quiet_start_hour;
  const qEnd = prefs?.quiet_end_hour ?? settings.default_quiet_end_hour;
  if (input.channel !== "in_app" && inQuietHours(new Date(), qStart, qEnd)) {
    // Skip external channels during quiet hours (in-app still allowed)
    await logAttempt(input, "skipped", "Quiet hours");
    return { status: "skipped", reason: "quiet_hours" };
  }

  if (input.channel === "whatsapp" && prefs && !prefs.whatsapp_enabled) {
    await logAttempt(input, "skipped", "WhatsApp disabled in prefs");
    return { status: "skipped", reason: "prefs_whatsapp" };
  }
  if (input.channel === "email" && prefs && !prefs.email_enabled) {
    await logAttempt(input, "skipped", "Email disabled in prefs");
    return { status: "skipped", reason: "prefs_email" };
  }
  if (input.channel === "in_app" && prefs && !prefs.in_app_enabled) {
    await logAttempt(input, "skipped", "In-app disabled in prefs");
    return { status: "skipped", reason: "prefs_in_app" };
  }

  const tpl = await loadTemplate(input.event_type, input.channel, lang);
  if (!tpl) {
    await logAttempt(input, "failed", `No template for ${input.event_type}/${input.channel}/${lang}`);
    return { status: "failed", error: "no_template" };
  }

  const patientName =
    lang === "bn" && patient?.full_name_bn
      ? patient.full_name_bn
      : patient?.full_name ?? input.test_recipient?.name ?? "Patient";
  const vars = {
    patient_name: patientName,
    ...input.variables,
  } as Record<string, unknown>;

  const bodyRendered = render(tpl.body, vars);
  const subjectRendered = tpl.subject ? render(tpl.subject, vars) : null;

  // Always insert an in-app notification row for staff visibility (except test)
  const notifRow = input.patient_id
    ? await supabaseAdmin
        .from("notifications")
        .insert({
          patient_id: input.patient_id,
          event_type: input.event_type,
          channel: input.channel,
          title: subjectRendered ?? bodyRendered.slice(0, 80),
          body: bodyRendered,
          status: "pending",
          ref_table: input.ref_table ?? null,
          ref_id: input.ref_id ?? null,
          user_id: patient?.user_id ?? null,
        })
        .select("id")
        .single()
    : { data: null as { id: string } | null, error: null };

  const notificationId = (notifRow as { data: { id: string } | null }).data?.id ?? null;

  // Dispatch by channel
  let result: { ok: boolean; provider_ref?: string; error?: string } = { ok: true };
  if (input.channel === "whatsapp") {
    const toPhone = input.test_recipient?.phone ?? patient?.phone ?? "";
    if (!toPhone) result = { ok: false, error: "No phone number" };
    else result = await sendWati(settings, toPhone.replace(/[^\d]/g, ""), bodyRendered);
  } else if (input.channel === "email") {
    const toEmail = input.test_recipient?.email ?? patient?.email ?? "";
    if (!toEmail) result = { ok: false, error: "No email address" };
    else {
      const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${bodyRendered.replace(/\n/g, "<br/>")}</div>`;
      result = await sendResend(settings, toEmail, subjectRendered ?? "Twin Care", html);
    }
  } else {
    // in_app: already inserted
    result = { ok: true };
  }

  const finalStatus: "sent" | "failed" = result.ok ? "sent" : "failed";

  if (notificationId) {
    await supabaseAdmin
      .from("notifications")
      .update({
        status: finalStatus,
        sent_at: result.ok ? new Date().toISOString() : null,
        error: result.error ?? null,
      })
      .eq("id", notificationId);
  }

  await supabaseAdmin.from("notification_log").insert({
    notification_id: notificationId,
    patient_id: input.patient_id,
    event_type: input.event_type,
    channel: input.channel,
    template_key: tpl.template_key,
    status: finalStatus,
    error: result.error ?? null,
    payload: { subject: subjectRendered, body: bodyRendered, provider_ref: result.provider_ref },
  });

  if (input.channel !== "in_app" && input.patient_id) {
    await supabaseAdmin.from("message_log").insert({
      patient_id: input.patient_id,
      channel: input.channel === "whatsapp" ? "whatsapp" : "email",
      direction: "outbound",
      status: result.ok ? "sent" : "failed",
      template_name: tpl.template_key,
      body: bodyRendered,
      provider_ref: result.provider_ref ?? null,
      error: result.error ?? null,
      sent_by: actorUserId ?? null,
      variables: (input.variables ?? {}) as Record<string, unknown>,
    });
  }

  return { status: finalStatus, error: result.error, notificationId };
}

async function logAttempt(input: DispatchInput, status: "skipped" | "failed", err?: string) {
  await supabaseAdmin.from("notification_log").insert({
    notification_id: null,
    patient_id: input.patient_id,
    event_type: input.event_type,
    channel: input.channel,
    template_key: null,
    status,
    error: err ?? null,
    payload: (input.variables ?? {}) as Record<string, unknown>,
  });
}
