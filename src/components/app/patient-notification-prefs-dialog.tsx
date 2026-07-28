import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPatientNotificationPrefs,
  updatePatientNotificationPrefs,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell } from "lucide-react";
import { toast } from "sonner";

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

type Prefs = {
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  quiet_start_hour: number;
  quiet_end_hour: number;
  preferred_language: string;
  disabled_event_types: Ev[];
};

const EVENTS: Ev[] = [
  "sensor_change",
  "doctor_consult",
  "nutritionist_consult",
  "lab_test",
  "payment_due",
  "program_renewal",
  "device_return",
  "medicine_review",
];

export function PatientNotificationPrefsDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bell className="h-4 w-4 mr-1" /> Notification prefs
        </Button>
      </DialogTrigger>
      {open && <PrefsContent patientId={patientId} onClose={() => setOpen(false)} />}
    </Dialog>
  );
}

function PrefsContent({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getPatientNotificationPrefs);
  const upd = useServerFn(updatePatientNotificationPrefs);
  const { data } = useQuery<Prefs | null>({
    queryKey: ["patient-prefs", patientId],
    queryFn: () =>
      get({ data: { patient_id: patientId } }) as Promise<Prefs | null>,
  });
  const [form, setForm] = useState<Prefs | null>(null);
  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);
  const mut = useMutation({
    mutationFn: (patch: Prefs) =>
      upd({
        data: {
          patient_id: patientId,
          whatsapp_enabled: patch.whatsapp_enabled,
          email_enabled: patch.email_enabled,
          in_app_enabled: patch.in_app_enabled,
          quiet_start_hour: patch.quiet_start_hour,
          quiet_end_hour: patch.quiet_end_hour,
          preferred_language: (patch.preferred_language === "bn" ? "bn" : "en") as "en" | "bn",
          disabled_event_types: patch.disabled_event_types,
        },
      }),
    onSuccess: () => {
      toast.success("Preferences saved");
      qc.invalidateQueries({ queryKey: ["patient-prefs", patientId] });
      onClose();
    },
  });
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Notification preferences</DialogTitle>
      </DialogHeader>
      {!form ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>WhatsApp</Label>
              <Switch
                checked={form.whatsapp_enabled}
                onCheckedChange={(v) => setForm({ ...form, whatsapp_enabled: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Email</Label>
              <Switch
                checked={form.email_enabled}
                onCheckedChange={(v) => setForm({ ...form, email_enabled: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>In-app</Label>
              <Switch
                checked={form.in_app_enabled}
                onCheckedChange={(v) => setForm({ ...form, in_app_enabled: v })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Language</Label>
              <Select
                value={form.preferred_language}
                onValueChange={(v) => setForm({ ...form, preferred_language: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="bn">বাংলা</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Quiet start</Label>
                <Select
                  value={String(form.quiet_start_hour)}
                  onValueChange={(v) =>
                    setForm({ ...form, quiet_start_hour: Number(v) })
                  }
                >
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
              </div>
              <div>
                <Label>Quiet end</Label>
                <Select
                  value={String(form.quiet_end_hour)}
                  onValueChange={(v) =>
                    setForm({ ...form, quiet_end_hour: Number(v) })
                  }
                >
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
              </div>
            </div>
          </div>
          <div>
            <Label>Muted event types</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {EVENTS.map((e) => {
                const muted = form.disabled_event_types.includes(e);
                return (
                  <label key={e} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={muted}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...form.disabled_event_types, e]
                          : form.disabled_event_types.filter((x) => x !== e);
                        setForm({ ...form, disabled_event_types: next });
                      }}
                    />
                    <span>{e.replace(/_/g, " ")}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!form || mut.isPending}
          onClick={() => form && mut.mutate(form)}
        >
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
