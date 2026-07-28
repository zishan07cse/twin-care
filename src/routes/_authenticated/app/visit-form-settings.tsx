import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listVisitFields,
  upsertVisitField,
  deleteVisitField,
  type VisitFieldValues,
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
import { Plus, Pencil, Trash2 } from "lucide-react";

type Field = VisitFieldValues & { id: string };

export const Route = createFileRoute("/_authenticated/app/visit-form-settings")({
  component: VisitFormSettingsPage,
});

const empty: VisitFieldValues = {
  field_key: "",
  label: "",
  field_type: "text",
  options: [],
  placeholder: "",
  required: false,
  sort_order: 0,
  is_active: true,
};

function VisitFormSettingsPage() {
  const { hasAnyRole } = useAuth();
  const admin = hasAnyRole(["super_admin", "admin"]);

  const list = useServerFn(listVisitFields);
  const upsert = useServerFn(upsertVisitField);
  const del = useServerFn(deleteVisitField);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["visit-fields"],
    queryFn: () => list(),
    enabled: admin,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Field | null>(null);
  const [form, setForm] = useState<VisitFieldValues>(empty);
  const [optionsText, setOptionsText] = useState("");

  const save = useMutation({
    mutationFn: () => {
      const options =
        form.field_type === "select"
          ? optionsText
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : null;
      return upsert({ data: { id: editing?.id, values: { ...form, options } } });
    },
    onSuccess: () => {
      toast.success(editing ? "Field updated" : "Field added");
      qc.invalidateQueries({ queryKey: ["visit-fields"] });
      setOpen(false);
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["visit-fields"] });
    },
  });

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOptionsText("");
    setOpen(true);
  }

  function openEdit(f: Field) {
    setEditing(f);
    setForm({
      field_key: f.field_key,
      label: f.label,
      field_type: f.field_type,
      options: f.options ?? [],
      placeholder: f.placeholder ?? "",
      required: f.required,
      sort_order: f.sort_order,
      is_active: f.is_active,
    });
    setOptionsText((f.options ?? []).join("\n"));
    setOpen(true);
  }

  if (!admin) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">
          Only admins can configure visit form fields.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Visit form fields</h1>
          <p className="text-sm text-muted-foreground">
            Add extra fields that appear on the new-visit and check-out forms.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add field
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Label</th>
              <th className="p-3">Key</th>
              <th className="p-3">Type</th>
              <th className="p-3">Required</th>
              <th className="p-3">Active</th>
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
            {!isLoading && (items as Field[]).length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No custom fields yet.
                </td>
              </tr>
            )}
            {(items as Field[]).map((f) => (
              <tr key={f.id} className="border-t">
                <td className="p-3 text-xs">{f.sort_order}</td>
                <td className="p-3 font-medium">{f.label}</td>
                <td className="p-3 font-mono text-xs">{f.field_key}</td>
                <td className="p-3 text-xs capitalize">{f.field_type}</td>
                <td className="p-3">{f.required ? <Badge>Yes</Badge> : "—"}</td>
                <td className="p-3">{f.is_active ? <Badge variant="secondary">Yes</Badge> : "—"}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(f)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${f.label}"?`)) remove.mutate(f.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit field" : "Add field"}</DialogTitle>
            <DialogDescription>Configure a custom field on the visit form.</DialogDescription>
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
                <Label>Label</Label>
                <Input
                  required
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Key</Label>
                <Input
                  required
                  disabled={!!editing}
                  value={form.field_key}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                    })
                  }
                  placeholder="lowercase_key"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={form.field_type}
                  onValueChange={(v) => setForm({ ...form, field_type: v as VisitFieldValues["field_type"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Short text</SelectItem>
                    <SelectItem value="textarea">Long text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="select">Dropdown</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            {form.field_type === "select" && (
              <div className="space-y-1">
                <Label>Options (one per line)</Label>
                <Textarea
                  rows={4}
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder={"Option A\nOption B"}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Placeholder</Label>
              <Input
                value={form.placeholder ?? ""}
                onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label className="cursor-pointer">Required</Label>
                <Switch
                  checked={form.required}
                  onCheckedChange={(v) => setForm({ ...form, required: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label className="cursor-pointer">Active</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
