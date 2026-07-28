import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listDealers,
  upsertDealer,
  deleteDealer,
  listSalesOfficers,
  listDealerTargets,
  upsertDealerTarget,
  deleteDealerTarget,
  type DealerValues,
  type TargetValues,
} from "@/lib/dealers.functions";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

type Dealer = DealerValues & {
  id: string;
  dealer_code: string;
  is_active?: boolean;
};

export const Route = createFileRoute("/_authenticated/app/dealers")({
  component: DealersPage,
});

const emptyDealer: DealerValues = {
  business_name: "",
  business_name_bn: "",
  proprietor_name: "",
  trade_license_no: "",
  tin: "",
  bin: "",
  address: "",
  district: "",
  division: "",
  territory: "",
  phone: "",
  whatsapp: "",
  email: "",
  dealer_type: "retailer",
  agreement_url: "",
  security_deposit_bdt: 0,
  status: "active",
  sales_officer_id: "",
  price_tier: "dealer",
  credit_limit_bdt: 0,
  credit_period: "cash",
  early_payment_discount_pct: 0,
  penalty_pct: 0,
  overdue_grace_days: 0,
  notes: "",
};

function DealersPage() {
  const { hasAnyRole } = useAuth();
  const canAccess = hasAnyRole([
    "super_admin",
    "admin",
    "care_coordinator",
    "finance",
    "inventory_manager",
    "sales_officer",
  ]);
  const canDelete = hasAnyRole(["super_admin", "admin"]);

  const list = useServerFn(listDealers);
  const upsert = useServerFn(upsertDealer);
  const del = useServerFn(deleteDealer);
  const officersFn = useServerFn(listSalesOfficers);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["dealers"],
    queryFn: () => list(),
    enabled: canAccess,
  });
  const { data: officers = [] } = useQuery({
    queryKey: ["dealer-sales-officers"],
    queryFn: () => officersFn(),
    enabled: canAccess,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dealer | null>(null);
  const [form, setForm] = useState<DealerValues>(emptyDealer);
  const [tab, setTab] = useState("profile");
  const [targetsDealer, setTargetsDealer] = useState<Dealer | null>(null);

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, values: form } }),
    onSuccess: () => {
      toast.success(editing ? "Dealer updated" : "Dealer added");
      qc.invalidateQueries({ queryKey: ["dealers"] });
      setOpen(false);
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Dealer deleted");
      qc.invalidateQueries({ queryKey: ["dealers"] });
    },
    onError: (e) => toast.error("Delete failed", { description: (e as Error).message }),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyDealer);
    setTab("profile");
    setOpen(true);
  }

  function openEdit(row: Dealer) {
    setEditing(row);
    setForm({
      business_name: row.business_name,
      business_name_bn: row.business_name_bn ?? "",
      proprietor_name: row.proprietor_name ?? "",
      trade_license_no: row.trade_license_no ?? "",
      tin: row.tin ?? "",
      bin: row.bin ?? "",
      address: row.address ?? "",
      district: row.district ?? "",
      division: row.division ?? "",
      territory: row.territory ?? "",
      phone: row.phone ?? "",
      whatsapp: row.whatsapp ?? "",
      email: row.email ?? "",
      dealer_type: row.dealer_type,
      agreement_url: row.agreement_url ?? "",
      security_deposit_bdt: Number(row.security_deposit_bdt) || 0,
      status: row.status,
      sales_officer_id: row.sales_officer_id ?? "",
      price_tier: row.price_tier,
      credit_limit_bdt: Number(row.credit_limit_bdt) || 0,
      credit_period: row.credit_period,
      early_payment_discount_pct: Number(row.early_payment_discount_pct) || 0,
      penalty_pct: Number(row.penalty_pct) || 0,
      overdue_grace_days: Number(row.overdue_grace_days) || 0,
      notes: row.notes ?? "",
    });
    setTab("profile");
    setOpen(true);
  }

  const officerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of officers as { id: string; full_name: string | null }[]) {
      m.set(o.id, o.full_name ?? o.id.slice(0, 8));
    }
    return m;
  }, [officers]);

  if (!canAccess) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">
          You do not have access to this page.
        </div>
      </div>
    );
  }

  const rows = (items as Dealer[]).map((r) => ({ ...r, is_active: r.status === "active" }));

  return (
    <>
      <MasterDataList<Dealer>
        title="Dealers"
        description="Nationwide dealer, distributor, retailer & pharmacy network."
        items={rows}
        isLoading={isLoading}
        columns={[
          {
            header: "Code",
            cell: (r) => <span className="font-mono text-xs">{r.dealer_code}</span>,
          },
          {
            header: "Business",
            cell: (r) => (
              <div>
                <div className="font-medium">{r.business_name}</div>
                {r.proprietor_name && (
                  <div className="text-xs text-muted-foreground">{r.proprietor_name}</div>
                )}
              </div>
            ),
          },
          {
            header: "Type",
            cell: (r) => (
              <Badge variant="outline" className="capitalize">
                {r.dealer_type.replace("_", " ")}
              </Badge>
            ),
          },
          { header: "District", cell: (r) => r.district ?? "—" },
          { header: "Phone", cell: (r) => r.phone ?? r.whatsapp ?? "—" },
          {
            header: "Tier",
            cell: (r) => (
              <Badge variant="secondary" className="capitalize">
                {r.price_tier}
              </Badge>
            ),
          },
          {
            header: "Credit",
            cell: (r) => (
              <div className="text-xs">
                <div>৳ {Number(r.credit_limit_bdt).toLocaleString()}</div>
                <div className="text-muted-foreground">{r.credit_period.replace("_", " ")}</div>
              </div>
            ),
          },
          {
            header: "Officer",
            cell: (r) =>
              r.sales_officer_id ? (
                <span className="text-xs">{officerNameById.get(r.sales_officer_id) ?? "—"}</span>
              ) : (
                "—"
              ),
          },
          {
            header: "Targets",
            cell: (r) => (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetsDealer(r);
                }}
              >
                Manage
              </Button>
            ),
          },
        ]}
        searchFn={(r, q) =>
          [
            r.business_name,
            r.business_name_bn,
            r.dealer_code,
            r.proprietor_name,
            r.district,
            r.division,
            r.phone,
            r.whatsapp,
            r.email,
            r.tin,
            r.bin,
          ]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q))
        }
        onAdd={openNew}
        onEdit={openEdit}
        onDelete={(r) => remove.mutate(r.id)}
        canDelete={canDelete}
        addLabel="Add dealer"
        emptyLabel="No dealers yet. Add your first dealer to start distribution."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.dealer_code}` : "Add dealer"}</DialogTitle>
            <DialogDescription>
              Dealer master record with business info, credit terms & sales officer.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="credit">Credit & pricing</TabsTrigger>
                <TabsTrigger value="ops">Ops & docs</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-3 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Business name (English) *</Label>
                    <Input
                      required
                      value={form.business_name}
                      onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Business name (Bengali)</Label>
                    <Input
                      value={form.business_name_bn ?? ""}
                      onChange={(e) => setForm({ ...form, business_name_bn: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Proprietor name</Label>
                    <Input
                      value={form.proprietor_name ?? ""}
                      onChange={(e) => setForm({ ...form, proprietor_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Dealer type</Label>
                    <Select
                      value={form.dealer_type}
                      onValueChange={(v) =>
                        setForm({ ...form, dealer_type: v as DealerValues["dealer_type"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distributor">Distributor</SelectItem>
                        <SelectItem value="sub_dealer">Sub-dealer</SelectItem>
                        <SelectItem value="retailer">Retailer</SelectItem>
                        <SelectItem value="pharmacy">Pharmacy</SelectItem>
                        <SelectItem value="hospital_shop">Hospital shop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Trade license no.</Label>
                    <Input
                      value={form.trade_license_no ?? ""}
                      onChange={(e) => setForm({ ...form, trade_license_no: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>TIN</Label>
                    <Input
                      value={form.tin ?? ""}
                      onChange={(e) => setForm({ ...form, tin: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>BIN</Label>
                    <Input
                      value={form.bin ?? ""}
                      onChange={(e) => setForm({ ...form, bin: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Textarea
                    rows={2}
                    value={form.address ?? ""}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Division</Label>
                    <Input
                      value={form.division ?? ""}
                      onChange={(e) => setForm({ ...form, division: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>District</Label>
                    <Input
                      value={form.district ?? ""}
                      onChange={(e) => setForm({ ...form, district: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Territory / zone</Label>
                    <Input
                      value={form.territory ?? ""}
                      onChange={(e) => setForm({ ...form, territory: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone ?? ""}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>WhatsApp</Label>
                    <Input
                      value={form.whatsapp ?? ""}
                      onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email ?? ""}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="credit" className="space-y-3 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Price tier</Label>
                    <Select
                      value={form.price_tier}
                      onValueChange={(v) =>
                        setForm({ ...form, price_tier: v as DealerValues["price_tier"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distributor">Distributor</SelectItem>
                        <SelectItem value="dealer">Dealer</SelectItem>
                        <SelectItem value="retailer">Retailer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Credit period</Label>
                    <Select
                      value={form.credit_period}
                      onValueChange={(v) =>
                        setForm({ ...form, credit_period: v as DealerValues["credit_period"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash only</SelectItem>
                        <SelectItem value="net_7">7 days</SelectItem>
                        <SelectItem value="net_15">15 days</SelectItem>
                        <SelectItem value="net_30">30 days</SelectItem>
                        <SelectItem value="net_45">45 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Credit limit (৳)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.credit_limit_bdt}
                      onChange={(e) =>
                        setForm({ ...form, credit_limit_bdt: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Security deposit (৳)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.security_deposit_bdt}
                      onChange={(e) =>
                        setForm({ ...form, security_deposit_bdt: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Early payment discount %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={form.early_payment_discount_pct}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          early_payment_discount_pct: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Overdue penalty %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={form.penalty_pct}
                      onChange={(e) =>
                        setForm({ ...form, penalty_pct: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Overdue grace days</Label>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={form.overdue_grace_days}
                      onChange={(e) =>
                        setForm({ ...form, overdue_grace_days: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ops" className="space-y-3 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) =>
                        setForm({ ...form, status: v as DealerValues["status"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Assigned sales officer</Label>
                    <Select
                      value={form.sales_officer_id || "__none"}
                      onValueChange={(v) =>
                        setForm({ ...form, sales_officer_id: v === "__none" ? "" : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Unassigned</SelectItem>
                        {(officers as { id: string; full_name: string | null }[]).map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.full_name ?? o.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Onboarded date</Label>
                  <Input
                    type="date"
                    value={form.onboarded_at ?? ""}
                    onChange={(e) => setForm({ ...form, onboarded_at: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Agreement URL</Label>
                  <Input
                    value={form.agreement_url ?? ""}
                    onChange={(e) => setForm({ ...form, agreement_url: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    value={form.notes ?? ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving..." : "Save dealer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TargetsDialog
        dealer={targetsDealer}
        onClose={() => setTargetsDealer(null)}
        canEdit={hasAnyRole(["super_admin", "admin", "finance"])}
      />
    </>
  );
}

function TargetsDialog({
  dealer,
  onClose,
  canEdit,
}: {
  dealer: Dealer | null;
  onClose: () => void;
  canEdit: boolean;
}) {
  const listFn = useServerFn(listDealerTargets);
  const upsertFn = useServerFn(upsertDealerTarget);
  const delFn = useServerFn(deleteDealerTarget);
  const qc = useQueryClient();
  const open = !!dealer;

  const { data: rows = [] } = useQuery({
    queryKey: ["dealer-targets", dealer?.id],
    queryFn: () => listFn({ data: { dealer_id: dealer!.id } }),
    enabled: open,
  });

  const [values, setValues] = useState<TargetValues>({
    dealer_id: "",
    period: "month",
    period_start: new Date().toISOString().slice(0, 10),
    target_bdt: 0,
    target_units: 0,
    notes: "",
  });

  const add = useMutation({
    mutationFn: () =>
      upsertFn({ data: { values: { ...values, dealer_id: dealer!.id } } }),
    onSuccess: () => {
      toast.success("Target saved");
      qc.invalidateQueries({ queryKey: ["dealer-targets", dealer?.id] });
      setValues({ ...values, target_bdt: 0, target_units: 0, notes: "" });
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dealer-targets", dealer?.id] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Targets — {dealer?.business_name}</DialogTitle>
          <DialogDescription>Set monthly, quarterly or annual sales targets.</DialogDescription>
        </DialogHeader>

        {canEdit && (
          <div className="grid grid-cols-5 gap-2 items-end border-b pb-3">
            <div className="space-y-1">
              <Label>Period</Label>
              <Select
                value={values.period}
                onValueChange={(v) =>
                  setValues({ ...values, period: v as TargetValues["period"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Start</Label>
              <Input
                type="date"
                value={values.period_start}
                onChange={(e) => setValues({ ...values, period_start: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Target (৳)</Label>
              <Input
                type="number"
                min={0}
                value={values.target_bdt}
                onChange={(e) =>
                  setValues({ ...values, target_bdt: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Units</Label>
              <Input
                type="number"
                min={0}
                value={values.target_units}
                onChange={(e) =>
                  setValues({ ...values, target_units: Number(e.target.value) || 0 })
                }
              />
            </div>
            <Button type="button" onClick={() => add.mutate()} disabled={add.isPending}>
              Add
            </Button>
          </div>
        )}

        <div className="max-h-[300px] overflow-y-auto">
          {(rows as Array<{
            id: string;
            period: string;
            period_start: string;
            target_bdt: number;
            target_units: number;
          }>).length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No targets set yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2">Period</th>
                  <th>Start</th>
                  <th>Target ৳</th>
                  <th>Units</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {(rows as Array<{
                  id: string;
                  period: string;
                  period_start: string;
                  target_bdt: number;
                  target_units: number;
                }>).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 capitalize">{r.period}</td>
                    <td>{r.period_start}</td>
                    <td>৳ {Number(r.target_bdt).toLocaleString()}</td>
                    <td>{r.target_units}</td>
                    {canEdit && (
                      <td className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => remove.mutate(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
