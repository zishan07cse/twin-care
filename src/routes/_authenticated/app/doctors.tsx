import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listDoctors,
  upsertDoctor,
  deleteDoctor,
  listHospitals,
  type DoctorValues,
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Doctor = DoctorValues & {
  id: string;
  hospital?: { id: string; name: string } | null;
};

export const Route = createFileRoute("/_authenticated/app/doctors")({
  component: DoctorsPage,
});

const emptyDoctor: DoctorValues = {
  full_name: "",
  full_name_bn: "",
  bmdc_number: "",
  specialization: "",
  phone: "",
  email: "",
  hospital_id: "",
  is_referrer: false,
  is_treating: true,
  referral_commission_pct: 0,
  notes: "",
  is_active: true,
};

const NO_HOSPITAL = "__none__";

function DoctorsPage() {
  const { hasAnyRole } = useAuth();
  const staff = hasAnyRole(["super_admin", "admin", "care_coordinator"]);
  const canDelete = hasAnyRole(["super_admin", "admin"]);

  const list = useServerFn(listDoctors);
  const upsert = useServerFn(upsertDoctor);
  const del = useServerFn(deleteDoctor);
  const listHosp = useServerFn(listHospitals);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => list(),
    enabled: staff,
  });

  const { data: hospitals = [] } = useQuery({
    queryKey: ["hospitals"],
    queryFn: () => listHosp(),
    enabled: staff,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState<DoctorValues>(emptyDoctor);

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, values: form } }),
    onSuccess: () => {
      toast.success(editing ? "Doctor updated" : "Doctor added");
      qc.invalidateQueries({ queryKey: ["doctors"] });
      setOpen(false);
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["doctors"] });
    },
    onError: (e) => toast.error("Delete failed", { description: (e as Error).message }),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyDoctor);
    setOpen(true);
  }

  function openEdit(row: Doctor) {
    setEditing(row);
    setForm({
      full_name: row.full_name,
      full_name_bn: row.full_name_bn ?? "",
      bmdc_number: row.bmdc_number ?? "",
      specialization: row.specialization ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      hospital_id: row.hospital_id ?? "",
      is_referrer: row.is_referrer,
      is_treating: row.is_treating,
      referral_commission_pct: Number(row.referral_commission_pct ?? 0),
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
      <MasterDataList<Doctor>
        title="Doctors"
        description="Referring physicians and treating doctors."
        items={items as Doctor[]}
        isLoading={isLoading}
        columns={[
          {
            header: "Name",
            cell: (r) => (
              <div>
                <div className="font-medium">{r.full_name}</div>
                {r.full_name_bn && (
                  <div className="text-xs text-muted-foreground">{r.full_name_bn}</div>
                )}
              </div>
            ),
          },
          { header: "BMDC", cell: (r) => r.bmdc_number ?? "—" },
          { header: "Specialization", cell: (r) => r.specialization ?? "—" },
          { header: "Hospital", cell: (r) => r.hospital?.name ?? "—" },
          {
            header: "Role",
            cell: (r) => (
              <div className="flex gap-1 flex-wrap">
                {r.is_referrer && <Badge variant="outline">Referrer</Badge>}
                {r.is_treating && <Badge variant="outline">Treating</Badge>}
              </div>
            ),
          },
          { header: "Phone", cell: (r) => r.phone ?? "—" },
        ]}
        searchFn={(r, q) =>
          [r.full_name, r.full_name_bn, r.bmdc_number, r.specialization, r.phone, r.email, r.hospital?.name]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q))
        }
        onAdd={openNew}
        onEdit={openEdit}
        onDelete={(r) => remove.mutate(r.id)}
        canDelete={canDelete}
        addLabel="Add doctor"
        emptyLabel="No doctors yet."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit doctor" : "Add doctor"}</DialogTitle>
            <DialogDescription>Doctor profile and referral settings.</DialogDescription>
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
                <Label>Full name (English)</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Full name (Bengali)</Label>
                <Input
                  value={form.full_name_bn ?? ""}
                  onChange={(e) => setForm({ ...form, full_name_bn: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>BMDC number</Label>
                <Input
                  value={form.bmdc_number ?? ""}
                  onChange={(e) => setForm({ ...form, bmdc_number: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Specialization</Label>
                <Input
                  value={form.specialization ?? ""}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  placeholder="e.g. Endocrinology"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Hospital</Label>
              <Select
                value={form.hospital_id || NO_HOSPITAL}
                onValueChange={(v) =>
                  setForm({ ...form, hospital_id: v === NO_HOSPITAL ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select hospital" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_HOSPITAL}>— None —</SelectItem>
                  {(hospitals as Array<{ id: string; name: string }>).map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label className="cursor-pointer">Referrer</Label>
                <Switch
                  checked={form.is_referrer}
                  onCheckedChange={(v) => setForm({ ...form, is_referrer: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label className="cursor-pointer">Treating</Label>
                <Switch
                  checked={form.is_treating}
                  onCheckedChange={(v) => setForm({ ...form, is_treating: v })}
                />
              </div>
              <div className="space-y-1">
                <Label>Commission %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.referral_commission_pct}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      referral_commission_pct: Number(e.target.value) || 0,
                    })
                  }
                  disabled={!form.is_referrer}
                />
              </div>
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
              <Label htmlFor="doc-active" className="cursor-pointer">
                Active
              </Label>
              <Switch
                id="doc-active"
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
