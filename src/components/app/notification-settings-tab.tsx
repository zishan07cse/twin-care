import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Settings = {
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
};

export function NotificationSettingsTab() {
  const qc = useQueryClient();
  const get = useServerFn(getNotificationSettings);
  const upd = useServerFn(updateNotificationSettings);
  const test = useServerFn(sendTestNotification);
  const { data } = useQuery<Settings | null>({
    queryKey: ["notif-settings"],
    queryFn: () => get() as Promise<Settings | null>,
  });
  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const mut = useMutation({
    mutationFn: (patch: Partial<Settings>) => upd({ data: patch }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["notif-settings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [testForm, setTestForm] = useState({
    channel: "whatsapp" as "whatsapp" | "email",
    to_phone: "",
    to_email: "",
    body: "Hello — this is a test message from Twin Care.",
  });
  const testMut = useMutation({
    mutationFn: () =>
      test({
        data: {
          channel: testForm.channel,
          event_type: "custom",
          to_phone: testForm.to_phone || undefined,
          to_email: testForm.to_email || undefined,
          body: testForm.body,
        },
      }),
    onSuccess: (r: { status: string; error?: string | null }) => {
      if (r.status === "sent") toast.success("Test sent");
      else toast.error(r.error ?? `Status: ${r.status}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!form) return <div className="text-sm text-muted-foreground">Loading settings…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp (WATI)</CardTitle>
          <CardDescription>
            Enter the WATI tenant API base URL and access token from your WATI dashboard. Both
            fields are required to enable WhatsApp delivery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Base URL</Label>
            <Input
              value={form.wati_base_url ?? ""}
              placeholder="https://live-mt-server.wati.io/{tenantId}"
              onChange={(e) => setForm({ ...form, wati_base_url: e.target.value })}
            />
          </div>
          <div>
            <Label>Access token</Label>
            <Input
              type="password"
              value={form.wati_api_token ?? ""}
              placeholder="Bearer eyJhbGciOi..."
              onChange={(e) => setForm({ ...form, wati_api_token: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>WhatsApp delivery enabled</Label>
            <Switch
              checked={form.wati_enabled}
              onCheckedChange={(v) => setForm({ ...form, wati_enabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email (Resend)</CardTitle>
          <CardDescription>
            Configured through the Resend connector. Sending from{" "}
            <code>onboarding@resend.dev</code> only reaches the Resend account owner — verify a
            domain in Resend to send to patients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sender name</Label>
              <Input
                value={form.email_from_name}
                onChange={(e) => setForm({ ...form, email_from_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Sender address</Label>
              <Input
                value={form.email_from_address}
                onChange={(e) => setForm({ ...form, email_from_address: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Email delivery enabled</Label>
            <Switch
              checked={form.email_enabled}
              onCheckedChange={(v) => setForm({ ...form, email_enabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quiet hours & retries</CardTitle>
          <CardDescription>
            External channels (WhatsApp, email) are skipped during quiet hours. In-app remains
            available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Quiet start (hour)</Label>
              <HourPicker
                value={form.default_quiet_start_hour}
                onChange={(v) => setForm({ ...form, default_quiet_start_hour: v })}
              />
            </div>
            <div>
              <Label>Quiet end (hour)</Label>
              <HourPicker
                value={form.default_quiet_end_hour}
                onChange={(v) => setForm({ ...form, default_quiet_end_hour: v })}
              />
            </div>
            <div>
              <Label>Retry attempts</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={form.retry_max_attempts}
                onChange={(e) =>
                  setForm({ ...form, retry_max_attempts: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>In-app inbox enabled</Label>
            <Switch
              checked={form.in_app_enabled}
              onCheckedChange={(v) => setForm({ ...form, in_app_enabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
          Save settings
        </Button>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Send test message</CardTitle>
          <CardDescription>Sends a one-off message using the current settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Channel</Label>
              <Select
                value={testForm.channel}
                onValueChange={(v: "whatsapp" | "email") =>
                  setTestForm({ ...testForm, channel: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {testForm.channel === "whatsapp" ? (
              <div className="col-span-2">
                <Label>Phone (with country code, no +)</Label>
                <Input
                  placeholder="8801XXXXXXXXX"
                  value={testForm.to_phone}
                  onChange={(e) => setTestForm({ ...testForm, to_phone: e.target.value })}
                />
              </div>
            ) : (
              <div className="col-span-2">
                <Label>Email address</Label>
                <Input
                  type="email"
                  value={testForm.to_email}
                  onChange={(e) => setTestForm({ ...testForm, to_email: e.target.value })}
                />
              </div>
            )}
          </div>
          <div>
            <Label>Message body</Label>
            <Input
              value={testForm.body}
              onChange={(e) => setTestForm({ ...testForm, body: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Uses the <code>custom</code> template for the selected channel — edit it in the
              Templates tab to change the body sent here.
            </p>
          </div>
          <Button onClick={() => testMut.mutate()} disabled={testMut.isPending}>
            Send test
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function HourPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 24 }, (_, i) => (
          <SelectItem key={i} value={String(i)}>
            {i.toString().padStart(2, "0")}:00
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
