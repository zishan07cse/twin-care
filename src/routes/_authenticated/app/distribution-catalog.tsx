import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listTradeCatalog,
  updateItemTradeFields,
  upsertTierPrice,
  listStockAllocations,
  allocateStock,
} from "@/lib/dealers.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";

type CatalogItem = {
  id: string;
  name_en: string;
  name_bn: string | null;
  sku: string | null;
  category: string;
  unit_price_bdt: number;
  mrp_bdt: number;
  stock_qty: number;
  trade_stock_qty: number;
  is_trade_sellable: boolean;
  is_active: boolean;
};
type TierPrice = { id: string; item_id: string; tier: string; unit_price_bdt: number };

export const Route = createFileRoute("/_authenticated/app/distribution-catalog")({
  component: DistributionCatalog,
});

function DistributionCatalog() {
  const { hasAnyRole } = useAuth();
  const canView = hasAnyRole([
    "super_admin",
    "admin",
    "care_coordinator",
    "finance",
    "inventory_manager",
    "sales_officer",
  ]);
  const canEdit = hasAnyRole(["super_admin", "admin", "inventory_manager"]);

  const load = useServerFn(listTradeCatalog);
  const setFields = useServerFn(updateItemTradeFields);
  const setPrice = useServerFn(upsertTierPrice);
  const allocFn = useServerFn(allocateStock);
  const listAllocFn = useServerFn(listStockAllocations);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["trade-catalog"],
    queryFn: () => load(),
    enabled: canView,
  });
  const { data: allocations = [] } = useQuery({
    queryKey: ["stock-allocations"],
    queryFn: () => listAllocFn({ data: {} }),
    enabled: canView,
  });

  const priceMap = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const p of (data?.prices ?? []) as TierPrice[]) {
      if (!m.has(p.item_id)) m.set(p.item_id, {});
      m.get(p.item_id)![p.tier] = Number(p.unit_price_bdt);
    }
    return m;
  }, [data]);

  const [allocOpen, setAllocOpen] = useState(false);
  const [allocItem, setAllocItem] = useState<CatalogItem | null>(null);
  const [allocForm, setAllocForm] = useState<{
    from_pool: "program" | "trade";
    to_pool: "program" | "trade";
    quantity: number;
    note: string;
  }>({ from_pool: "program", to_pool: "trade", quantity: 1, note: "" });

  const saveFields = useMutation({
    mutationFn: (v: { id: string; mrp_bdt: number; is_trade_sellable: boolean }) =>
      setFields({ data: v }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["trade-catalog"] });
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });
  const savePrice = useMutation({
    mutationFn: (v: {
      item_id: string;
      tier: "distributor" | "dealer" | "retailer";
      unit_price_bdt: number;
    }) => setPrice({ data: v }),
    onSuccess: () => {
      toast.success("Price updated");
      qc.invalidateQueries({ queryKey: ["trade-catalog"] });
    },
    onError: (e) => toast.error("Update failed", { description: (e as Error).message }),
  });
  const doAlloc = useMutation({
    mutationFn: () =>
      allocFn({
        data: {
          item_id: allocItem!.id,
          from_pool: allocForm.from_pool,
          to_pool: allocForm.to_pool,
          quantity: allocForm.quantity,
          note: allocForm.note || null,
        },
      }),
    onSuccess: () => {
      toast.success("Stock moved");
      qc.invalidateQueries({ queryKey: ["trade-catalog"] });
      qc.invalidateQueries({ queryKey: ["stock-allocations"] });
      setAllocOpen(false);
    },
    onError: (e) => toast.error("Move failed", { description: (e as Error).message }),
  });

  if (!canView) {
    return (
      <div className="p-6 text-sm text-muted-foreground">You do not have access to this page.</div>
    );
  }

  const items = (data?.items ?? []) as CatalogItem[];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Trade catalog</h1>
        <p className="text-sm text-muted-foreground">
          Manage MRP, dealer/distributor/retailer price tiers, and allocate stock between the patient
          program and the dealer trade pool.
        </p>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog & pricing</TabsTrigger>
          <TabsTrigger value="allocations">Allocation log</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
              ) : items.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  No inventory items yet. Add them from the Inventory page first.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Cat.</TableHead>
                      <TableHead className="text-right">Program stock</TableHead>
                      <TableHead className="text-right">Trade stock</TableHead>
                      <TableHead className="text-right">MRP ৳</TableHead>
                      <TableHead className="text-right">Distributor ৳</TableHead>
                      <TableHead className="text-right">Dealer ৳</TableHead>
                      <TableHead className="text-right">Retailer ৳</TableHead>
                      <TableHead>Trade sellable</TableHead>
                      <TableHead>Move</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <CatalogRow
                        key={it.id}
                        item={it}
                        prices={priceMap.get(it.id) ?? {}}
                        canEdit={canEdit}
                        onSaveFields={(mrp, sellable) =>
                          saveFields.mutate({
                            id: it.id,
                            mrp_bdt: mrp,
                            is_trade_sellable: sellable,
                          })
                        }
                        onSavePrice={(tier, price) =>
                          savePrice.mutate({ item_id: it.id, tier, unit_price_bdt: price })
                        }
                        onAllocate={() => {
                          setAllocItem(it);
                          setAllocForm({
                            from_pool: "program",
                            to_pool: "trade",
                            quantity: 1,
                            note: "",
                          });
                          setAllocOpen(true);
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock movement history</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {(allocations as Array<{
                id: string;
                created_at: string;
                from_pool: string;
                to_pool: string;
                quantity: number;
                note: string | null;
                item: { name_en: string } | null;
              }>).length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  No stock allocations yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(allocations as Array<{
                      id: string;
                      created_at: string;
                      from_pool: string;
                      to_pool: string;
                      quantity: number;
                      note: string | null;
                      item: { name_en: string } | null;
                    }>).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs">
                          {new Date(a.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>{a.item?.name_en ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {a.from_pool}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {a.to_pool}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{a.quantity}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.note ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={allocOpen} onOpenChange={setAllocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move stock — {allocItem?.name_en}</DialogTitle>
            <DialogDescription>
              Transfer units between the patient program pool and the dealer trade pool.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>From</Label>
                <Select
                  value={allocForm.from_pool}
                  onValueChange={(v) =>
                    setAllocForm({
                      ...allocForm,
                      from_pool: v as "program" | "trade",
                      to_pool: v === "program" ? "trade" : "program",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="program">
                      Program pool ({allocItem?.stock_qty ?? 0})
                    </SelectItem>
                    <SelectItem value="trade">
                      Trade pool ({allocItem?.trade_stock_qty ?? 0})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input
                  value={allocForm.to_pool === "program" ? "Program pool" : "Trade pool"}
                  disabled
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={allocForm.quantity}
                onChange={(e) =>
                  setAllocForm({ ...allocForm, quantity: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Textarea
                rows={2}
                value={allocForm.note}
                onChange={(e) => setAllocForm({ ...allocForm, note: e.target.value })}
                placeholder="Reason / reference (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => doAlloc.mutate()} disabled={doAlloc.isPending || !canEdit}>
              {doAlloc.isPending ? "Moving…" : "Move stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CatalogRow({
  item,
  prices,
  canEdit,
  onSaveFields,
  onSavePrice,
  onAllocate,
}: {
  item: CatalogItem;
  prices: Record<string, number>;
  canEdit: boolean;
  onSaveFields: (mrp: number, sellable: boolean) => void;
  onSavePrice: (tier: "distributor" | "dealer" | "retailer", price: number) => void;
  onAllocate: () => void;
}) {
  const [mrp, setMrp] = useState<number>(Number(item.mrp_bdt) || 0);
  const [sellable, setSellable] = useState<boolean>(item.is_trade_sellable);
  const [distributor, setDistributor] = useState<number>(prices.distributor ?? 0);
  const [dealer, setDealer] = useState<number>(prices.dealer ?? 0);
  const [retailer, setRetailer] = useState<number>(prices.retailer ?? 0);

  const dirtyFields = mrp !== Number(item.mrp_bdt) || sellable !== item.is_trade_sellable;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{item.name_en}</div>
        <div className="text-xs text-muted-foreground">{item.sku ?? "—"}</div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize text-xs">
          {item.category}
        </Badge>
      </TableCell>
      <TableCell className="text-right">{item.stock_qty}</TableCell>
      <TableCell className="text-right font-medium">{item.trade_stock_qty}</TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          min={0}
          className="h-8 w-24 ml-auto"
          value={mrp}
          onChange={(e) => setMrp(Number(e.target.value) || 0)}
          onBlur={() => dirtyFields && canEdit && onSaveFields(mrp, sellable)}
          disabled={!canEdit}
        />
      </TableCell>
      {(["distributor", "dealer", "retailer"] as const).map((tier) => {
        const val = tier === "distributor" ? distributor : tier === "dealer" ? dealer : retailer;
        const set = tier === "distributor" ? setDistributor : tier === "dealer" ? setDealer : setRetailer;
        return (
          <TableCell key={tier} className="text-right">
            <Input
              type="number"
              min={0}
              className="h-8 w-24 ml-auto"
              value={val}
              onChange={(e) => set(Number(e.target.value) || 0)}
              onBlur={() => {
                if (!canEdit) return;
                if (val !== (prices[tier] ?? 0)) onSavePrice(tier, val);
              }}
              disabled={!canEdit}
            />
          </TableCell>
        );
      })}
      <TableCell>
        <Switch
          checked={sellable}
          onCheckedChange={(v) => {
            setSellable(v);
            if (canEdit) onSaveFields(mrp, v);
          }}
          disabled={!canEdit}
        />
      </TableCell>
      <TableCell>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onAllocate}
          disabled={!canEdit}
        >
          <ArrowLeftRight className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
