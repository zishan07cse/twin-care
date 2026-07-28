import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listPharmacies,
  upsertPharmacy,
  deletePharmacy,
  type PharmacyValues,
} from "@/lib/pharmacies.functions";
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
import { toast } from "sonner";
import { MapPin } from "lucide-react";

type Pharmacy = PharmacyValues & { id: string };

export const Route = createFileRoute("/_authenticated/app/pharmacies")({
  component: PharmaciesPage,
});

const emptyPharmacy: PharmacyValues = {
  name: "",
  name_bn: "",
  address: "",
  city: "",
  phone: "",
  contact_person: "",
  latitude: null,
  longitude: null,
  notes: "",
  is_active: true,
};

function PharmaciesPage() {
  const { hasAnyRole } = useAuth();
  const allowed = hasAnyRole([
    "super_admin",
    "admin",
    "care_coordinator",
    "sales_officer",
    "inventory_manager",
    "finance",
  ]);
  const canDelete = hasAnyRole(["super_admin", "admin"]);

  const list = useServerFn(listPharmacies);
  const upsert = useServerFn(upsertPharmacy);
  const del = useServerFn(deletePharmacy);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pharmacies"],
    queryFn: () => list(),
    enabled: allowed,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pharmacy | null>(null);
  const [form, setForm] = useState<PharmacyValues>(emptyPharmacy);

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, values: form } }),
    onSuccess: () => {
      toast.success(editing ? "Pharmacy updated" : "Pharmacy added");
      qc.invalidateQueries({ queryKey: ["pharmacies"] });
      setOpen(false);
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["pharmacies"] });
    },
    onError: (e) => toast.error("Delete failed", { description: (e as Error).message }),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyPharmacy);
    setOpen(true);
  }

  function openEdit(row: Pharmacy) {
    setEditing(row);
    setForm({
      name: row.name,
      name_bn: row.name_bn ?? "",
      address: row.address ?? "",
      city: row.city ?? "",
      phone: row.phone ?? "",
      contact_person: row.contact_person ?? "",
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      notes: row.notes ?? "",
      is_active: row.is_active,
    });
    setOpen(true);
  }

  function pinMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation not available");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      (err) => toast.error("Location failed", { description: err.message }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (!allowed) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">You do not have access to this page.</div>
      </div>
    );
  }

  return (
    <>
      <MasterDataList<Pharmacy>
        title="Pharmacies"
        description="Pharmacies your sales team visits."
        items={items as Pharmacy[]}
        isLoading={isLoading}
        columns={[
          {
            header: "Name",
            cell: (r) => (
              <div>
                <div className="font-medium">{r.name}</div>
                {r.name_bn && <div className="text-xs text-muted-foreground">{r.name_bn}</div>}
              </div>
            ),
          },
          { header: "City", cell: (r) => r.city ?? "—" },
          { header: "Contact", cell: (r) => r.contact_person ?? "—" },
          { header: "Phone", cell: (r) => r.phone ?? "—" },
          {
            header: "GPS",
            cell: (r) =>
              r.latitude != null && r.longitude != null ? (
                <span className="text-xs text-muted-foreground">
                  {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                </span>
              ) : (
                "—"
              ),
          },
        ]}
        searchFn={(r, q) =>
          [r.name, r.name_bn, r.city, r.phone, r.contact_person]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q))
        }
        onAdd={openNew}
        onEdit={openEdit}
        onDelete={(r) => remove.mutate(r.id)}
        canDelete={canDelete}
        addLabel="Add pharmacy"
        emptyLabel="No pharmacies yet."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit pharmacy" : "Add pharmacy"}</DialogTitle>
            <DialogDescription>Pharmacy master details.</DialogDescription>
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
              <Label>Address</Label>
              <Textarea
                rows={2}
                value={form.address ?? ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>City</Label>
                <Input
                  value={form.city ?? ""}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Contact person</Label>
              <Input
                value={form.contact_person ?? ""}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.latitude ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      latitude: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.longitude ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      longitude: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <Button type="button" variant="outline" onClick={pinMyLocation}>
                <MapPin className="h-4 w-4 mr-1" /> Pin
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <Label htmlFor="pharm-active" className="cursor-pointer">
                Active
              </Label>
              <Switch
                id="pharm-active"
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
