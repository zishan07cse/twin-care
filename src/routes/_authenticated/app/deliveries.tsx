import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listChallans,
  createChallan,
  listSalesOrders,
  getSalesOrder,
} from "@/lib/distribution.functions";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/deliveries")({
  component: DeliveriesPage,
});

type LineDraft = {
  order_item_id: string;
  item_id: string;
  item_name: string;
  remaining: number;
  delivered_qty: number;
  serials: string;
  batch_no: string;
  expiry_date: string;
  unit_price_bdt: number;
};

function DeliveriesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listChallans);
  const createFn = useServerFn(createChallan);
  const ordersFn = useServerFn(listSalesOrders);
  const getFn = useServerFn(getSalesOrder);

  const challans = useQuery({ queryKey: ["challans"], queryFn: () => listFn() });
  const orders = useQuery({ queryKey: ["sales-orders"], queryFn: () => ordersFn({ data: {} }) });

  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [dispatch_date, setDispatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [courier, setCourier] = useState("");
  const [transportRef, setTransportRef] = useState("");
  const [notes, setNotes] = useState("");
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [lines, setLines] = useState<LineDraft[]>([]);

  const openOrders = orders.data?.filter((o: any) =>
    ["confirmed", "partially_delivered"].includes(o.status),
  );

  const orderDetail = useQuery({
    queryKey: ["sales-order", orderId],
    queryFn: async () => {
      const d = await getFn({ data: { id: orderId } });
      setLines(
        d.items
          .map((it: any) => ({
            order_item_id: it.id,
            item_id: it.item_id,
            item_name: it.item?.name_en ?? "",
            remaining: it.quantity - it.delivered_qty,
            delivered_qty: it.quantity - it.delivered_qty,
            serials: "",
            batch_no: "",
            expiry_date: "",
            unit_price_bdt: Number(it.unit_price_bdt),
          }))
          .filter((l: any) => l.remaining > 0),
      );
      return d;
    },
    enabled: !!orderId,
  });

  const create = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          order_id: orderId,
          dispatch_date,
          courier: courier || null,
          transport_ref: transportRef || null,
          notes: notes || null,
          auto_invoice: autoInvoice,
          items: lines
            .filter((l: any) => l.delivered_qty > 0)
            .map((l: any) => ({
              order_item_id: l.order_item_id,
              item_id: l.item_id,
              delivered_qty: l.delivered_qty,
              serials: l.serials || null,
              batch_no: l.batch_no || null,
              expiry_date: l.expiry_date || null,
              unit_price_bdt: l.unit_price_bdt,
            })),
        },
      }),
    onSuccess: (r) => {
      toast.success(r.invoice_id ? "Challan created + invoice generated" : "Challan created");
      setOpen(false);
      setOrderId("");
      setLines([]);
      qc.invalidateQueries({ queryKey: ["challans"] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      qc.invalidateQueries({ queryKey: ["trade-invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deliveries</h1>
          <p className="text-sm text-muted-foreground">Delivery challans against sales orders</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New challan
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Challan #</TableHead>
                <TableHead>Order #</TableHead>
                <TableHead>Dealer</TableHead>
                <TableHead>Dispatch date</TableHead>
                <TableHead>Courier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challans.data?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.challan_no}</TableCell>
                  <TableCell className="font-mono text-xs">{c.order?.order_no}</TableCell>
                  <TableCell>{c.dealer?.business_name}</TableCell>
                  <TableCell>{c.dispatch_date}</TableCell>
                  <TableCell>{c.courier ?? "—"}</TableCell>
                </TableRow>
              ))}
              {challans.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No deliveries yet
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
            <DialogTitle>New delivery challan</DialogTitle>
            <DialogDescription>Deducts from trade stock and generates invoice</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sales order</Label>
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select order" />
                  </SelectTrigger>
                  <SelectContent>
                    {openOrders?.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.order_no} · {o.dealer?.business_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dispatch date</Label>
                <Input
                  type="date"
                  value={dispatch_date}
                  onChange={(e) => setDispatchDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Courier</Label>
                <Input value={courier} onChange={(e) => setCourier(e.target.value)} />
              </div>
              <div>
                <Label>Transport ref</Label>
                <Input value={transportRef} onChange={(e) => setTransportRef(e.target.value)} />
              </div>
            </div>

            {orderDetail.data && lines.length > 0 && (
              <div>
                <Label className="mb-2 block">Deliver items</Label>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {lines.map((l: any, i: number) => (
                    <div key={l.order_item_id} className="border rounded p-2 text-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{l.item_name}</div>
                        <div className="text-xs text-muted-foreground">Remaining {l.remaining}</div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs">Deliver qty</Label>
                          <Input
                            type="number"
                            max={l.remaining}
                            value={l.delivered_qty}
                            onChange={(e) => {
                              const next = [...lines];
                              next[i] = { ...next[i], delivered_qty: Number(e.target.value) };
                              setLines(next);
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Batch</Label>
                          <Input
                            value={l.batch_no}
                            onChange={(e) => {
                              const next = [...lines];
                              next[i] = { ...next[i], batch_no: e.target.value };
                              setLines(next);
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Expiry</Label>
                          <Input
                            type="date"
                            value={l.expiry_date}
                            onChange={(e) => {
                              const next = [...lines];
                              next[i] = { ...next[i], expiry_date: e.target.value };
                              setLines(next);
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Unit price</Label>
                          <Input
                            type="number"
                            value={l.unit_price_bdt}
                            onChange={(e) => {
                              const next = [...lines];
                              next[i] = { ...next[i], unit_price_bdt: Number(e.target.value) };
                              setLines(next);
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Serials (comma or newline)</Label>
                        <Textarea
                          rows={2}
                          value={l.serials}
                          onChange={(e) => {
                            const next = [...lines];
                            next[i] = { ...next[i], serials: e.target.value };
                            setLines(next);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={autoInvoice}
                onCheckedChange={(v) => setAutoInvoice(v === true)}
              />
              Auto-generate invoice from this challan
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!orderId || lines.every((l: any) => l.delivered_qty <= 0) || create.isPending}
              onClick={() => create.mutate()}
            >
              Create challan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
