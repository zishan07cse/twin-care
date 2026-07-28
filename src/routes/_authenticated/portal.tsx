import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyPortal } from "@/lib/portal.functions";
import { useAuth } from "@/lib/auth";
import { useI18n, formatBDT } from "@/lib/i18n";
import { CalendarDays, Pill, Apple, Activity, FlaskConical, Wallet, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal")({
  component: PortalPage,
});

function PortalPage() {
  const { locale } = useI18n();
  const { user, signOut } = useAuth();
  const fetchPortal = useServerFn(getMyPortal);
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal", "me"],
    queryFn: () => fetchPortal(),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading your records…</div>;
  if (error) return <div className="p-6 text-sm text-destructive">Failed to load your records.</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">T</div>
            <div>
              <div className="text-sm font-semibold">TwinCare BD</div>
              <div className="text-xs text-muted-foreground">My health portal</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="h-3.5 w-3.5 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {!data?.linked ? (
          <Card>
            <CardHeader>
              <CardTitle>Account not linked yet</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Your patient record isn't linked to this login yet. Please ask a TwinCare care coordinator to link your account using this email:</p>
              <div className="font-mono rounded bg-muted p-2">{user?.email}</div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Welcome</div>
                    <div className="text-2xl font-semibold">{data.patient?.full_name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Patient ID · {data.patient?.patient_code} · Status: {data.patient?.status}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Upcoming appointments</div>
                    <div className="text-2xl font-semibold">{data.appointments.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="appts">
              <TabsList className="flex-wrap">
                <TabsTrigger value="appts"><CalendarDays className="h-3.5 w-3.5 mr-1" />Appointments</TabsTrigger>
                <TabsTrigger value="rx"><Pill className="h-3.5 w-3.5 mr-1" />Prescriptions</TabsTrigger>
                <TabsTrigger value="diet"><Apple className="h-3.5 w-3.5 mr-1" />Diet</TabsTrigger>
                <TabsTrigger value="vitals"><Activity className="h-3.5 w-3.5 mr-1" />Vitals</TabsTrigger>
                <TabsTrigger value="labs"><FlaskConical className="h-3.5 w-3.5 mr-1" />Labs</TabsTrigger>
                <TabsTrigger value="pay"><Wallet className="h-3.5 w-3.5 mr-1" />Payments</TabsTrigger>
                <TabsTrigger value="time">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="appts">
                <Section title="Upcoming appointments">
                  {data.appointments.length === 0 ? (
                    <Empty>No upcoming appointments.</Empty>
                  ) : (
                    <ul className="divide-y">
                      {data.appointments.map((a: any) => (
                        <li key={a.id} className="py-3 flex justify-between text-sm">
                          <div>
                            <div className="font-medium">{new Date(a.scheduled_at).toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground capitalize">{a.provider_kind} · {a.status}</div>
                            {a.notes && <div className="text-xs text-muted-foreground mt-0.5">{a.notes}</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="rx">
                <Section title="Prescriptions">
                  {data.prescriptions.length === 0 ? (
                    <Empty>No prescriptions on file.</Empty>
                  ) : (
                    <div className="space-y-4">
                      {data.prescriptions.map((p: any) => (
                        <div key={p.id} className="border rounded-md p-3">
                          <div className="flex justify-between text-sm">
                            <div className="font-medium">{p.diagnosis ?? "Prescription"}</div>
                            <div className="text-xs text-muted-foreground">{new Date(p.issued_at).toLocaleDateString()}</div>
                          </div>
                          {p.advice && <div className="text-xs text-muted-foreground mt-1">{p.advice}</div>}
                          {p.prescription_items?.length > 0 && (
                            <ul className="mt-2 space-y-1 text-sm">
                              {p.prescription_items.map((it: any, i: number) => (
                                <li key={i} className="flex justify-between border-t pt-1">
                                  <span>{it.medicine_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {[it.dose, it.frequency, it.duration].filter(Boolean).join(" · ")}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="diet">
                <Section title="Diet plans">
                  {data.dietPlans.length === 0 ? (
                    <Empty>No diet plans yet.</Empty>
                  ) : (
                    <ul className="divide-y">
                      {data.dietPlans.map((d: any) => (
                        <li key={d.id} className="py-3 text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">{d.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {d.start_date}{d.end_date ? ` → ${d.end_date}` : ""}
                            </span>
                          </div>
                          {d.daily_calories && (
                            <div className="text-xs text-muted-foreground">{d.daily_calories} kcal / day</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="vitals">
                <Section title="Recent vitals">
                  {data.vitals.length === 0 ? <Empty>No vitals recorded.</Empty> : (
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground text-left">
                        <tr><th className="py-1">Date</th><th>Weight</th><th>BP</th><th>HbA1c</th><th>FBG</th></tr>
                      </thead>
                      <tbody>
                        {data.vitals.map((v: any) => (
                          <tr key={v.id} className="border-t">
                            <td className="py-1">{new Date(v.recorded_on).toLocaleDateString()}</td>
                            <td>{v.weight_kg ?? "—"}</td>
                            <td>{v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"}</td>
                            <td>{v.hba1c ?? "—"}</td>
                            <td>{v.fasting_glucose ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="labs">
                <Section title="Lab results">
                  {data.labs.length === 0 ? <Empty>No lab results yet.</Empty> : (
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground text-left">
                        <tr><th className="py-1">Date</th><th>Test</th><th className="text-right">Result</th></tr>
                      </thead>
                      <tbody>
                        {data.labs.map((l: any) => (
                          <tr key={l.id} className="border-t">
                            <td className="py-1">{new Date(l.performed_on).toLocaleDateString()}</td>
                            <td>{l.test_name}</td>
                            <td className="text-right">
                              {l.value_text ?? l.value_numeric ?? "—"}{l.unit ? ` ${l.unit}` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="pay">
                <Section title="Payment schedule">
                  {data.schedule.length === 0 ? <Empty>No installments due.</Empty> : (
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground text-left">
                        <tr><th className="py-1">Due</th><th>Status</th><th className="text-right">Amount</th><th className="text-right">Paid</th></tr>
                      </thead>
                      <tbody>
                        {data.schedule.map((s: any) => (
                          <tr key={s.id} className="border-t">
                            <td className="py-1">{s.due_date}</td>
                            <td className="capitalize">{s.status}</td>
                            <td className="text-right">{formatBDT(Number(s.amount_bdt), locale)}</td>
                            <td className="text-right">{formatBDT(Number(s.paid_amount_bdt ?? 0), locale)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="time">
                <Section title="Timeline">
                  {data.timeline.length === 0 ? <Empty>No events yet.</Empty> : (
                    <ul className="space-y-3 text-sm">
                      {data.timeline.map((e: any) => (
                        <li key={e.id} className="flex justify-between gap-3">
                          <div>
                            <div className="font-medium">{e.title}</div>
                            {e.description && <div className="text-xs text-muted-foreground">{e.description}</div>}
                          </div>
                          <div className="text-xs text-muted-foreground shrink-0">
                            {new Date(e.created_at).toLocaleString()}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}
