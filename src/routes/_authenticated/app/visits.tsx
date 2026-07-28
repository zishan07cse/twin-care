import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listVisits,
  createVisit,
  updateVisit,
  deleteVisit,
  checkInVisit,
  checkOutVisit,
  listVisitFields,
  listVisitTargets,
} from "@/lib/visits.functions";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MapPin,
  LogIn,
  LogOut,
  Plus,
  Trash2,
  AlertTriangle,
  Settings2,
  Map as MapIcon,
} from "lucide-react";
import { VisitMapDialog } from "@/components/app/visit-map-dialog";

type TargetType = "doctor" | "hospital" | "patient" | "dealer" | "pharmacy" | "office" | "other";

type Visit = {
  id: string;
  visit_no: string | null;
  target_type: TargetType;
  doctor_id: string | null;
  hospital_id: string | null;
  patient_id: string | null;
  dealer_id: string | null;
  pharmacy_id: string | null;
  other_name: string | null;
  other_address: string | null;
  planned_at: string | null;
  purpose: string | null;
  action_plan: string | null;
  outcome: string | null;
  next_action: string | null;
  notes: string | null;
  status: "planned" | "checked_in" | "completed" | "cancelled" | "missed";
  checkin_at: string | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkout_at: string | null;
  checkout_lat: number | null;
  checkout_lng: number | null;
  target_lat: number | null;
  target_lng: number | null;
  distance_from_target_m: number | null;
  distance_flagged: boolean;
  custom_data: Record<string, unknown>;
  assigned_to: string;
  doctor?: { id: string; full_name: string } | null;
  hospital?: { id: string; name: string } | null;
  patient?: { id: string; full_name: string; patient_code: string } | null;
  dealer?: { id: string; name: string } | null;
  pharmacy?: { id: string; name: string } | null;
  assigned_profile?: { id: string; full_name: string | null } | null;
};

type CustomField = {
  id: string;
  field_key: string;
  label: string;
  field_type: "text" | "textarea" | "number" | "select" | "date" | "checkbox";
  options: string[] | null;
  placeholder: string | null;
  required: boolean;
  sort_order: number;
  is_active: boolean;
};

export const Route = createFileRoute("/_authenticated/app/visits")({
  component: VisitsPage,
});

const emptyForm = {
  target_type: "doctor" as TargetType,
  doctor_id: "",
  hospital_id: "",
  patient_id: "",
  dealer_id: "",
  pharmacy_id: "",
  other_name: "",
  other_address: "",
  planned_at: "",
  purpose: "",
  action_plan: "",
  notes: "",
  target_lat: null as number | null,
  target_lng: null as number | null,
  custom_data: {} as Record<string, unknown>,
};

function targetLabel(v: Visit): string {
  switch (v.target_type) {
    case "doctor":
      return v.doctor?.full_name ?? "Doctor";
    case "hospital":
      return v.hospital?.name ?? "Hospital";
    case "patient":
      return v.patient ? `${v.patient.full_name} (${v.patient.patient_code})` : "Patient";
    case "dealer":
      return v.dealer?.name ?? "Dealer";
    case "pharmacy":
      return v.pharmacy?.name ?? "Pharmacy";
    case "office":
      return "Office work";
    case "other":
      return v.other_name ?? "Other";
  }
}

