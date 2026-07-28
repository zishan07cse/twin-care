import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  dealerAgingReport,
  getDealerStatement,
  listCreditNotes,
  createCreditNote,
  listDebitNotes,
  createDebitNote,
  listSalesReturns,
  createSalesReturn,
  updateReturnStatus,
  listWarrantyClaims,
  createWarrantyClaim,
  updateWarrantyStatus,
} from "@/lib/distribution.functions";
import { listDealers } from "@/lib/dealers.functions";
import { listTradeCatalog } from "@/lib/dealers.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/dealer-ledger")({
  component: DealerLedgerPage,
});

function DealerLedgerPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dealer ledger & receivables</h1>
        <p className="text-sm text-muted-foreground">
          Aging, statements, credit/debit notes, returns & warranty claims
        </p>
      </div>

      <Tabs defaultValue="aging">
        <TabsList>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
          <TabsTrigger value="cn">Credit notes</TabsTrigger>
          <TabsTrigger value="dn">Debit notes</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="warranty">Warranty</TabsTrigger>
        </TabsList>
        <TabsContent value="aging" className="mt-4">
          <AgingTab />
        </TabsContent>
        <TabsContent value="statement" className="mt-4">
          <StatementTab />
        </TabsContent>
        <TabsContent value="cn" className="mt-4">
          <CreditNotesTab />
        </TabsContent>
        <TabsContent value="dn" className="mt-4">
          <DebitNotesTab />
        </TabsContent>
        <TabsContent value="returns" className="mt-4">
          <ReturnsTab />
        </TabsContent>
        <TabsContent value="warranty" className="mt-4">
          <WarrantyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const money = (n: number) => `৳${Number(n).toLocaleString()}`;

