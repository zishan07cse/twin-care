import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReportsSummary } from "@/lib/reports.functions";
import { useI18n, formatBDT } from "@/lib/i18n";
import { Users, TrendingUp, Wallet, AlertTriangle, CalendarCheck, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { t, locale } = useI18n();
  const fetchSummary = useServerFn(getReportsSummary);
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => fetchSummary(),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }
  if (error || !data) {
    return <div className="text-sm text-destructive">Failed to load reports.</div>;
  }

  const kpis = [
    { icon: Users, label: t("dash.activePatients"), value: String(data.kpi.activePatients), tone: "text-primary" },
    { icon: UserPlus, label: t("dash.newEnrollments"), value: String(data.kpi.newEnrollmentsThisMonth), tone: "text-success" },
    { icon: Wallet, label: t("dash.collections"), value: formatBDT(data.kpi.collectionsThisMonth, locale), tone: "text-secondary" },
    { icon: AlertTriangle, label: t("dash.overdue"), value: formatBDT(data.kpi.overdueTotal, locale), tone: "text-destructive" },
    { icon: TrendingUp, label: "Outstanding total", value: formatBDT(data.kpi.outstandingTotal, locale), tone: "text-warning" },
    { icon: CalendarCheck, label: "Upcoming appointments", value: String(data.kpi.upcomingAppointments), tone: "text-primary" },
  ];

  const maxEnroll = Math.max(1, ...data.enrollmentsPerMonth.map((m) => m.value));
  const maxColl = Math.max(1, ...data.collectionsPerMonth.map((m) => m.value));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.reports")}</h1>
          <p className="text-sm text-muted-foreground mt-1">Operational overview across leads, patients, billing, and stock.</p>
        </div>
        <div className="flex gap-2">
          <ExportBtn
            label="Export collections CSV"
            rows={data.collectionsPerMonth.map((m) => ({ month: m.month, collections_bdt: m.value }))}
            filename="collections.csv"
          />
          <ExportBtn
            label="Export outstanding CSV"
            rows={data.topOutstanding.map((p) => ({ code: p.code, name: p.name, outstanding_bdt: p.outstanding }))}
            filename="outstanding.csv"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <k.icon className={`h-4 w-4 ${k.tone}`} />
              </div>
              <div className="mt-2 text-xl font-semibold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrollments — last 6 months</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={data.enrollmentsPerMonth.map((m) => ({ label: m.month, value: m.value, display: String(m.value) }))} max={maxEnroll} tone="bg-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collections — last 6 months</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={data.collectionsPerMonth.map((m) => ({ label: m.month, value: m.value, display: formatBDT(m.value, locale) }))} max={maxColl} tone="bg-secondary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyList data={data.leadsByStage} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patients by status</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyList data={data.patientsByStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appointments by status</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyList data={data.appointmentsByStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low / out of stock</CardTitle>
          </CardHeader>
          <CardContent>
            {data.lowStock.length === 0 ? (
              <div className="text-sm text-muted-foreground">All items above reorder level.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.lowStock.map((i: any) => (
                  <li key={i.id} className="flex items-center justify-between">
                    <span>{i.name_en}</span>
                    <span className="text-xs text-muted-foreground">
                      {i.stock_qty} / reorder {i.reorder_level}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top outstanding balances</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topOutstanding.length === 0 ? (
            <div className="text-sm text-muted-foreground">No outstanding balances.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground text-left">
                <tr>
                  <th className="py-2">Patient</th>
                  <th className="py-2">Code</th>
                  <th className="py-2 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.topOutstanding.map((p) => (
                  <tr key={p.code} className="border-t">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-muted-foreground">{p.code}</td>
                    <td className="py-2 text-right font-medium">{formatBDT(p.outstanding, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BarList({ items, max, tone }: { items: { label: string; value: number; display: string }[]; max: number; tone: string }) {
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{it.label}</span>
            <span>{it.display}</span>
          </div>
          <div className="h-2 rounded bg-muted overflow-hidden">
            <div className={`h-full ${tone}`} style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function KeyList({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <div className="text-sm text-muted-foreground">No data yet.</div>;
  }
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  return (
    <ul className="space-y-2 text-sm">
      {entries.map(([k, v]) => (
        <li key={k} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="capitalize">{k.replace(/_/g, " ")}</span>
            <span className="text-xs text-muted-foreground">{v}</span>
          </div>
          <div className="h-1.5 rounded bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(v / total) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ExportBtn({ label, rows, filename }: { label: string; rows: Record<string, any>[]; filename: string }) {
  const download = () => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
    >
      {label}
    </button>
  );
}
