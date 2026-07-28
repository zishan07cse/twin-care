import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n, formatBDT } from "@/lib/i18n";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { Users, TrendingUp, Wallet, AlertTriangle, CalendarCheck, UserPlus, ArrowRight, Activity } from "lucide-react";
import { getReportsSummary, getRecentActivity } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { t, locale } = useI18n();
  const { user, roles, hasAnyRole } = useAuth();
  const canSeeReports = hasAnyRole(["super_admin", "admin", "care_coordinator", "finance"]);

  const fetchSummary = useServerFn(getReportsSummary);
  const fetchActivity = useServerFn(getRecentActivity);
  const { data, isLoading } = useQuery({
    queryKey: ["dash", "summary"],
    queryFn: () => fetchSummary(),
    enabled: canSeeReports,
  });
  const { data: activity } = useQuery({
    queryKey: ["dash", "activity"],
    queryFn: () => fetchActivity(),
    enabled: canSeeReports,
  });

  const stats = [
    {
      icon: Users,
      key: "dash.activePatients",
      value: data ? String(data.kpi.activePatients) : isLoading ? "…" : "—",
      tone: "text-primary",
    },
    {
      icon: UserPlus,
      key: "dash.newEnrollments",
      value: data ? String(data.kpi.newEnrollmentsThisMonth) : isLoading ? "…" : "—",
      tone: "text-success",
    },
    {
      icon: Wallet,
      key: "dash.collections",
      value: data ? formatBDT(data.kpi.collectionsThisMonth, locale) : isLoading ? "…" : formatBDT(0, locale),
      tone: "text-secondary",
    },
    {
      icon: AlertTriangle,
      key: "dash.overdue",
      value: data ? formatBDT(data.kpi.overdueTotal, locale) : isLoading ? "…" : "—",
      tone: "text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("dash.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {user?.email}
          {roles.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {ROLE_LABELS[roles[0]][locale]}
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.key} className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{t(s.key)}</div>
                <s.icon className={`h-4 w-4 ${s.tone}`} />
              </div>
              <div className="mt-2 text-2xl font-semibold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {canSeeReports && data && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Upcoming appointments</CardTitle>
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{data.kpi.upcomingAppointments}</div>
              <Link to="/app/appointments" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Open scheduler <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Outstanding balances</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{formatBDT(data.kpi.outstandingTotal, locale)}</div>
              <Link to="/app/reports" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                View report <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {canSeeReports && activity && activity.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {activity.map((e: any) => (
                <li key={e.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.title}</div>
                    {e.description && (
                      <div className="text-xs text-muted-foreground truncate">{e.description}</div>
                    )}
                    {e.patients && (
                      <Link
                        to="/app/patients/$patientId"
                        params={{ patientId: e.patient_id }}
                        className="text-xs text-primary hover:underline"
                      >
                        {e.patients.patient_code} · {e.patients.full_name}
                      </Link>
                    )}
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!canSeeReports && (
        <Card>
          <CardHeader>
            <CardTitle>Welcome to TwinCare BD</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("dash.foundationReady")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
