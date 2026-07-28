import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  salesByDealer,
  salesByProduct,
  salesByTerritory,
  chequeRegister,
} from "@/lib/distribution.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBDT, formatDateBD, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/distribution-reports")({
  component: DistributionReportsPage,
});

function useRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = now.toISOString().slice(0, 10);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);
  const [applied, setApplied] = useState({ from: start, to: end });
  return {
    from,
    to,
    setFrom,
    setTo,
    applied,
    apply: () => setApplied({ from, to }),
  };
}

function RangeBar({ from, to, setFrom, setTo, onApply }: {
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void; onApply: () => void;
}) {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div>
        <Label className="text-xs">From</Label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
      </div>
      <div>
        <Label className="text-xs">To</Label>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>
      <Button size="sm" onClick={onApply}>Apply</Button>
      <Button size="sm" variant="outline" onClick={() => window.print()}>Print</Button>
    </div>
  );
}

function DistributionReportsPage() {
  const { locale } = useI18n();
  const fetchByDealer = useServerFn(salesByDealer);
  const fetchByProduct = useServerFn(salesByProduct);
  const fetchByTerritory = useServerFn(salesByTerritory);
  const fetchCheques = useServerFn(chequeRegister);

  const r1 = useRange();
  const r2 = useRange();
  const r3 = useRange();
  const r4 = useRange();

  const byDealer = useQuery({
    queryKey: ["rep-by-dealer", r1.applied],
    queryFn: () => fetchByDealer({ data: r1.applied }),
  });
  const byProduct = useQuery({
    queryKey: ["rep-by-product", r2.applied],
    queryFn: () => fetchByProduct({ data: r2.applied }),
  });
  const byTerritory = useQuery({
    queryKey: ["rep-by-territory", r3.applied],
    queryFn: () => fetchByTerritory({ data: r3.applied }),
  });
  const cheques = useQuery({
    queryKey: ["rep-cheques", r4.applied],
    queryFn: () => fetchCheques({ data: r4.applied }),
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Distribution reports</h1>
        <p className="text-sm text-muted-foreground">Sales analytics, territory rollups and cheque register.</p>
      </div>

      <Tabs defaultValue="dealer">
        <TabsList>
          <TabsTrigger value="dealer">By dealer</TabsTrigger>
          <TabsTrigger value="product">By product</TabsTrigger>
          <TabsTrigger value="territory">By territory</TabsTrigger>
          <TabsTrigger value="cheques">Cheque register</TabsTrigger>
        </TabsList>

        <TabsContent value="dealer">
          <Card>
            <CardContent className="pt-6">
              <RangeBar {...r1} onApply={r1.apply} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(byDealer.data ?? []).map((d) => (
                    <TableRow key={d.dealer_code}>
                      <TableCell className="font-mono text-xs">{d.dealer_code}</TableCell>
                      <TableCell>{d.name}</TableCell>
                      <TableCell>{d.territory}</TableCell>
                      <TableCell className="text-right">{d.invoices}</TableCell>
                      <TableCell className="text-right">{formatBDT(d.total, locale)}</TableCell>
                      <TableCell className="text-right">{formatBDT(d.paid, locale)}</TableCell>
                      <TableCell className="text-right">{formatBDT(d.outstanding, locale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product">
          <Card>
            <CardContent className="pt-6">
              <RangeBar {...r2} onApply={r2.apply} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(byProduct.data ?? []).map((p, i) => (
                    <TableRow key={`${p.sku}-${i}`}>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell className="text-right">{p.qty}</TableCell>
                      <TableCell className="text-right">{formatBDT(p.revenue, locale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="territory">
          <Card>
            <CardContent className="pt-6">
              <RangeBar {...r3} onApply={r3.apply} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Division</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(byTerritory.data ?? []).map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>{t.division}</TableCell>
                      <TableCell>{t.territory}</TableCell>
                      <TableCell className="text-right">{t.invoices}</TableCell>
                      <TableCell className="text-right">{formatBDT(t.total, locale)}</TableCell>
                      <TableCell className="text-right">{formatBDT(t.outstanding, locale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cheques">
          <Card>
            <CardContent className="pt-6">
              <RangeBar {...r4} onApply={r4.apply} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cheque #</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Cheque date</TableHead>
                    <TableHead>Deposited</TableHead>
                    <TableHead>Cleared</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(cheques.data ?? []).map((c: {
                    id: string;
                    cheque_no: string;
                    bank: string | null;
                    branch: string | null;
                    cheque_date: string;
                    deposited_on: string | null;
                    cleared_on: string | null;
                    amount_bdt: number;
                    status: string;
                    dealers: { business_name: string; dealer_code: string } | null;
                  }) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.cheque_no}</TableCell>
                      <TableCell>
                        <div>{c.dealers?.business_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.dealers?.dealer_code}</div>
                      </TableCell>
                      <TableCell>
                        <div>{c.bank ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.branch}</div>
                      </TableCell>
                      <TableCell>{formatDateBD(c.cheque_date)}</TableCell>
                      <TableCell>{c.deposited_on ? formatDateBD(c.deposited_on) : "—"}</TableCell>
                      <TableCell>{c.cleared_on ? formatDateBD(c.cleared_on) : "—"}</TableCell>
                      <TableCell className="text-right">{formatBDT(Number(c.amount_bdt), locale)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            c.status === "cleared"
                              ? "default"
                              : c.status === "bounced" || c.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
