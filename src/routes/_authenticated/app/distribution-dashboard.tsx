import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { distributionDashboard } from "@/lib/distribution.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatBDT, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/distribution-dashboard")({
  component: DistributionDashboardPage,
});

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" | "ok" }) {
  const color =
    tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function DistributionDashboardPage() {
  const { locale } = useI18n();
  const fetchDashboard = useServerFn(distributionDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["distribution-dashboard"],
    queryFn: () => fetchDashboard(),
  });

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Distribution dashboard</h1>
        <p className="text-sm text-muted-foreground">Nationwide dealer sales & receivables at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="MTD revenue" value={formatBDT(data.mtdRevenue, locale)} tone="ok" />
        <KpiCard label="MTD collections" value={formatBDT(data.mtdCollections, locale)} tone="ok" />
        <KpiCard label="Outstanding" value={formatBDT(data.outstanding, locale)} tone="warn" />
        <KpiCard label="Overdue" value={formatBDT(data.overdue, locale)} tone="danger" />
        <KpiCard label="Active dealers" value={String(data.activeDealers)} />
        <KpiCard
          label="Cheques pending"
          value={`${data.chequesPending} · ${formatBDT(data.chequesPendingAmount, locale)}`}
          tone="warn"
        />
        <KpiCard label="Low stock items" value={String(data.lowStockCount)} tone={data.lowStockCount > 0 ? "warn" : undefined} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top dealers (MTD)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topDealers.length === 0 ? (
              <div className="text-sm text-muted-foreground">No invoices this month.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topDealers.map((d) => (
                    <TableRow key={d.code}>
                      <TableCell className="font-mono text-xs">{d.code}</TableCell>
                      <TableCell>{d.name}</TableCell>
                      <TableCell className="text-right">{formatBDT(d.revenue, locale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low trade stock</CardTitle>
          </CardHeader>
          <CardContent>
            {data.lowStockItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">All items above reorder level.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reorder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lowStockItems.map((it: { id: string; name_en: string; trade_stock_qty: number | null; reorder_level: number | null }) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.name_en}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{it.trade_stock_qty ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{it.reorder_level ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
