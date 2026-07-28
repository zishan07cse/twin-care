import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  portalGetMyDealer,
  portalListInvoices,
  portalListOrders,
  portalListPayments,
  portalListDeliveries,
} from "@/lib/dealer-portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBDT, formatDateBD, useI18n } from "@/lib/i18n";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/portal")({
  component: DealerPortalPage,
});

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" | "ok" }) {
  const color =
    tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-semibold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function DealerPortalPage() {
  const { locale } = useI18n();
  const meFn = useServerFn(portalGetMyDealer);
  const invFn = useServerFn(portalListInvoices);
  const ordFn = useServerFn(portalListOrders);
  const payFn = useServerFn(portalListPayments);
  const delFn = useServerFn(portalListDeliveries);

  const me = useQuery({ queryKey: ["portal-me"], queryFn: () => meFn() });
  const invoices = useQuery({ queryKey: ["portal-inv"], queryFn: () => invFn() });
  const orders = useQuery({ queryKey: ["portal-ord"], queryFn: () => ordFn() });
  const payments = useQuery({ queryKey: ["portal-pay"], queryFn: () => payFn() });
  const deliveries = useQuery({ queryKey: ["portal-del"], queryFn: () => delFn() });

  if (me.isLoading) return <div className="p-6 text-sm">Loading…</div>;

  if (!me.data?.dealer) {
    return (
      <div className="p-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Dealer portal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Your account is not linked to a dealer profile yet.</p>
            <p>Contact Experto sales to have your account activated as a dealer.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = me.data.dealer;
  const s = me.data.summary!;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{d.business_name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{d.dealer_code}</span>
            {d.territory ? ` · ${d.territory}` : ""}
            {d.division ? ` · ${d.division}` : ""}
          </p>
        </div>
        <Badge variant={d.status === "active" ? "default" : "secondary"}>{d.status}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Outstanding" value={formatBDT(s.outstanding, locale)} tone="warn" />
        <Kpi label="Overdue" value={formatBDT(s.overdue, locale)} tone={s.overdue > 0 ? "danger" : undefined} />
        <Kpi label="Open invoices" value={String(s.openInvoices)} />
        <Kpi label="Total paid" value={formatBDT(s.totalPaid, locale)} tone="ok" />
        <Kpi label="Cheques pending" value={String(s.chequesPending)} />
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
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
                  {(invoices.data ?? []).map((i: {
                    id: string; invoice_no: string; invoice_date: string; due_date: string | null;
                    total_bdt: number; paid_amount_bdt: number; status: string;
                  }) => {
                    const out = Number(i.total_bdt) - Number(i.paid_amount_bdt);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.invoice_no}</TableCell>
                        <TableCell>{formatDateBD(i.invoice_date)}</TableCell>
                        <TableCell>{i.due_date ? formatDateBD(i.due_date) : "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{i.status}</Badge></TableCell>
                        <TableCell className="text-right">{formatBDT(Number(i.total_bdt), locale)}</TableCell>
                        <TableCell className="text-right">{formatBDT(Number(i.paid_amount_bdt), locale)}</TableCell>
                        <TableCell className="text-right font-medium">{formatBDT(Math.max(out, 0), locale)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`/app/trade-invoices/${i.id}/print`} target="_blank" rel="noreferrer">
                              <Printer className="h-4 w-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(invoices.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No invoices</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(orders.data ?? []).map((o: { id: string; order_no: string; order_date: string; status: string; total_bdt: number }) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.order_no}</TableCell>
                      <TableCell>{formatDateBD(o.order_date)}</TableCell>
                      <TableCell><Badge variant="secondary">{o.status}</Badge></TableCell>
                      <TableCell className="text-right">{formatBDT(Number(o.total_bdt), locale)}</TableCell>
                    </TableRow>
                  ))}
                  {(orders.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No orders</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Challan #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(deliveries.data ?? []).map((c: { id: string; challan_no: string; challan_date: string; status: string }) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.challan_no}</TableCell>
                      <TableCell>{formatDateBD(c.challan_date)}</TableCell>
                      <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {(deliveries.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No deliveries</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Unallocated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payments.data ?? []).map((p: {
                    id: string; payment_date: string; method: string; reference: string | null;
                    amount_bdt: number; unallocated_bdt: number | null;
                  }) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDateBD(p.payment_date)}</TableCell>
                      <TableCell><Badge variant="outline">{p.method}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{p.reference ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatBDT(Number(p.amount_bdt), locale)}</TableCell>
                      <TableCell className="text-right">{formatBDT(Number(p.unallocated_bdt ?? 0), locale)}</TableCell>
                    </TableRow>
                  ))}
                  {(payments.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No payments</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
