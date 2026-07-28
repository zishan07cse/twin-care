import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listNotificationTemplates,
  upsertNotificationTemplate,
  deleteNotificationTemplate,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Tpl = {
  id: string;
  template_key: string;
  event_type: string;
  channel: string;
  language: string;
  subject: string | null;
  body: string;
  wati_template_name: string | null;
};

const EVENTS = [
  "sensor_change",
  "doctor_consult",
  "nutritionist_consult",
  "lab_test",
  "payment_due",
  "program_renewal",
  "device_return",
  "medicine_review",
  "custom",
];
const CHANNELS = ["in_app", "whatsapp", "email"];
const LANGS = ["en", "bn"];

export function NotificationTemplatesTab() {
  const qc = useQueryClient();
  const list = useServerFn(listNotificationTemplates);
  const del = useServerFn(deleteNotificationTemplate);
  const { data = [] } = useQuery<Tpl[]>({
    queryKey: ["notif-templates"],
    queryFn: () => list() as Promise<Tpl[]>,
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Template removed");
      qc.invalidateQueries({ queryKey: ["notif-templates"] });
    },
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tpl | null>(null);

  const grouped = data.reduce<Record<string, Tpl[]>>((acc, t) => {
    (acc[t.event_type] ||= []).push(t);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Templates</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </DialogTrigger>
          <TemplateEditor
            editing={editing}
            onClose={() => {
              setOpen(false);
              setEditing(null);
            }}
          />
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(grouped).map(([ev, tpls]) => (
          <div key={ev} className="space-y-2">
            <h4 className="font-medium capitalize">{ev.replace(/_/g, " ")}</h4>
            <div className="grid gap-2">
              {tpls.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 border rounded-md p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{t.channel}</Badge>
                      <Badge variant="secondary">{t.language.toUpperCase()}</Badge>
                      <span className="text-xs text-muted-foreground">{t.template_key}</span>
                    </div>
                    {t.subject && <div className="text-sm font-medium">{t.subject}</div>}
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {t.body}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(t);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete template ${t.template_key}?`))
                          delMut.mutate(t.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TemplateEditor({
  editing,
  onClose,
}: {
  editing: Tpl | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertNotificationTemplate);
  const [form, setForm] = useState({
    template_key: editing?.template_key ?? "",
    event_type: editing?.event_type ?? "custom",
    channel: editing?.channel ?? "in_app",
    language: editing?.language ?? "en",
    subject: editing?.subject ?? "",
    body: editing?.body ?? "",
    wati_template_name: editing?.wati_template_name ?? "",
  });
  const mut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: editing?.id,
          template_key: form.template_key,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          event_type: form.event_type as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          channel: form.channel as any,
          language: form.language,
          subject: form.subject || null,
          body: form.body,
          wati_template_name: form.wati_template_name || null,
        },
      }),
    onSuccess: () => {
      toast.success("Template saved");
      qc.invalidateQueries({ queryKey: ["notif-templates"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Template key</Label>
            <Input
              value={form.template_key}
              onChange={(e) => setForm({ ...form, template_key: e.target.value })}
              placeholder="e.g. custom_reminder_en"
            />
          </div>
          <div>
            <Label>Language</Label>
            <Select
              value={form.language}
              onValueChange={(v) => setForm({ ...form, language: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Event type</Label>
            <Select
              value={form.event_type}
              onValueChange={(v) => setForm({ ...form, event_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENTS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Channel</Label>
            <Select
              value={form.channel}
              onValueChange={(v) => setForm({ ...form, channel: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Subject (email only)</Label>
          <Input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea
            rows={6}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Hello {{patient_name}}, ..."
          />
          <p className="text-xs text-muted-foreground mt-1">
            Variables: <code>{"{{patient_name}}"}</code>, <code>{"{{date}}"}</code>,{" "}
            <code>{"{{time}}"}</code>, <code>{"{{amount}}"}</code>,{" "}
            <code>{"{{provider}}"}</code>, <code>{"{{items}}"}</code>, etc.
          </p>
        </div>
        <div>
          <Label>WATI approved template name (WhatsApp only)</Label>
          <Input
            value={form.wati_template_name}
            onChange={(e) => setForm({ ...form, wati_template_name: e.target.value })}
            placeholder="e.g. sensor_reminder_v1"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