function StatusBadge({ status }: { status: Visit["status"] }) {
  const map: Record<Visit["status"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    planned: { label: "Planned", variant: "outline" },
    checked_in: { label: "Checked in", variant: "default" },
    completed: { label: "Completed", variant: "secondary" },
    cancelled: { label: "Cancelled", variant: "destructive" },
    missed: { label: "Missed", variant: "destructive" },
  };
  const cfg = map[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function VisitsPage() {
  const { hasAnyRole, user } = useAuth();
  const allowed = hasAnyRole([
    "super_admin",
    "admin",
    "care_coordinator",
    "sales_officer",
    "inventory_manager",
    "finance",
  ]);
  const isAdmin = hasAnyRole(["super_admin", "admin"]);

  const list = useServerFn(listVisits);
  const create = useServerFn(createVisit);
  const update = useServerFn(updateVisit);
  const del = useServerFn(deleteVisit);
  const chkIn = useServerFn(checkInVisit);
  const chkOut = useServerFn(checkOutVisit);
  const fieldsFn = useServerFn(listVisitFields);
  const targetsFn = useServerFn(listVisitTargets);
  const qc = useQueryClient();

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["visits"],
    queryFn: () => list({ data: {} }),
    enabled: allowed,
  });

  const { data: fields = [] } = useQuery({
    queryKey: ["visit-fields"],
    queryFn: () => fieldsFn(),
    enabled: allowed,
  });

  const { data: targets } = useQuery({
    queryKey: ["visit-targets"],
    queryFn: () => targetsFn(),
    enabled: allowed,
  });

  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [checkoutVisit, setCheckoutVisit] = useState<Visit | null>(null);
  const [mapVisit, setMapVisit] = useState<Visit | null>(null);
  const [outcome, setOutcome] = useState({ outcome: "", next_action: "", notes: "", custom_data: {} as Record<string, unknown> });
  const [tab, setTab] = useState<"all" | "field" | "office">("all");

  const filteredVisits = useMemo(() => {
    const rows = visits as unknown as Visit[];
    if (tab === "office") return rows.filter((v) => v.target_type === "office");
    if (tab === "field") return rows.filter((v) => v.target_type !== "office");
    return rows;
  }, [visits, tab]);

  const activeFields = useMemo(
    () => (fields as CustomField[]).filter((f) => f.is_active),
    [fields],
  );

  const saveCreate = useMutation({
    mutationFn: () =>
      create({
        data: {
          target_type: form.target_type,
          doctor_id: form.doctor_id || null,
          hospital_id: form.hospital_id || null,
          patient_id: form.patient_id || null,
          dealer_id: form.dealer_id || null,
          pharmacy_id: form.pharmacy_id || null,
          other_name: form.other_name || null,
          other_address: form.other_address || null,
          planned_at: form.planned_at ? new Date(form.planned_at).toISOString() : null,
          purpose: form.purpose || null,
          action_plan: form.action_plan || null,
          notes: form.notes || null,
          target_lat: form.target_lat,
          target_lng: form.target_lng,
          custom_data: form.custom_data,
        },
      }),
    onSuccess: () => {
      toast.success("Visit created");
      qc.invalidateQueries({ queryKey: ["visits"] });
      setDlgOpen(false);
      setForm(emptyForm);
    },
    onError: (e) => toast.error("Create failed", { description: (e as Error).message }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Visit deleted");
      qc.invalidateQueries({ queryKey: ["visits"] });
    },
  });

  function withGeo(cb: (pos: GeolocationPosition) => void) {
    if (!navigator.geolocation) {
      toast.error("Geolocation not available on this device");
      return;
    }
    toast.info("Fetching your location…");
    navigator.geolocation.getCurrentPosition(
      cb,
      (err) => toast.error("Location denied", { description: err.message }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  const checkinMut = useMutation({
    mutationFn: async (v: Visit) => {
      return new Promise<{ flagged: boolean; distance: number | null }>((resolve, reject) => {
        withGeo(async (pos) => {
          try {
            const res = await chkIn({
              data: {
                id: v.id,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              },
            });
            resolve({ flagged: res.flagged, distance: res.distance });
          } catch (e) {
            reject(e as Error);
          }
        });
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      if (res.flagged) {
        toast.warning("Checked in — but you appear far from target", {
          description: `~${Math.round(res.distance ?? 0)} m from saved target location.`,
        });
      } else {
        toast.success("Checked in");
      }
    },
    onError: (e) => toast.error("Check-in failed", { description: (e as Error).message }),
  });

  const checkoutMut = useMutation({
    mutationFn: async () => {
      const v = checkoutVisit!;
      return new Promise<void>((resolve, reject) => {
        withGeo(async (pos) => {
          try {
            await chkOut({
              data: {
                id: v.id,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                outcome: outcome.outcome || null,
                next_action: outcome.next_action || null,
                notes: outcome.notes || null,
                custom_data: { ...(v.custom_data || {}), ...outcome.custom_data },
              },
            });
            resolve();
          } catch (e) {
            reject(e as Error);
          }
        });
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      setCheckoutVisit(null);
      setOutcome({ outcome: "", next_action: "", notes: "", custom_data: {} });
      toast.success("Checked out — visit completed");
    },
    onError: (e) => toast.error("Check-out failed", { description: (e as Error).message }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) =>
      update({ data: { id, values: { /* status */ } as never } }).then(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (update as any)({ data: { id, values: { status: "cancelled" } } }),
      ),
  });

  if (!allowed) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">You do not have access to this page.</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Sales visits</h1>
          <p className="text-sm text-muted-foreground">
            Log field visits to doctors, hospitals, dealers, pharmacies and clients. GPS is captured at check-in and check-out.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <Button asChild variant="outline">
              <Link to="/app/visit-form-settings">
                <Settings2 className="h-4 w-4 mr-1" /> Form fields
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setForm({ ...emptyForm, target_type: "office", planned_at: new Date().toISOString().slice(0, 16) });
              setDlgOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Log office work
          </Button>
          <Button onClick={() => setDlgOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New visit
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "field" | "office")}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="field">Field visits</TabsTrigger>
          <TabsTrigger value="office">Office work</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Visit</th>
              <th className="p-3">Target</th>
              <th className="p-3">Planned</th>
              <th className="p-3">Status</th>
              <th className="p-3">Rep</th>
              <th className="p-3">GPS</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filteredVisits.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No visits yet.
                </td>
              </tr>
            )}
            {filteredVisits.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="p-3 font-mono text-xs">{v.visit_no ?? v.id.slice(0, 8)}</td>
                <td className="p-3">
                  <div className="font-medium">{targetLabel(v)}</div>
                  <div className="text-xs text-muted-foreground capitalize">{v.target_type}</div>
                </td>
                <td className="p-3 text-xs">
                  {v.planned_at ? new Date(v.planned_at).toLocaleString() : "—"}
                </td>
                <td className="p-3">
                  <StatusBadge status={v.status} />
                  {v.distance_flagged && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> off-location
                    </div>
                  )}
                </td>
                <td className="p-3 text-xs">{v.assigned_profile?.full_name ?? "—"}</td>
                <td className="p-3 text-xs">
                  {v.checkin_at && (
                    <div>
                      In: {v.checkin_lat?.toFixed(4)},{v.checkin_lng?.toFixed(4)}
                    </div>
                  )}
                  {v.checkout_at && (
                    <div>
                      Out: {v.checkout_lat?.toFixed(4)},{v.checkout_lng?.toFixed(4)}
                    </div>
                  )}
                  {!v.checkin_at && !v.checkout_at && "—"}
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    {(v.checkin_at || v.checkout_at || v.target_lat != null) && (
                      <Button size="sm" variant="ghost" onClick={() => setMapVisit(v)} title="View on map">
                        <MapIcon className="h-3 w-3" />
                      </Button>
                    )}
                    {v.status === "planned" && v.assigned_to === user?.id && (
                      <Button size="sm" variant="outline" onClick={() => checkinMut.mutate(v)}>
                        <LogIn className="h-3 w-3 mr-1" /> Check in
                      </Button>
                    )}
                    {v.status === "checked_in" && v.assigned_to === user?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCheckoutVisit(v);
                          setOutcome({ outcome: "", next_action: "", notes: "", custom_data: {} });
                        }}
                      >
                        <LogOut className="h-3 w-3 mr-1" /> Check out
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Delete this visit?")) removeMut.mutate(v.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New visit dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New visit</DialogTitle>
            <DialogDescription>
              Plan a visit now, then check-in on arrival and check-out when done.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveCreate.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Target type</Label>
                <Select
                  value={form.target_type}
                  onValueChange={(v) =>
                    setForm({ ...emptyForm, target_type: v as TargetType, planned_at: form.planned_at, purpose: form.purpose })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="patient">Patient / Client</SelectItem>
                    <SelectItem value="dealer">Dealer</SelectItem>
                    <SelectItem value="pharmacy">Pharmacy</SelectItem>
                    <SelectItem value="office">Office work (in-house)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Planned date &amp; time</Label>
                <Input
                  type="datetime-local"
                  value={form.planned_at}
                  onChange={(e) => setForm({ ...form, planned_at: e.target.value })}
                />
              </div>
            </div>

            {form.target_type === "doctor" && (
              <div className="space-y-1">
                <Label>Doctor</Label>
                <Select
                  value={form.doctor_id}
                  onValueChange={(v) => setForm({ ...form, doctor_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {(targets?.doctors ?? []).map(
                      (d: {
                        id: string;
                        full_name: string;
                        bmdc_number: string | null;
                        hospital: { id: string; name: string } | null;
                      }) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.full_name}
                          {d.hospital?.name ? ` — ${d.hospital.name}` : ""}
                          {d.bmdc_number ? ` (BMDC ${d.bmdc_number})` : ""}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.target_type === "hospital" && (
              <div className="space-y-1">
                <Label>Hospital</Label>
                <Select
                  value={form.hospital_id}
                  onValueChange={(v) => setForm({ ...form, hospital_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select hospital" />
                  </SelectTrigger>
                  <SelectContent>
                    {(targets?.hospitals ?? []).map((h: { id: string; name: string; city: string | null }) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                        {h.city ? ` — ${h.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.target_type === "patient" && (
              <div className="space-y-1">
                <Label>Patient</Label>
                <Select
                  value={form.patient_id}
                  onValueChange={(v) => setForm({ ...form, patient_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {(targets?.patients ?? []).map(
                      (p: { id: string; full_name: string; patient_code: string }) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} ({p.patient_code})
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.target_type === "dealer" && (
              <div className="space-y-1">
                <Label>Dealer</Label>
                <Select
                  value={form.dealer_id}
                  onValueChange={(v) => setForm({ ...form, dealer_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select dealer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(targets?.dealers ?? []).map(
                      (d: { id: string; name: string; dealer_code: string; city: string | null }) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({d.dealer_code})
                          {d.city ? ` — ${d.city}` : ""}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.target_type === "pharmacy" && (
              <div className="space-y-1">
                <Label>Pharmacy</Label>
                <Select
                  value={form.pharmacy_id}
                  onValueChange={(v) => setForm({ ...form, pharmacy_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pharmacy" />
                  </SelectTrigger>
                  <SelectContent>
                    {(targets?.pharmacies ?? []).map((p: { id: string; name: string; city: string | null }) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.city ? ` — ${p.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Add pharmacies from the Pharmacies page.
                </p>
              </div>
            )}

            {form.target_type === "other" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={form.other_name}
                    onChange={(e) => setForm({ ...form, other_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input
                    value={form.other_address}
                    onChange={(e) => setForm({ ...form, other_address: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Purpose</Label>
              <Input
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="e.g. Product demo, follow-up, order collection"
              />
            </div>
            <div className="space-y-1">
              <Label>Action plan</Label>
              <Textarea
                rows={2}
                value={form.action_plan}
                onChange={(e) => setForm({ ...form, action_plan: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label>Target latitude (optional)</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.target_lat ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      target_lat: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Target longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.target_lng ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      target_lng: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!navigator.geolocation) return toast.error("Geolocation not available");
                  navigator.geolocation.getCurrentPosition(
                    (pos) =>
                      setForm({
                        ...form,
                        target_lat: pos.coords.latitude,
                        target_lng: pos.coords.longitude,
                      }),
                    (err) => toast.error("Location failed", { description: err.message }),
                    { enableHighAccuracy: true, timeout: 10000 },
                  );
                }}
              >
                <MapPin className="h-4 w-4 mr-1" /> Here
              </Button>
            </div>

            {activeFields.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground">Additional fields</div>
                {activeFields.map((f) => (
                  <CustomFieldInput
                    key={f.id}
                    field={f}
                    value={form.custom_data[f.field_key]}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        custom_data: { ...form.custom_data, [f.field_key]: v },
                      })
                    }
                  />
                ))}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDlgOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveCreate.isPending}>
                {saveCreate.isPending ? "Saving…" : "Save visit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Check-out dialog */}
      <Dialog open={!!checkoutVisit} onOpenChange={(o) => !o && setCheckoutVisit(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Check out — {checkoutVisit ? targetLabel(checkoutVisit) : ""}</DialogTitle>
            <DialogDescription>
              Fill in the outcome. GPS will be captured on save.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Outcome</Label>
              <Textarea
                rows={2}
                value={outcome.outcome}
                onChange={(e) => setOutcome({ ...outcome, outcome: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Next action</Label>
              <Textarea
                rows={2}
                value={outcome.next_action}
                onChange={(e) => setOutcome({ ...outcome, next_action: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={outcome.notes}
                onChange={(e) => setOutcome({ ...outcome, notes: e.target.value })}
              />
            </div>
            {activeFields.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground">Additional fields</div>
                {activeFields.map((f) => (
                  <CustomFieldInput
                    key={f.id}
                    field={f}
                    value={outcome.custom_data[f.field_key]}
                    onChange={(v) =>
                      setOutcome({
                        ...outcome,
                        custom_data: { ...outcome.custom_data, [f.field_key]: v },
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutVisit(null)}>
              Cancel
            </Button>
            <Button onClick={() => checkoutMut.mutate()} disabled={checkoutMut.isPending}>
              {checkoutMut.isPending ? "Saving…" : "Check out with GPS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VisitMapDialog
        open={!!mapVisit}
        onOpenChange={(o) => !o && setMapVisit(null)}
        visit={mapVisit ? { ...mapVisit, targetLabel: targetLabel(mapVisit) } : null}
      />
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <Label>
      {field.label}
      {field.required && <span className="text-destructive"> *</span>}
    </Label>
  );
  switch (field.field_type) {
    case "textarea":
      return (
        <div className="space-y-1">
          {label}
          <Textarea
            rows={2}
            placeholder={field.placeholder ?? ""}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "number":
      return (
        <div className="space-y-1">
          {label}
          <Input
            type="number"
            placeholder={field.placeholder ?? ""}
            value={(value as number | string) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
      );
    case "date":
      return (
        <div className="space-y-1">
          {label}
          <Input
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "select":
      return (
        <div className="space-y-1">
          {label}
          <Select value={(value as string) ?? ""} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder ?? "Select"} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox checked={!!value} onCheckedChange={(v) => onChange(!!v)} id={`cf-${field.id}`} />
          <Label htmlFor={`cf-${field.id}`} className="cursor-pointer">
            {field.label}
          </Label>
        </div>
      );
    default:
      return (
        <div className="space-y-1">
          {label}
          <Input
            placeholder={field.placeholder ?? ""}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}
