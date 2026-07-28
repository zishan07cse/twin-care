import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSalesOrders,
  createSalesOrder,
  updateOrderStatus,
  getSalesOrder,
} from "@/lib/distribution.functions";
import { listDealers } from "@/lib/dealers.functions";
import { listTradeCatalog } from "@/lib/dealers.functions";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Eye } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/sales-orders")({
  component: SalesOrdersPage,
});

type Line = {
  item_id: string;
  quantity: number;
  unit_price_bdt: number;
  discount_pct: number;
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  partially_delivered: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closed: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  cancelled: "bg-destructive/15 text-destructive",
};

function SalesOrdersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSalesOrders);
  const createFn = useServerFn(createSalesOrder);
  const statusFn = useServerFn(updateOrderStatus);
  const dealersFn = useServerFn(listDealers);
  const catalogFn = useServerFn(listTradeCatalog);
  const getFn = useServerFn(getSalesOrder);

  const orders = useQuery({ queryKey: ["sales-orders"], queryFn: () => listFn({ data: {} }) });
  const dealers = useQuery({ queryKey: ["dealers"], queryFn: () => dealersFn() });
  const catalog = useQuery({ queryKey: ["trade-catalog"], queryFn: () => catalogFn() });

  const [open, setOpen] = useState(false);
  const [dealer_id, setDealerId] = useState("");
  const [notes, setNotes] = useState("");
  const [vatPct, setVatPct] = useState(15);
  const [aitPct, setAitPct] = useState(5);
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([{ item_id: "", quantity: 1, unit_price_bdt: 0, discount_pct: 0 }]);
  const [viewId, setViewId] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["sales-order", viewId],
    queryFn: () => getFn({ data: { id: viewId! } }),
    enabled: !!viewId,
  });

  const selectedDealer = dealers.data?.find((d: any) => d.id === dealer_id);
  const tier = selectedDealer?.price_tier ?? "dealer";

  const priceFor = (item_id: string) => {
    if (!catalog.data) return 0;
    const tp = catalog.data.prices.find((p: any) => p.item_id === item_id && p.tier === tier);
    if (tp) return Number(tp.unit_price_bdt);
    const it = catalog.data.items.find((i: any) => i.id === item_id);
    return Number(it?.mrp_bdt ?? 0);
  };

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (s, l) => s + l.quantity * l.unit_price_bdt * (1 - l.discount_pct / 100),
      0,
    );
    const taxable = Math.max(subtotal - discount, 0);
    const vat = taxable * (vatPct / 100);
    const ait = taxable * (aitPct / 100);
    return { subtotal, vat, ait, total: taxable + vat + ait };
  }, [lines, discount, vatPct, aitPct]);

  const resetForm = () => {
    setDealerId("");
    setNotes("");
    setDiscount(0);
    setLines([{ item_id: "", quantity: 1, unit_price_bdt: 0, discount_pct: 0 }]);
  };

  const create = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          dealer_id,
          vat_pct: vatPct,
          ait_pct: aitPct,
          discount_bdt: discount,
          notes: notes || null,
          items: lines.filter((l: any) => l.item_id && l.quantity > 0),
        },
      }),
    onSuccess: () => {
      toast.success("Sales order created");
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      statusFn({ data: { id, status: status as "confirmed" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales-orders"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sales orders</h1>
          <p className="text-sm text-muted-foreground">Dealer purchase orders</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New order
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Dealer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total (৳)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.data?.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_no}</TableCell>
                  <TableCell>{o.order_date}</TableCell>
                  <TableCell>{o.dealer?.business_name}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLOR[o.status] ?? ""} variant="secondary">
                      {o.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{Number(o.total_bdt).toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {o.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => changeStatus.mutate({ id: o.id, status: "confirmed" })}
                      >
                        Confirm
                      </Button>
                    )}
                    {["confirmed", "partially_delivered", "delivered"].includes(o.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => changeStatus.mutate({ id: o.id, status: "cancelled" })}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setViewId(o.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {orders.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No orders yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>New sales order</DialogTitle>
            <DialogDescription>Prices auto-fill from dealer tier</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dealer</Label>
                <Select value={dealer_id} onValueChange={setDealerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dealer" />
                  </SelectTrigger>
                  <SelectContent>
                    {dealers.data?.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.dealer_code} · {d.business_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>VAT %</Label>
                  <Input
                    type="number"
                    value={vatPct}
                    onChange={(e) => setVatPct(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>AIT %</Label>
                  <Input
                    type="number"
                    value={aitPct}
                    onChange={(e) => setAitPct(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Line items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setLines([...lines, { item_id: "", quantity: 1, unit_price_bdt: 0, discount_pct: 0 }])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add line
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((l: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Select
                        value={l.item_id}
                        onValueChange={(v) => {
                          const price = priceFor(v);
                          const next = [...lines];
                          next[i] = { ...next[i], item_id: v, unit_price_bdt: price };
                          setLines(next);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Item" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalog.data?.items
                            .filter((it: any) => it.is_trade_sellable)
                            .map((it: any) => (
                              <SelectItem key={it.id} value={it.id}>
                                {it.name_en} · stock {it.trade_stock_qty}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={l.quantity}
                        onChange={(e) => {
                          const next = [...lines];
                          next[i] = { ...next[i], quantity: Number(e.target.value) };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Price"
                        value={l.unit_price_bdt}
                        onChange={(e) => {
                          const next = [...lines];
                          next[i] = { ...next[i], unit_price_bdt: Number(e.target.value) };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Disc %"
                        value={l.discount_pct}
                        onChange={(e) => {
                          const next = [...lines];
                          next[i] = { ...next[i], discount_pct: Number(e.target.value) };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLines(lines.filter((_: any, j: number) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount (৳)</Label>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>৳{totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT ({vatPct}%)</span>
                <span>৳{totals.vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>AIT ({aitPct}%)</span>
                <span>৳{totals.ait.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Total</span>
                <span>৳{totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!dealer_id || lines.every((l: any) => !l.item_id) || create.isPending}
              onClick={() => create.mutate()}
            >
              Create order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Order {detail.data?.order?.order_no}</DialogTitle>
            <DialogDescription>
              {detail.data?.order?.dealer?.business_name} · {detail.data?.order?.status}
            </DialogDescription>
          </DialogHeader>
          {detail.data && (
            <div className="space-y-3">
              <Card>
                <CardHeader className="py-2">
                  <CardTitle className="text-sm">Items</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Ordered</TableHead>
                        <TableHead className="text-right">Delivered</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.data.items.map((it: any) => (
                        <TableRow key={it.id}>
                          <TableCell>{it.item?.name_en}</TableCell>
                          <TableCell className="text-right">{it.quantity}</TableCell>
                          <TableCell className="text-right">{it.delivered_qty}</TableCell>
                          <TableCell className="text-right">৳{Number(it.unit_price_bdt).toLocaleString()}</TableCell>
                          <TableCell className="text-right">৳{Number(it.line_total_bdt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              {detail.data.challans.length > 0 && (
                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm">Challans</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Challan #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Courier</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.data.challans.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.challan_no}</TableCell>
                            <TableCell>{c.dispatch_date}</TableCell>
                            <TableCell>{c.courier ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
