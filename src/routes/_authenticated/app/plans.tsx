import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listPlans,
  upsertPlan,
  deletePlan,
  type PlanValues,
} from "@/lib/billing.functions";
import { MasterDataList } from "@/components/app/master-data-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Package, Stethoscope } from "lucide-react";
import { PackageDevicesDialog } from "@/components/app/package-devices-dialog";
import { PlanServicesDialog } from "@/components/app/plan-services-dialog";

export const Route = createFileRoute("/_authenticated/app/plans")({
  component: PlansPage,
});

type PlanRow = PlanValues & { id: string };

const empty: PlanValues = {
  name: "",
  name_bn: "",
  description: "",
  duration_months: 12,
  total_price_bdt: 0,
  billing_frequency: "monthly",
  installment_count: null,
  is_active: true,
};

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function PlansPage() {
  const { hasAnyRole } = useAuth();
  const canView = hasAnyRole([
    "super_admin",
    "admin",
    "care_coordinator",
    "finance",
  ]);
  const canEdit = hasAnyRole(["super_admin", "admin", "care_coordinator"]);
  const canDelete = hasAnyRole(["super_admin", "admin"]);

  const list = useServerFn(listPlans);
  const upsert = useServerFn(upsertPlan);
  const del = useServerFn(deletePlan);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => list(),
    enabled: canView,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [form, setForm] = useState<PlanValues>(empty);
  const [devicesFor, setDevicesFor] = useState<PlanRow | null>(null);
  const [servicesFor, setServicesFor] = useState<PlanRow | null>(null);

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, values: form } }),
    onSuccess: () => {
      toast.success(editing ? "Plan updated" : "Plan added");
      qc.invalidateQueries({ queryKey: ["plans"] });
      setOpen(false);
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e) => toast.error("Delete failed", { description: (e as Error).message }),
  });

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(row: PlanRow) {
    setEditing(row);
    setForm({
      name: row.name,
      name_bn: row.name_bn ?? "",
      description: row.description ?? "",
      duration_months: row.duration_months,
      total_price_bdt: Number(row.total_price_bdt),
      billing_frequency: row.billing_frequency,
      installment_count: row.installment_count,
      is_active: row.is_active,
    });
    setOpen(true);
  }

  if (!canView) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">
          You do not have access to this page.
        </div>
      </div>
    );
  }

  return (
    <>
      <MasterDataList<PlanRow>
        title="Program plans"
        description="Configurable program templates used for patient enrollment."
        items={items as PlanRow[]}
        isLoading={isLoading}
        columns={[
          {
            header: "Name",
            cell: (r) => (
              <div>
                <div className="font-medium">{r.name}</div>
                {r.name_bn && (
                  <div className="text-xs text-muted-foreground">{r.name_bn}</div>
                )}
              </div>
            ),
          },
          { header: "Duration", cell: (r) => `${r.duration_months} mo` },
          {
            header: "Total (৳)",
            cell: (r) => (
              <span className="font-mono">
                {Number(r.total_price_bdt).toLocaleString()}
              </span>
            ),
          },
          {
            header: "Billing",
            cell: (r) => (
              <Badge variant="secondary" className="capitalize">
                {r.billing_frequency.replace("_", " ")}
              </Badge>
            ),
          },
          {
            header: "Inclusions",
            cell: (r) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDevicesFor(r);
                  }}
                >
                  <Package className="h-3 w-3 mr-1" />
                  Devices
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setServicesFor(r);
                  }}
                >
                  <Stethoscope className="h-3 w-3 mr-1" />
                  Services
                </Button>
              </div>
            ),
          },
        ]}
        searchFn={(r, q) =>
          [r.name, r.name_bn]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q))
        }
        onAdd={openNew}
        onEdit={openEdit}
        onDelete={(r) => remove.mutate(r.id)}
        canDelete={canDelete}
        addLabel="Add plan"
        emptyLabel="No plans yet. Add your first program plan."
      />

      <PackageDevicesDialog
        planId={devicesFor?.id ?? null}
        planName={devicesFor?.name ?? ""}
        open={!!devicesFor}
        onOpenChange={(o) => !o && setDevicesFor(null)}
      />

      <PlanServicesDialog
        planId={servicesFor?.id ?? null}
        planName={servicesFor?.name ?? ""}
        open={!!servicesFor}
        onOpenChange={(o) => !o && setServicesFor(null)}
      />


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit plan" : "Add program plan"}</DialogTitle>
            <DialogDescription>
              Template used when enrolling patients. Schedule is auto-generated.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name (English)</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Name (Bengali)</Label>
                <Input
                  value={form.name_bn ?? ""}
                  onChange={(e) => setForm({ ...form, name_bn: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Duration (months)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.duration_months}
                  onChange={(e) =>
                    setForm({ ...form, duration_months: num(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Total price (৳)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.total_price_bdt}
                  onChange={(e) =>
                    setForm({ ...form, total_price_bdt: num(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Billing frequency</Label>
                <Select
                  value={form.billing_frequency}
                  onValueChange={(v) =>
                    setForm({ ...form, billing_frequency: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="custom">Custom (EMI)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.billing_frequency === "custom" && (
                <div className="space-y-1">
                  <Label>Installments</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.installment_count ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        installment_count: e.target.value ? num(e.target.value) : null,
                      })
                    }
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <Label htmlFor="active" className="cursor-pointer">
                Active
              </Label>
              <Switch
                id="active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
