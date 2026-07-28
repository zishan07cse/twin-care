import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listHospitals,
  upsertHospital,
  deleteHospital,
  type HospitalValues,
} from "@/lib/master-data.functions";
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

type Hospital = HospitalValues & { id: string };

export const Route = createFileRoute("/_authenticated/app/hospitals")({
  component: HospitalsPage,
});

const emptyHospital: HospitalValues = {
  name: "",
  name_bn: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  notes: "",
  is_active: true,
};

function HospitalsPage() {
  const { hasAnyRole } = useAuth();
  const staff = hasAnyRole(["super_admin", "admin", "care_coordinator"]);
  const canDelete = hasAnyRole(["super_admin", "admin"]);

  const list = useServerFn(listHospitals);
  const upsert = useServerFn(upsertHospital);
  const del = useServerFn(deleteHospital);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["hospitals"],
    queryFn: () => list(),
    enabled: staff,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Hospital | null>(null);
  const [form, setForm] = useState<HospitalValues>(emptyHospital);

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, values: form } }),
    onSuccess: () => {
      toast.success(editing ? "Hospital updated" : "Hospital added");
      qc.invalidateQueries({ queryKey: ["hospitals"] });
      setOpen(false);
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["hospitals"] });
    },
    onError: (e) => toast.error("Delete failed", { description: (e as Error).message }),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyHospital);
    setOpen(true);
  }

  function openEdit(row: Hospital) {
    setEditing(row);
    setForm({
      name: row.name,
      name_bn: row.name_bn ?? "",
      address: row.address ?? "",
      city: row.city ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      notes: row.notes ?? "",
      is_active: row.is_active,
    });
    setOpen(true);
  }

  if (!staff) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">You do not have access to this page.</div>
      </div>
    );
  }

  return (
    <>
      <MasterDataList<Hospital>
        title="Hospitals"
        description="Referring and treating facilities."
        items={items as Hospital[]}
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
          { header: "Phone", cell: (r) => r.phone ?? "—" },
          { header: "Email", cell: (r) => r.email ?? "—" },
        ]}
        searchFn={(r, q) =>
          [r.name, r.name_bn, r.city, r.phone, r.email]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q))
        }
        onAdd={openNew}
        onEdit={openEdit}
        onDelete={(r) => remove.mutate(r.id)}
        canDelete={canDelete}
        addLabel="Add hospital"
        emptyLabel="No hospitals yet. Add your first one."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit hospital" : "Add hospital"}</DialogTitle>
            <DialogDescription>
              Facility details visible to staff.
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
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
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
