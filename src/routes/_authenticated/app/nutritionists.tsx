import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listNutritionists,
  upsertNutritionist,
  deleteNutritionist,
  type NutritionistValues,
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

type Nutritionist = NutritionistValues & { id: string };

export const Route = createFileRoute("/_authenticated/app/nutritionists")({
  component: NutritionistsPage,
});

const emptyForm: NutritionistValues = {
  full_name: "",
  full_name_bn: "",
  qualification: "",
  phone: "",
  email: "",
  notes: "",
  is_active: true,
};

function NutritionistsPage() {
  const { hasAnyRole } = useAuth();
  const staff = hasAnyRole(["super_admin", "admin", "care_coordinator"]);
  const canDelete = hasAnyRole(["super_admin", "admin"]);

  const list = useServerFn(listNutritionists);
  const upsert = useServerFn(upsertNutritionist);
  const del = useServerFn(deleteNutritionist);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["nutritionists"],
    queryFn: () => list(),
    enabled: staff,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Nutritionist | null>(null);
  const [form, setForm] = useState<NutritionistValues>(emptyForm);

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, values: form } }),
    onSuccess: () => {
      toast.success(editing ? "Nutritionist updated" : "Nutritionist added");
      qc.invalidateQueries({ queryKey: ["nutritionists"] });
      setOpen(false);
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["nutritionists"] });
    },
    onError: (e) => toast.error("Delete failed", { description: (e as Error).message }),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: Nutritionist) {
    setEditing(row);
    setForm({
      full_name: row.full_name,
      full_name_bn: row.full_name_bn ?? "",
      qualification: row.qualification ?? "",
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
      <MasterDataList<Nutritionist>
        title="Nutritionists"
        description="Registered nutritionists and dieticians on the panel."
        items={items as Nutritionist[]}
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
          { header: "Qualification", cell: (r) => r.qualification ?? "—" },
          { header: "Phone", cell: (r) => r.phone ?? "—" },
          { header: "Email", cell: (r) => r.email ?? "—" },
        ]}
        searchFn={(r, q) =>
          [r.full_name, r.full_name_bn, r.qualification, r.phone, r.email]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q))
        }
        onAdd={openNew}
        onEdit={openEdit}
        onDelete={(r) => remove.mutate(r.id)}
        canDelete={canDelete}
        addLabel="Add nutritionist"
        emptyLabel="No nutritionists yet."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit nutritionist" : "Add nutritionist"}</DialogTitle>
            <DialogDescription>Panel nutritionist profile.</DialogDescription>
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
            <div className="space-y-1">
              <Label>Qualification</Label>
              <Input
                value={form.qualification ?? ""}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                placeholder="e.g. MSc in Nutrition"
              />
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
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <Label htmlFor="nut-active" className="cursor-pointer">
                Active
              </Label>
              <Switch
                id="nut-active"
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