function AgingTab() {
  const fn = useServerFn(dealerAgingReport);
  const q = useQuery({ queryKey: ["dealer-aging"], queryFn: () => fn() });
  const totals = (q.data ?? []).reduce(
    (acc, r) => {
      acc.current += r.current;
      acc.d30 += r.d30;
      acc.d60 += r.d60;
      acc.d90 += r.d90;
      acc.d90plus += r.d90plus;
      acc.outstanding += r.outstanding;
      return acc;
    },
    { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, outstanding: 0 },
  );
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dealer</TableHead>
              <TableHead className="text-right">Credit limit</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">1–30d</TableHead>
              <TableHead className="text-right">31–60d</TableHead>
              <TableHead className="text-right">61–90d</TableHead>
              <TableHead className="text-right">90+d</TableHead>
              <TableHead className="text-right font-semibold">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data?.map((r) => {
              const breach = r.credit_limit_bdt > 0 && r.outstanding > r.credit_limit_bdt;
              return (
                <TableRow key={r.dealer_id}>
                  <TableCell>
                    <div className="font-medium">{r.business_name}</div>
                    <div className="text-xs text-muted-foreground">{r.dealer_code}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.credit_limit_bdt > 0 ? money(r.credit_limit_bdt) : "—"}
                    {breach && <Badge variant="destructive" className="ml-1">breach</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{money(r.current)}</TableCell>
                  <TableCell className="text-right">{money(r.d30)}</TableCell>
                  <TableCell className="text-right text-amber-700">{money(r.d60)}</TableCell>
                  <TableCell className="text-right text-orange-700">{money(r.d90)}</TableCell>
                  <TableCell className="text-right text-destructive">{money(r.d90plus)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(r.outstanding)}</TableCell>
                </TableRow>
              );
            })}
            {(q.data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No outstanding invoices
                </TableCell>
              </TableRow>
            )}
            {(q.data?.length ?? 0) > 0 && (
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell colSpan={2}>Totals</TableCell>
                <TableCell className="text-right">{money(totals.current)}</TableCell>
                <TableCell className="text-right">{money(totals.d30)}</TableCell>
                <TableCell className="text-right">{money(totals.d60)}</TableCell>
                <TableCell className="text-right">{money(totals.d90)}</TableCell>
                <TableCell className="text-right">{money(totals.d90plus)}</TableCell>
                <TableCell className="text-right">{money(totals.outstanding)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DealerPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const listFn = useServerFn(listDealers);
  const q = useQuery({ queryKey: ["dealers"], queryFn: () => listFn() });
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select dealer" />
      </SelectTrigger>
      <SelectContent>
        {q.data?.map((d: { id: string; dealer_code: string; business_name: string }) => (
          <SelectItem key={d.id} value={d.id}>
            {d.dealer_code} · {d.business_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatementTab() {
  const [dealer, setDealer] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const fn = useServerFn(getDealerStatement);
  const q = useQuery({
    queryKey: ["dealer-statement", dealer, from, to],
    queryFn: () => fn({ data: { dealer_id: dealer, from: from || undefined, to: to || undefined } }),
    enabled: !!dealer,
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div>
          <Label>Dealer</Label>
          <DealerPicker value={dealer} onChange={setDealer} />
        </div>
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={() => window.print()} disabled={!dealer}>
            Print
          </Button>
        </div>
      </div>
      {dealer && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data?.rows.map(
                  (r: {
                    source_id: string;
                    entry_date: string;
                    entry_type: string;
                    reference: string;
                    debit_bdt: number;
                    credit_bdt: number;
                    balance_bdt: number;
                  }) => (
                    <TableRow key={`${r.entry_type}-${r.source_id}`}>
                      <TableCell>{r.entry_date}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.entry_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                      <TableCell className="text-right">
                        {Number(r.debit_bdt) > 0 ? money(r.debit_bdt) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.credit_bdt) > 0 ? money(r.credit_bdt) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">{money(r.balance_bdt)}</TableCell>
                    </TableRow>
                  ),
                )}
                {(q.data?.rows.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No entries
                    </TableCell>
                  </TableRow>
                )}
                {q.data && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell colSpan={5}>Closing balance</TableCell>
                    <TableCell className="text-right">{money(q.data.closing_balance)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CreditNotesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCreditNotes);
  const createFn = useServerFn(createCreditNote);
  const q = useQuery({ queryKey: ["credit-notes"], queryFn: () => listFn({ data: {} }) });
  const [open, setOpen] = useState(false);
  const [dealer, setDealer] = useState("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState<"return" | "discount" | "adjustment" | "damage" | "other">("adjustment");
  const [notes, setNotes] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { dealer_id: dealer, amount_bdt: amount, reason, notes: notes || null } }),
    onSuccess: () => {
      toast.success("Credit note created");
      setOpen(false);
      setDealer("");
      setAmount(0);
      setNotes("");
      qc.invalidateQueries({ queryKey: ["credit-notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New credit note
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CN #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Dealer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.map(
                (c: {
                  id: string;
                  cn_no: string;
                  cn_date: string;
                  reason: string;
                  amount_bdt: number;
                  notes: string | null;
                  dealer?: { business_name?: string };
                }) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.cn_no}</TableCell>
                    <TableCell>{c.cn_date}</TableCell>
                    <TableCell>{c.dealer?.business_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.reason}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{money(c.amount_bdt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.notes ?? "—"}</TableCell>
                  </TableRow>
                ),
              )}
              {(q.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No credit notes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New credit note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Dealer</Label>
              <DealerPicker value={dealer} onChange={setDealer} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Amount (৳)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Reason</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["return", "discount", "adjustment", "damage", "other"].map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!dealer || amount <= 0 || create.isPending}
              onClick={() => create.mutate()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DebitNotesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDebitNotes);
  const createFn = useServerFn(createDebitNote);
  const q = useQuery({ queryKey: ["debit-notes"], queryFn: () => listFn({ data: {} }) });
  const [open, setOpen] = useState(false);
  const [dealer, setDealer] = useState("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState<"freight" | "penalty" | "extra_charge" | "adjustment" | "other">("adjustment");
  const [notes, setNotes] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { dealer_id: dealer, amount_bdt: amount, reason, notes: notes || null } }),
    onSuccess: () => {
      toast.success("Debit note created");
      setOpen(false);
      setDealer("");
      setAmount(0);
      setNotes("");
      qc.invalidateQueries({ queryKey: ["debit-notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New debit note
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DN #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Dealer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.map(
                (c: {
                  id: string;
                  dn_no: string;
                  dn_date: string;
                  reason: string;
                  amount_bdt: number;
                  notes: string | null;
                  dealer?: { business_name?: string };
                }) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.dn_no}</TableCell>
                    <TableCell>{c.dn_date}</TableCell>
                    <TableCell>{c.dealer?.business_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.reason}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{money(c.amount_bdt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.notes ?? "—"}</TableCell>
                  </TableRow>
                ),
              )}
              {(q.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No debit notes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New debit note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Dealer</Label>
              <DealerPicker value={dealer} onChange={setDealer} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Amount (৳)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Reason</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["freight", "penalty", "extra_charge", "adjustment", "other"].map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!dealer || amount <= 0 || create.isPending}
              onClick={() => create.mutate()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ReturnLine = {
  item_id: string;
  quantity: number;
  good_qty: number;
  damaged_qty: number;
  unit_price_bdt: number;
};

function ReturnsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSalesReturns);
  const createFn = useServerFn(createSalesReturn);
  const statusFn = useServerFn(updateReturnStatus);
  const catalogFn = useServerFn(listTradeCatalog);
  const q = useQuery({ queryKey: ["sales-returns"], queryFn: () => listFn({ data: {} }) });
  const catalog = useQuery({ queryKey: ["trade-catalog"], queryFn: () => catalogFn() });

  const [open, setOpen] = useState(false);
  const [dealer, setDealer] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<ReturnLine[]>([]);

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          dealer_id: dealer,
          reason: reason || null,
          items: lines.filter((l) => l.item_id && l.quantity > 0),
        },
      }),
    onSuccess: () => {
      toast.success("Return recorded");
      setOpen(false);
      setDealer("");
      setReason("");
      setLines([]);
      qc.invalidateQueries({ queryKey: ["sales-returns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "restocked" | "closed" | "cancelled" }) =>
      statusFn({ data: { id, status } }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["sales-returns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New return
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Dealer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.map(
                (r: {
                  id: string;
                  return_no: string;
                  return_date: string;
                  reason: string | null;
                  status: string;
                  dealer?: { business_name?: string };
                }) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.return_no}</TableCell>
                    <TableCell>{r.return_date}</TableCell>
                    <TableCell>{r.dealer?.business_name}</TableCell>
                    <TableCell className="text-xs">{r.reason ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value=""
                        onValueChange={(v) =>
                          setStatus.mutate({
                            id: r.id,
                            status: v as "restocked" | "closed" | "cancelled",
                          })
                        }
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue placeholder="Update" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="restocked">Restock (good qty)</SelectItem>
                          <SelectItem value="closed">Close</SelectItem>
                          <SelectItem value="cancelled">Cancel</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ),
              )}
              {(q.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No returns
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record sales return</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Dealer</Label>
                <DealerPicker value={dealer} onChange={setDealer} />
              </div>
              <div>
                <Label>Reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Items</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setLines([
                      ...lines,
                      { item_id: "", quantity: 1, good_qty: 1, damaged_qty: 0, unit_price_bdt: 0 },
                    ])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Add line
                </Button>
              </div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Select
                      value={l.item_id}
                      onValueChange={(v) => {
                        const next = [...lines];
                        next[i] = { ...next[i], item_id: v };
                        setLines(next);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Item" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalog.data?.items.map(
                          (it: { id: string; sku: string | null; name_en: string }) => (
                            <SelectItem key={it.id} value={it.id}>
                              {it.sku} · {it.name_en}
                            </SelectItem>
                          ),
                        )}
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
                      placeholder="Good"
                      value={l.good_qty}
                      onChange={(e) => {
                        const next = [...lines];
                        next[i] = { ...next[i], good_qty: Number(e.target.value) };
                        setLines(next);
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Damaged"
                      value={l.damaged_qty}
                      onChange={(e) => {
                        const next = [...lines];
                        next[i] = { ...next[i], damaged_qty: Number(e.target.value) };
                        setLines(next);
                      }}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setLines(lines.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Setting status to "Restocked" adds good-qty back to trade stock automatically.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!dealer || lines.length === 0 || create.isPending}
              onClick={() => create.mutate()}
            >
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WarrantyTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listWarrantyClaims);
  const createFn = useServerFn(createWarrantyClaim);
  const statusFn = useServerFn(updateWarrantyStatus);
  const catalogFn = useServerFn(listTradeCatalog);
  const q = useQuery({ queryKey: ["warranty-claims"], queryFn: () => listFn({ data: {} }) });
  const catalog = useQuery({ queryKey: ["trade-catalog"], queryFn: () => catalogFn() });

  const [open, setOpen] = useState(false);
  const [dealer, setDealer] = useState("");
  const [item, setItem] = useState("");
  const [serial, setSerial] = useState("");
  const [batch, setBatch] = useState("");
  const [issue, setIssue] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          dealer_id: dealer,
          item_id: item,
          serial_no: serial || null,
          batch_no: batch || null,
          issue_description: issue || null,
        },
      }),
    onSuccess: () => {
      toast.success("Claim filed");
      setOpen(false);
      setDealer("");
      setItem("");
      setSerial("");
      setBatch("");
      setIssue("");
      qc.invalidateQueries({ queryKey: ["warranty-claims"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      statusFn({
        data: {
          id,
          status: status as "under_review" | "approved" | "rejected" | "replaced" | "closed",
        },
      }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["warranty-claims"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New claim
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Dealer</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.map(
                (c: {
                  id: string;
                  claim_date: string;
                  serial_no: string | null;
                  issue_description: string | null;
                  status: string;
                  dealer?: { business_name?: string };
                  item?: { name_en?: string };
                }) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.claim_date}</TableCell>
                    <TableCell>{c.dealer?.business_name}</TableCell>
                    <TableCell>{c.item?.name_en}</TableCell>
                    <TableCell className="font-mono text-xs">{c.serial_no ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">
                      {c.issue_description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value=""
                        onValueChange={(v) => setStatus.mutate({ id: c.id, status: v })}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue placeholder="Update" />
                        </SelectTrigger>
                        <SelectContent>
                          {["under_review", "approved", "rejected", "replaced", "closed"].map(
                            (s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ),
              )}
              {(q.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No claims
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New warranty claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Dealer</Label>
              <DealerPicker value={dealer} onChange={setDealer} />
            </div>
            <div>
              <Label>Item</Label>
              <Select value={item} onValueChange={setItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.data?.items.map((it: { id: string; sku: string | null; name_en: string }) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.sku} · {it.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Serial #</Label>
                <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
              </div>
              <div>
                <Label>Batch #</Label>
                <Input value={batch} onChange={(e) => setBatch(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Issue</Label>
              <Textarea rows={3} value={issue} onChange={(e) => setIssue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!dealer || !item || create.isPending}
              onClick={() => create.mutate()}
            >
              File claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
