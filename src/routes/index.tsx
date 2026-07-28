import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, HeartPulse, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, roles, loading } = useAuth();
  const { t } = useI18n();

  if (!loading && session) {
    const isPatientOnly = roles.length > 0 && roles.every((r) => r === "patient");
    return <Navigate to={isPatientOnly ? "/portal" : "/app"} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
            T
          </div>
          <div>
            <div className="text-sm font-semibold">{t("app.name")}</div>
            <div className="text-xs text-muted-foreground">by Experto</div>
          </div>
        </div>
        <Link to="/auth">
          <Button size="sm">{t("auth.signIn")}</Button>
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-12 pb-24">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <HeartPulse className="h-3 w-3" />
            Twin Health · Bangladesh
          </div>
          <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight text-secondary">
            Metabolic health, managed end&#8209;to&#8209;end.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("app.tagline")} — enrollments, payments, devices, consultations,
            prescriptions and outcomes in one professional-grade platform.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/auth">
              <Button size="lg">{t("auth.signIn")}</Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: Stethoscope, title: "Clinical", body: "Consultations, prescriptions, medication reduction tracking." },
            { icon: Activity, title: "Outcomes", body: "HbA1c trends, remission indicators, patient-level & program dashboards." },
            { icon: HeartPulse, title: "Operations", body: "Payments, EMI, device inventory, CGM sensor cycles, referrals." },
          ].map((f) => (
            <Card key={f.title} className="border-border">
              <CardContent className="pt-6">
                <f.icon className="h-6 w-6 text-primary" />
                <div className="mt-3 font-semibold">{f.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{f.body}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
