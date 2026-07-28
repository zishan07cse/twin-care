import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listDealerPayments,
  recordDealerPayment,
  listCheques,
  updateChequeStatus,
} from "@/lib/distribution.functions";
import { listDealers } from "@/lib/dealers.functions";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/dealer-payments")({
  component: DealerPaymentsPage,
});

const METHODS = ["cash", "bank", "cheque", "bkash", "nagad", "card", "other"] as const;
type Method = (typeof METHODS)[number];

function DealerPaymentsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDealerPayments);
  const createFn = useServerFn(recordDealerPayment);
  const dealersFn = useServerFn(listDealers);
  const chequesFn = useServerFn(listCheques);
  const chequeStatusFn = useServerFn(updateChequeStatus);

  const payments = useQuery({ queryKey: ["dealer-payments"], queryFn: () => listFn({ data: {} }) });
  const dealers = useQuery({ queryKey: ["dealers"], queryFn: () => dealersFn() });
  const cheques = useQuery({ queryKey: ["cheques"], queryFn: () => chequesFn() });

  const [open, setOpen] = useState(false);
  const [dealer_id, setDealerId] = useState("");
  const [amount, setAmount] = useState(0);
  const [payment_date, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<Method>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [autoAllocate, setAutoAllocate] = useState(true);
  const [chequeNo, setChequeNo] = useState("");
  const [bank, setBank] = useState("");
  const [branch, setBranch] = useState("");
  const [chequeDate, setChequeDate] = useState("");

  const reset = () => {
    setDealerId("");
    setAmount(0);
    setMethod("cash");
    setReference("");
    setNotes("");
    setChequeNo("");
    setBank("");
    setBranch("");
    setChequeDate("");
  };

  const create = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          dealer_id,
          amount_bdt: amount,
          payment_date,
          method,
          reference: reference || null,
          notes: notes || null,
          auto_allocate: autoAllocate,
          cheque:
            method === "cheque"
              ? {
                  cheque_no: chequeNo,
                  bank: bank || null,
                  branch: branch || null,
                  cheque_date: chequeDate,
                }
              : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["dealer-payments"] });
      qc.invalidateQueries({ queryKey: ["trade-invoices"] });
      qc.invalidateQueries({ queryKey: ["cheques"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setChequeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      chequeStatusFn({ data: { id, status: status as "cleared" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cheques"] });
      toast.success("Cheque updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dealer payments</h1>
          <p className="text-sm text-muted-foreground">Collections & cheque tracking</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Record payment
        </Button>
      </div>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="cheques">Cheques</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Unallocated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.data?.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.payment_date}</TableCell>
                      <TableCell>{p.dealer?.business_name}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>{p.reference ?? "—"}</TableCell>
                      <TableCell className="text-right">৳{Number(p.amount_bdt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {Number(p.unallocated_bdt) > 0 ? (
                          <Badge variant="secondary">৳{Number(p.unallocated_bdt).toLocaleString()}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No payments yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cheques" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cheque #</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cheques.data?.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.cheque_no}</TableCell>
                      <TableCell>{c.dealer?.business_name}</TableCell>
                      <TableCell>{c.bank ?? "—"}</TableCell>
                      <TableCell>{c.cheque_date}</TableCell>
                      <TableCell className="text-right">৳{Number(c.amount_bdt).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value=""
                          onValueChange={(v) => setChequeStatus.mutate({ id: c.id, status: v })}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue placeholder="Update" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deposited">Deposited</SelectItem>
                            <SelectItem value="cleared">Cleared</SelectItem>
                            <SelectItem value="bounced">Bounced</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cheques.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No cheques yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record dealer payment</DialogTitle>
            <DialogDescription>Auto-allocates FIFO to unpaid invoices</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (৳)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={payment_date}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m: any) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>
            {method === "cheque" && (
              <div className="border rounded p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Cheque #</Label>
                    <Input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
                  </div>
                  <div>
                    <Label>Cheque date</Label>
                    <Input
                      type="date"
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Bank</Label>
                    <Input value={bank} onChange={(e) => setBank(e.target.value)} />
                  </div>
                  <div>
                    <Label>Branch</Label>
                    <Input value={branch} onChange={(e) => setBranch(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={autoAllocate}
                onCheckedChange={(v) => setAutoAllocate(v === true)}
              />
              Auto-allocate to oldest unpaid invoices
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!dealer_id || amount <= 0 || create.isPending}
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
