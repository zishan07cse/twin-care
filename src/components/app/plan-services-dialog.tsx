import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPlanServices,
  upsertPlanService,
  deletePlanService,
  PLAN_SERVICE_TYPES,
  PLAN_SERVICE_FREQUENCIES,
} from "@/lib/plan-services.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  doctor_visit: "Doctor visit",
  nutritionist_visit: "Nutritionist session",
  care_coordinator_checkin: "Care coordinator check-in",
  lab_test: "Lab test",
  group_session: "Group session",
  home_visit: "Home visit",
  teleconsult: "Teleconsult",
  custom: "Custom",
};

const FREQ_LABELS: Record<string, string> = {
  total: "total over program",
  per_month: "per month",
  per_quarter: "per quarter",
  unlimited: "unlimited",
};

export function PlanServicesDialog({
  planId,
  planName,
  open,
  onOpenChange,
}: {
  planId: string | null;
  planName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPlanServices);
  const upsertFn = useServerFn(upsertPlanService);
  const delFn = useServerFn(deletePlanService);

  const { data: rows = [] } = useQuery({
    queryKey: ["plan-services", planId],
    queryFn: () => listFn({ data: { plan_id: planId! } }),
    enabled: !!planId && open,
  });

  const [serviceType, setServiceType] =
    useState<(typeof PLAN_SERVICE_TYPES)[number]>("doctor_visit");
  const [label, setLabel] = useState("");
  const [labelBn, setLabelBn] = useState("");
  const [qty, setQty] = useState(1);
  const [freq, setFreq] =
    useState<(typeof PLAN_SERVICE_FREQUENCIES)[number]>("total");
  const [notes, setNotes] = useState("");

  const add = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          values: {
            plan_id: planId!,
            service_type: serviceType,
            label: label || TYPE_LABELS[serviceType],
            label_bn: labelBn || null,
            quantity: qty,
            frequency: freq,
            notes: notes || null,
            sort_order: 0,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Service added");
      qc.invalidateQueries({ queryKey: ["plan-services", planId] });
      setLabel("");
      setLabelBn("");
      setNotes("");
      setQty(1);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan-services", planId] }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Services · {planName}</DialogTitle>
          <DialogDescription>
            Configure which services (doctor visits, nutritionist sessions, lab tests, etc.) are
            included in this package.
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 px-3">Service</th>
                <th className="px-3">Qty</th>
                <th className="px-3">Frequency</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No services yet.
                  </td>
                </tr>
              )}
              {(rows as unknown[]).map((r) => {
                const row = r as {
                  id: string;
                  service_type: string;
                  label: string;
                  label_bn: string | null;
                  quantity: number;
                  frequency: string;
                  notes: string | null;
                };
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2 px-3">
                      <div className="font-medium">{row.label}</div>
                      <div className="flex gap-2 items-center mt-0.5">
                        <Badge variant="secondary" className="text-xs">
                          {TYPE_LABELS[row.service_type] ?? row.service_type}
                        </Badge>
                        {row.label_bn && (
                          <span className="text-xs text-muted-foreground">{row.label_bn}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 font-mono">
                      {row.frequency === "unlimited" ? "∞" : row.quantity}
                    </td>
                    <td className="px-3 text-muted-foreground">
                      {FREQ_LABELS[row.frequency] ?? row.frequency}
                    </td>
                    <td className="px-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove.mutate(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border rounded p-3 space-y-2">
          <div className="text-sm font-medium">Add service</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Service type</Label>
              <Select
                value={serviceType}
                onValueChange={(v) => {
                  setServiceType(v as (typeof PLAN_SERVICE_TYPES)[number]);
                  if (!label) setLabel(TYPE_LABELS[v] ?? "");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_SERVICE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Label (English)</Label>
              <Input
                value={label}
                placeholder={TYPE_LABELS[serviceType]}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Label (Bengali)</Label>
              <Input value={labelBn} onChange={(e) => setLabelBn(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={0}
                disabled={freq === "unlimited"}
                value={qty}
                onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value))))}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Frequency</Label>
              <Select
                value={freq}
                onValueChange={(v) =>
                  setFreq(v as (typeof PLAN_SERVICE_FREQUENCIES)[number])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_SERVICE_FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FREQ_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={add.isPending} onClick={() => add.mutate()}>
              <Plus className="h-4 w-4 mr-1" />
              Add service
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
