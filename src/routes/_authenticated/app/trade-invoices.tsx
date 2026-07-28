import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listTradeInvoices, getInvoice } from "@/lib/distribution.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/trade-invoices")({
  component: TradeInvoicesPage,
});

const STATUS_COLOR: Record<string, string> = {
  unpaid: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  partial: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  overdue: "bg-destructive/15 text-destructive",
  disputed: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  void: "bg-muted text-muted-foreground",
};

function TradeInvoicesPage() {
  const listFn = useServerFn(listTradeInvoices);
  const getFn = useServerFn(getInvoice);
  const invoices = useQuery({ queryKey: ["trade-invoices"], queryFn: () => listFn({ data: {} }) });
  const [viewId, setViewId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["trade-invoice", viewId],
    queryFn: () => getFn({ data: { id: viewId! } }),
    enabled: !!viewId,
  });

  const today = new Date();
  const daysOverdue = (dueDate: string) =>
    Math.floor((today.getTime() - new Date(dueDate).getTime()) / 86400000);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Trade invoices</h1>
        <p className="text-sm text-muted-foreground">Dealer invoices auto-generated from challans</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Dealer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.data?.map((i: any) => {
                const outstanding = Number(i.total_bdt) - Number(i.paid_amount_bdt);
                const overdue = i.status !== "paid" && daysOverdue(i.due_date) > 0;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.invoice_no}</TableCell>
                    <TableCell>{i.dealer?.business_name}</TableCell>
                    <TableCell>{i.invoice_date}</TableCell>
                    <TableCell>
                      {i.due_date}
                      {overdue && (
                        <span className="ml-1 text-xs text-destructive">
                          +{daysOverdue(i.due_date)}d
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[i.status] ?? ""} variant="secondary">
                        {i.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">৳{Number(i.total_bdt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">৳{Number(i.paid_amount_bdt).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      ৳{outstanding.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => setViewId(i.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`/app/trade-invoices/${i.id}/print`} target="_blank" rel="noreferrer">
                          <Printer className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {invoices.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No invoices yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invoice {detail.data?.invoice?.invoice_no}</DialogTitle>
            <DialogDescription>{detail.data?.invoice?.dealer?.business_name}</DialogDescription>
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
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.data.items.map((it: any) => (
                        <TableRow key={it.id}>
                          <TableCell>{it.item?.name_en}</TableCell>
                          <TableCell className="text-right">{it.quantity}</TableCell>
                          <TableCell className="text-right">৳{Number(it.unit_price_bdt).toLocaleString()}</TableCell>
                          <TableCell className="text-right">৳{Number(it.line_total_bdt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>৳{Number(detail.data.invoice.subtotal_bdt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT</span>
                  <span>৳{Number(detail.data.invoice.vat_bdt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>AIT</span>
                  <span>৳{Number(detail.data.invoice.ait_bdt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>Total</span>
                  <span>৳{Number(detail.data.invoice.total_bdt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Paid</span>
                  <span>৳{Number(detail.data.invoice.paid_amount_bdt).toLocaleString()}</span>
                </div>
              </div>
              {detail.data.allocations.length > 0 && (
                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm">Payment allocations</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.data.allocations.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell>{a.payment?.payment_date}</TableCell>
                            <TableCell>{a.payment?.method}</TableCell>
                            <TableCell>{a.payment?.reference ?? "—"}</TableCell>
                            <TableCell className="text-right">৳{Number(a.amount_bdt).toLocaleString()}</TableCell>
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
