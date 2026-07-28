import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listInventoryItems,
  upsertInventoryItem,
  deleteInventoryItem,
  listAssignments,
  createAssignment,
  updateAssignmentStatus,
  listPatientsForInventory,
  listPurchases,
  createPurchase,
  deletePurchase,
  type InventoryItemValues,
  type AssignmentValues,
  type PurchaseValues,
} from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Package, AlertTriangle, ArrowLeftRight, Truck } from "lucide-react";
import { toast } from "sonner";
import { InventoryInsights } from "@/components/app/inventory-insights";

export const Route = createFileRoute("/_authenticated/app/inventory")({
  component: InventoryPage,
});

type ItemRow = InventoryItemValues & { id: string };

const emptyItem: InventoryItemValues = {
  name_en: "",
  name_bn: "",
  sku: "",
  category: "consumable",
  is_returnable: false,
  unit_price_bdt: 0,
  stock_qty: 0,
  reorder_level: 0,
  lifespan_days: null,
  notes: "",
  is_active: true,
};

const emptyAssign: AssignmentValues = {
  item_id: "",
  patient_id: "",
  quantity: 1,
  assigned_at: new Date().toISOString().slice(0, 10),
  expires_at: null,
  deposit_bdt: 0,
  notes: "",
};

const emptyPurchase: PurchaseValues = {
  item_id: "",
  quantity: 1,
  unit_cost_bdt: 0,
  supplier: "",
  invoice_no: "",
  purchased_at: new Date().toISOString().slice(0, 10),
  notes: "",
};

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const CAT_LABELS: Record<string, string> = {
  device: "Device",
  consumable: "Consumable",
  sensor: "CGM sensor",
  medicine: "Medicine",
  other: "Other",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  returned: "secondary",
  consumed: "secondary",
  lost: "destructive",
  expired: "outline",
};

function InventoryPage() {
  const { hasAnyRole } = useAuth();
  const canView = hasAnyRole([
    "super_admin",
    "admin",
    "care_coordinator",
    "inventory_manager",
  ]);
  const canDelete = hasAnyRole(["super_admin", "admin"]);

  const qc = useQueryClient();
  const listItems = useServerFn(listInventoryItems);
  const listAss = useServerFn(listAssignments);
  const listPts = useServerFn(listPatientsForInventory);
  const upsertItem = useServerFn(upsertInventoryItem);
  const delItem = useServerFn(deleteInventoryItem);
  const createAss = useServerFn(createAssignment);
  const updAss = useServerFn(updateAssignmentStatus);
  const listPurch = useServerFn(listPurchases);
  const createPurch = useServerFn(createPurchase);
  const delPurch = useServerFn(deletePurchase);

  const { data: items = [] } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: () => listItems(),
    enabled: canView,
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["inventory-assignments"],
    queryFn: () => listAss(),
    enabled: canView,
  });
  const { data: patients = [] } = useQuery({
    queryKey: ["inventory-patients"],
    queryFn: () => listPts(),
    enabled: canView,
  });
  const { data: purchases = [] } = useQuery({
    queryKey: ["inventory-purchases"],
    queryFn: () => listPurch({ data: {} }),
    enabled: canView,
  });

  const [itemOpen, setItemOpen] = useState(false);
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [itemForm, setItemForm] = useState<InventoryItemValues>(emptyItem);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<AssignmentValues>(emptyAssign);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseValues>(emptyPurchase);
  const [q, setQ] = useState("");

  const filteredItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items as ItemRow[];
    return (items as ItemRow[]).filter((r) =>
      [r.name_en, r.name_bn, r.sku]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(term)),
    );
  }, [items, q]);

  const lowStock = (items as ItemRow[]).filter(
    (i) => i.reorder_level > 0 && i.stock_qty <= i.reorder_level,
  );

  const saveItem = useMutation({
    mutationFn: () => upsertItem({ data: { id: editing?.id, values: itemForm } }),
    onSuccess: () => {
      toast.success(editing ? "Item updated" : "Item added");
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      setItemOpen(false);
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => delItem({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
    },
    onError: (e) => toast.error("Delete failed", { description: (e as Error).message }),
  });

  const assign = useMutation({
    mutationFn: () => createAss({ data: assignForm }),
    onSuccess: () => {
      toast.success("Assigned");
      qc.invalidateQueries({ queryKey: ["inventory-assignments"] });
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      setAssignOpen(false);
    },
    onError: (e) => toast.error("Assignment failed", { description: (e as Error).message }),
  });

  const changeStatus = useMutation({
    mutationFn: (v: { id: string; status: "active" | "returned" | "consumed" | "lost" | "expired" }) =>
      updAss({ data: v }),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["inventory-assignments"] });
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
    },
    onError: (e) => toast.error("Update failed", { description: (e as Error).message }),
  });

  const receive = useMutation({
    mutationFn: () => createPurch({ data: purchaseForm }),
    onSuccess: () => {
      toast.success(`Added ${purchaseForm.quantity} to stock`);
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-purchases"] });
      setPurchaseOpen(false);
    },
    onError: (e) => toast.error("Receive failed", { description: (e as Error).message }),
  });

  const removePurch = useMutation({
    mutationFn: (id: string) => delPurch({ data: { id } }),
    onSuccess: () => {
      toast.success("Purchase removed");
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-purchases"] });
    },
    onError: (e) => toast.error("Delete failed", { description: (e as Error).message }),
  });

  function openNewItem() {
    setEditing(null);
    setItemForm(emptyItem);
    setItemOpen(true);
  }
  function openEditItem(r: ItemRow) {
    setEditing(r);
    setItemForm({
      name_en: r.name_en,
      name_bn: r.name_bn ?? "",
      sku: r.sku ?? "",
      category: r.category,
      is_returnable: r.is_returnable,
      unit_price_bdt: Number(r.unit_price_bdt),
      stock_qty: r.stock_qty,
      reorder_level: r.reorder_level,
      lifespan_days: r.lifespan_days ?? null,
      notes: r.notes ?? "",
      is_active: r.is_active,
    });
    setItemOpen(true);
  }
  function openAssign() {
    setAssignForm({ ...emptyAssign });
    setAssignOpen(true);
  }
  function openReceive(itemId?: string) {
    setPurchaseForm({ ...emptyPurchase, item_id: itemId ?? "" });
    setPurchaseOpen(true);
  }

  if (!canView) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You do not have access to this page.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Devices, CGM sensors, consumables, and per-patient assignments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openReceive()}>
            <Truck className="h-4 w-4 mr-2" />
            Receive stock
          </Button>
          <Button variant="outline" onClick={openAssign}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Assign to patient
          </Button>
          <Button onClick={openNewItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Low stock ({lowStock.length})
            </CardTitle>
            <CardDescription className="text-amber-900/70">
              Items at or below their reorder level.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-amber-900">
            {lowStock.map((i) => (
              <div key={i.id} className="flex justify-between border-b border-amber-200/60 py-1 last:border-0">
                <span>{i.name_en}</span>
                <span className="font-mono">
                  {i.stock_qty} / {i.reorder_level}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">
            <Package className="h-4 w-4 mr-2" /> Items ({items.length})
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <ArrowLeftRight className="h-4 w-4 mr-2" /> Assignments ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="purchases">
            <Truck className="h-4 w-4 mr-2" /> Purchases ({(purchases as any[]).length})
          </TabsTrigger>
          <TabsTrigger value="forecast">
            <AlertTriangle className="h-4 w-4 mr-2" /> Forecast
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forecast" className="mt-4">
          <InventoryInsights />
        </TabsContent>


        <TabsContent value="items" className="mt-4 space-y-3">
          <Input
            placeholder="Search items..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price (৳)</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No items yet.
                    </TableCell>
                  </TableRow>
                )}
                {filteredItems.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name_en}</div>
                      {r.name_bn && (
                        <div className="text-xs text-muted-foreground">{r.name_bn}</div>
                      )}
                      {r.sku && <div className="text-xs text-muted-foreground">SKU: {r.sku}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{CAT_LABELS[r.category]}</Badge>
                      {r.is_returnable && (
                        <Badge variant="outline" className="ml-1">
                          Returnable
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {Number(r.unit_price_bdt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono">
                      <span
                        className={
                          r.reorder_level > 0 && r.stock_qty <= r.reorder_level
                            ? "text-amber-700 font-semibold"
                            : ""
                        }
                      >
                        {r.stock_qty}
                      </span>
                      {r.reorder_level > 0 && (
                        <span className="text-xs text-muted-foreground"> / {r.reorder_level}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.is_active ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openReceive(r.id)}>
                        Receive
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEditItem(r)}>
                        Edit
                      </Button>
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Delete ${r.name_en}?`)) removeItem.mutate(r.id);
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(assignments as any[]).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No assignments yet.
                    </TableCell>
                  </TableRow>
                )}
                {(assignments as any[]).map((a) => {
                  const expiring =
                    a.expires_at &&
                    new Date(a.expires_at).getTime() - Date.now() < 3 * 24 * 3600 * 1000 &&
                    a.status === "active";
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.patient?.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.patient?.patient_code}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{a.item?.name_en}</div>
                        <Badge variant="secondary" className="text-xs">
                          {CAT_LABELS[a.item?.category ?? "other"]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{a.quantity}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(a.assigned_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.expires_at ? (
                          <span className={expiring ? "text-amber-700 font-semibold" : ""}>
                            {new Date(a.expires_at).toLocaleDateString()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {a.status === "active" && a.item?.is_returnable && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => changeStatus.mutate({ id: a.id, status: "returned" })}
                          >
                            Mark returned
                          </Button>
                        )}
                        {a.status === "active" && !a.item?.is_returnable && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => changeStatus.mutate({ id: a.id, status: "consumed" })}
                          >
                            Mark consumed
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit cost (৳)</TableHead>
                  <TableHead>Total (৳)</TableHead>
                  <TableHead>Supplier / Invoice</TableHead>
                  {canDelete && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(purchases as any[]).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canDelete ? 7 : 6} className="text-center text-muted-foreground py-8">
                      No purchases logged yet. Click "Receive stock" to add one.
                    </TableCell>
                  </TableRow>
                )}
                {(purchases as any[]).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">
                      {new Date(p.purchased_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{p.item?.name_en ?? "—"}</TableCell>
                    <TableCell className="font-mono">+{p.quantity}</TableCell>
                    <TableCell className="font-mono">
                      {Number(p.unit_cost_bdt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono">
                      {Number(p.total_cost_bdt ?? p.quantity * p.unit_cost_bdt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.supplier && <div>{p.supplier}</div>}
                      {p.invoice_no && (
                        <div className="text-muted-foreground">#{p.invoice_no}</div>
                      )}
                    </TableCell>
                    {canDelete && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Remove this purchase? Stock will be reduced.")) {
                              removePurch.mutate(p.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Item dialog */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit item" : "Add inventory item"}</DialogTitle>
            <DialogDescription>Devices, sensors, consumables and more.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveItem.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name (English)</Label>
                <Input
                  required
                  value={itemForm.name_en}
                  onChange={(e) => setItemForm({ ...itemForm, name_en: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Name (Bengali)</Label>
                <Input
                  value={itemForm.name_bn ?? ""}
                  onChange={(e) => setItemForm({ ...itemForm, name_bn: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>SKU</Label>
                <Input
                  value={itemForm.sku ?? ""}
                  onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select
                  value={itemForm.category}
                  onValueChange={(v) => setItemForm({ ...itemForm, category: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Unit price (৳)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={itemForm.unit_price_bdt}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, unit_price_bdt: num(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Stock qty</Label>
                <Input
                  type="number"
                  min={0}
                  value={itemForm.stock_qty}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, stock_qty: Math.floor(num(e.target.value)) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Reorder level</Label>
                <Input
                  type="number"
                  min={0}
                  value={itemForm.reorder_level}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, reorder_level: Math.floor(num(e.target.value)) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Lifespan (days)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 14 for CGM"
                  value={itemForm.lifespan_days ?? ""}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      lifespan_days: e.target.value ? Math.floor(num(e.target.value)) : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={itemForm.notes ?? ""}
                onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <Label htmlFor="ret" className="cursor-pointer">
                Returnable (device/deposit)
              </Label>
              <Switch
                id="ret"
                checked={itemForm.is_returnable}
                onCheckedChange={(v) => setItemForm({ ...itemForm, is_returnable: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="act" className="cursor-pointer">
                Active
              </Label>
              <Switch
                id="act"
                checked={itemForm.is_active}
                onCheckedChange={(v) => setItemForm({ ...itemForm, is_active: v })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setItemOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveItem.isPending}>
                {saveItem.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assignment dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign item to patient</DialogTitle>
            <DialogDescription>
              Stock is decremented on save. Expiry auto-fills from lifespan.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!assignForm.item_id || !assignForm.patient_id) {
                toast.error("Select item and patient");
                return;
              }
              assign.mutate();
            }}
          >
            <div className="space-y-1">
              <Label>Patient</Label>
              <Select
                value={assignForm.patient_id}
                onValueChange={(v) => setAssignForm({ ...assignForm, patient_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {(patients as any[]).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.patient_code} — {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Item</Label>
              <Select
                value={assignForm.item_id}
                onValueChange={(v) => setAssignForm({ ...assignForm, item_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {(items as ItemRow[])
                    .filter((i) => i.is_active && i.stock_qty > 0)
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name_en} · stock {i.stock_qty}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={assignForm.quantity}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      quantity: Math.max(1, Math.floor(num(e.target.value))),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Deposit (৳)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={assignForm.deposit_bdt}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, deposit_bdt: num(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Assigned on</Label>
                <Input
                  type="date"
                  value={assignForm.assigned_at ?? ""}
                  onChange={(e) => setAssignForm({ ...assignForm, assigned_at: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Expires (optional)</Label>
                <Input
                  type="date"
                  value={assignForm.expires_at ?? ""}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, expires_at: e.target.value || null })
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={assignForm.notes ?? ""}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={assign.isPending}>
                {assign.isPending ? "Assigning..." : "Assign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive stock dialog */}
      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receive stock</DialogTitle>
            <DialogDescription>
              Logs a purchase and adds the quantity to the item's available stock.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!purchaseForm.item_id) {
                toast.error("Select an item");
                return;
              }
              receive.mutate();
            }}
          >
            <div className="space-y-1">
              <Label>Item</Label>
              <Select
                value={purchaseForm.item_id}
                onValueChange={(v) => setPurchaseForm({ ...purchaseForm, item_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {(items as ItemRow[]).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name_en} · current stock {i.stock_qty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quantity purchased</Label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={purchaseForm.quantity}
                  onChange={(e) =>
                    setPurchaseForm({
                      ...purchaseForm,
                      quantity: Math.max(1, Math.floor(num(e.target.value))),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Unit cost (৳)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={purchaseForm.unit_cost_bdt}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, unit_cost_bdt: num(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Purchased on</Label>
                <Input
                  type="date"
                  value={purchaseForm.purchased_at ?? ""}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, purchased_at: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Invoice no.</Label>
                <Input
                  value={purchaseForm.invoice_no ?? ""}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, invoice_no: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Input
                value={purchaseForm.supplier ?? ""}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={purchaseForm.notes ?? ""}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
              />
            </div>
            <div className="rounded-md bg-muted p-2 text-sm">
              Total:{" "}
              <span className="font-mono font-semibold">
                ৳{(purchaseForm.quantity * purchaseForm.unit_cost_bdt).toLocaleString()}
              </span>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPurchaseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={receive.isPending}>
                {receive.isPending ? "Saving..." : "Add to stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
