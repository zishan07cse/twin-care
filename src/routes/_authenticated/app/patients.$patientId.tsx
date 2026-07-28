import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getPatient, addTimelineNote, linkPatientToUser, unlinkPatientUser } from "@/lib/patients.functions";
import { listEnrollmentsForPatient } from "@/lib/billing.functions";
import { useAuth } from "@/lib/auth";
import { Checkbox } from "@/components/ui/checkbox";
import { listPrescriptions, listDietPlans, listReductions } from "@/lib/clinical.functions";
import { listLabResults, listVitals } from "@/lib/labs.functions";
import { PatientDevicesTab } from "@/components/app/patient-devices-tab";
import { PatientNotificationPrefsDialog } from "@/components/app/patient-notification-prefs-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ClipboardList, Activity, FlaskConical, Apple, Package, User, Plus, FileDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { getPatientOutcome } from "@/lib/reports-pdf.functions";
import { generateOutcomesSummaryPDF } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/app/patients/$patientId")({
  component: PatientDetailPage,
});

function PatientDetailPage() {
  const { patientId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => getPatient({ data: { id: patientId } }),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>;
  if (!data) return null;

  const { patient, timeline } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/patients" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{patient.full_name}</h1>
            <Badge variant="outline">{patient.patient_code}</Badge>
            <Badge variant={patient.status === "active" ? "default" : "secondary"}>{patient.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {patient.gender || "—"} · {patient.date_of_birth ? `DOB ${patient.date_of_birth}` : "no DOB"} · {patient.phone || "no phone"} · {patient.city || "—"}
          </p>
        </div>
        <OutcomesPDFButton patientId={patientId} patient={patient} />
        <PatientNotificationPrefsDialog patientId={patientId} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetaCard label="Treating doctor" value={patient.treating_doctor?.full_name || "—"} />
        <MetaCard label="Nutritionist" value={patient.nutritionist?.full_name || "—"} />
        <MetaCard label="Hospital" value={patient.hospital?.name || "—"} />
        <MetaCard label="Referrer" value={patient.referring_doctor?.full_name || "—"} />
      </div>

      <PortalLinkCard patientId={patientId} email={patient.email} userId={patient.user_id} />

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline"><User className="h-4 w-4 mr-2" />Timeline</TabsTrigger>
          <TabsTrigger value="vitals"><Activity className="h-4 w-4 mr-2" />Vitals</TabsTrigger>
          <TabsTrigger value="labs"><FlaskConical className="h-4 w-4 mr-2" />Labs</TabsTrigger>
          <TabsTrigger value="rx"><ClipboardList className="h-4 w-4 mr-2" />Prescriptions</TabsTrigger>
          <TabsTrigger value="diet"><Apple className="h-4 w-4 mr-2" />Diet</TabsTrigger>
          <TabsTrigger value="inventory"><Package className="h-4 w-4 mr-2" />Devices</TabsTrigger>
          <TabsTrigger value="payments"><Wallet className="h-4 w-4 mr-2" />Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <TimelineTab patientId={patientId} timeline={timeline} />
        </TabsContent>
        <TabsContent value="vitals"><PatientVitals patientId={patientId} /></TabsContent>
        <TabsContent value="labs"><PatientLabs patientId={patientId} /></TabsContent>
        <TabsContent value="rx"><PatientRx patientId={patientId} /></TabsContent>
        <TabsContent value="diet"><PatientDiet patientId={patientId} /></TabsContent>
        <TabsContent value="inventory"><PatientInventory patientId={patientId} /></TabsContent>
        <TabsContent value="payments"><PatientPayments patientId={patientId} /></TabsContent>
      </Tabs>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardDescription>{label}</CardDescription></CardHeader>
      <CardContent><div className="text-sm font-medium">{value}</div></CardContent>
    </Card>
  );
}

function TimelineTab({ patientId, timeline }: { patientId: string; timeline: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const mut = useMutation({
    mutationFn: () => addTimelineNote({ data: { patient_id: patientId, title: form.title, description: form.description } }),
    onSuccess: () => {
      toast.success("Note added");
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
      setOpen(false); setForm({ title: "", description: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div><CardTitle>Timeline</CardTitle><CardDescription>All activity for this patient</CardDescription></div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add note</Button>
      </CardHeader>
      <CardContent>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No events yet.</p>
        ) : (
          <ol className="relative border-l-2 border-muted pl-6 space-y-4">
            {timeline.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[29px] top-1 h-3 w-3 rounded-full bg-primary" />
                <div className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()} · <Badge variant="outline" className="text-[10px]">{e.event_type}</Badge>
                </div>
                <div className="font-medium text-sm">{e.title}</div>
                {e.description && <div className="text-sm text-muted-foreground">{e.description}</div>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add timeline note</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.title || mut.isPending} onClick={() => mut.mutate()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PatientVitals({ patientId }: { patientId: string }) {
  const { data = [] } = useQuery({ queryKey: ["patient-vitals", patientId], queryFn: () => listVitals({ data: { patient_id: patientId } }) });
  return (
    <Card>
      <CardHeader><CardTitle>Vitals</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Wt</TableHead><TableHead>BP</TableHead><TableHead>FBS</TableHead><TableHead>PPBS</TableHead><TableHead>HbA1c</TableHead><TableHead>Waist</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map((v: any) => (
              <TableRow key={v.id}>
                <TableCell>{v.recorded_on}</TableCell>
                <TableCell>{v.weight_kg ?? "—"}</TableCell>
                <TableCell>{v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"}</TableCell>
                <TableCell>{v.fasting_glucose ?? "—"}</TableCell>
                <TableCell>{v.post_meal_glucose ?? "—"}</TableCell>
                <TableCell>{v.hba1c != null ? `${v.hba1c}%` : "—"}</TableCell>
                <TableCell>{v.waist_cm ?? "—"}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No vitals recorded.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PatientLabs({ patientId }: { patientId: string }) {
  const { data = [] } = useQuery({ queryKey: ["patient-labs", patientId], queryFn: () => listLabResults({ data: { patient_id: patientId } }) });
  return (
    <Card>
      <CardHeader><CardTitle>Lab results</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Test</TableHead><TableHead>Value</TableHead><TableHead>Lab</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.performed_on}</TableCell>
                <TableCell className="font-medium">{r.test_name}</TableCell>
                <TableCell>{r.value_numeric ?? r.value_text ?? "—"}{r.unit ? ` ${r.unit}` : ""}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.lab_name || ""}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No results.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PatientRx({ patientId }: { patientId: string }) {
  const { data = [] } = useQuery({ queryKey: ["patient-rx", patientId], queryFn: () => listPrescriptions({ data: { patient_id: patientId } }) });
  const { data: reds = [] } = useQuery({ queryKey: ["patient-reds", patientId], queryFn: () => listReductions({ data: { patient_id: patientId } }) });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Prescriptions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.map((rx: any) => (
            <div key={rx.id} className="border rounded p-3">
              <div className="text-xs text-muted-foreground">{new Date(rx.issued_at).toLocaleString()} · {rx.doctor?.full_name || "—"}</div>
              {rx.diagnosis && <div className="text-sm mt-1"><span className="text-muted-foreground">Dx:</span> {rx.diagnosis}</div>}
              {rx.items?.length > 0 && (
                <ul className="mt-2 text-sm space-y-1">
                  {rx.items.map((it: any) => (
                    <li key={it.id} className="pl-2 border-l-2 border-primary/50">
                      <span className="font-medium">{it.medicine_name}</span>
                      {it.dose && <> · {it.dose}</>}{it.frequency && <> · {it.frequency}</>}{it.duration && <> · {it.duration}</>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No prescriptions.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Medication reductions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Medicine</TableHead><TableHead>Baseline → Current</TableHead><TableHead>Reduction</TableHead></TableRow></TableHeader>
            <TableBody>
              {reds.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.recorded_on}</TableCell>
                  <TableCell className="font-medium">{r.medicine_name}</TableCell>
                  <TableCell>{r.baseline_dose || "—"} → {r.current_dose || "—"}</TableCell>
                  <TableCell>{r.reduction_percent != null ? <Badge>{r.reduction_percent}%</Badge> : "—"}</TableCell>
                </TableRow>
              ))}
              {reds.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">None.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PatientDiet({ patientId }: { patientId: string }) {
  const { data = [] } = useQuery({ queryKey: ["patient-diet", patientId], queryFn: () => listDietPlans({ data: { patient_id: patientId } }) });
  return (
    <Card>
      <CardHeader><CardTitle>Diet plans</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {data.map((p: any) => (
          <div key={p.id} className="border rounded p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-muted-foreground">{p.start_date}{p.end_date ? ` → ${p.end_date}` : ""}{p.daily_calories ? ` · ${p.daily_calories} kcal` : ""}</div>
              </div>
              <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Ended"}</Badge>
            </div>
            {Array.isArray(p.meals) && p.meals.length > 0 && (
              <ul className="mt-2 text-sm space-y-1">
                {p.meals.map((m: any, i: number) => (
                  <li key={i} className="pl-2 border-l-2 border-primary/50"><span className="font-medium">{m.meal}{m.time ? ` · ${m.time}` : ""}:</span> {m.items}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No diet plans.</p>}
      </CardContent>
    </Card>
  );
}

function PatientInventory({ patientId }: { patientId: string }) {
  return <PatientDevicesTab patientId={patientId} />;
}

const schedColor: Record<string, string> = {
  pending: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  overdue: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  waived: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

function PatientPayments({ patientId }: { patientId: string }) {
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["patient-enrollments", patientId],
    queryFn: () => listEnrollmentsForPatient({ data: { patient_id: patientId } }),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>;
  }
  if ((enrollments as any[]).length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No enrollments yet. Enroll this patient from the Payments page.
        </CardContent>
      </Card>
    );
  }

  const grandPaid = (enrollments as any[]).reduce(
    (s, e) => s + (e.payments ?? []).reduce((x: number, p: any) => x + Number(p.amount_bdt), 0),
    0,
  );
  const grandNet = (enrollments as any[]).reduce((s, e) => s + Number(e.net_amount_bdt), 0);
  const grandDue = Math.max(0, grandNet - grandPaid);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetaCard label="Total billable" value={`৳ ${grandNet.toLocaleString()}`} />
        <MetaCard label="Total paid" value={`৳ ${grandPaid.toLocaleString()}`} />
        <MetaCard label="Outstanding" value={`৳ ${grandDue.toLocaleString()}`} />
      </div>

      {(enrollments as any[]).map((e) => {
        const paid = (e.payments ?? []).reduce((x: number, p: any) => x + Number(p.amount_bdt), 0);
        const net = Number(e.net_amount_bdt);
        const due = Math.max(0, net - paid);
        return (
          <Card key={e.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base">{e.plan?.name ?? "Plan"}</CardTitle>
                  <CardDescription>
                    {e.start_date}{e.end_date ? ` → ${e.end_date}` : ""} · {e.plan?.billing_frequency?.replace("_", " ")}
                  </CardDescription>
                </div>
                <div className="text-right text-sm">
                  <div>Net <span className="font-mono">৳ {net.toLocaleString()}</span></div>
                  <div className="text-emerald-600">Paid <span className="font-mono">৳ {paid.toLocaleString()}</span></div>
                  <div className={due > 0 ? "text-rose-600" : "text-muted-foreground"}>
                    Due <span className="font-mono">৳ {due.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(e.schedule ?? []).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Schedule</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(e.schedule as any[]).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.installment_no}</TableCell>
                          <TableCell>{s.due_date}</TableCell>
                          <TableCell className="text-right font-mono">
                            {Number(s.amount_bdt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {Number(s.paid_amount_bdt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={schedColor[s.status] + " border-0 capitalize"} variant="secondary">
                              {s.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {(e.payments ?? []).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Payments received</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Ref</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(e.payments as any[]).map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.receipt_no}</TableCell>
                          <TableCell>{p.paid_on}</TableCell>
                          <TableCell className="text-right font-mono">
                            {Number(p.amount_bdt).toLocaleString()}
                          </TableCell>
                          <TableCell className="capitalize">{p.method.replace("_", " ")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.reference ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PortalLinkCard({ patientId, email, userId }: { patientId: string; email: string | null; userId: string | null }) {
  const { hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const [emailInput, setEmailInput] = useState(email ?? "");
  const [invite, setInvite] = useState(true);
  const isAdmin = hasAnyRole(["super_admin", "admin"]);

  const linkMut = useMutation({
    mutationFn: () =>
      linkPatientToUser({
        data: {
          patient_id: patientId,
          email: emailInput.trim(),
          invite,
          redirect_origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Patient portal linked");
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to link"),
  });

  const unlinkMut = useMutation({
    mutationFn: () => unlinkPatientUser({ data: { patient_id: patientId } }),
    onSuccess: () => {
      toast.success("Portal access removed");
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Patient portal access</CardTitle>
        <CardDescription>
          {userId
            ? "This patient can sign in to the portal and see their own records."
            : "Link an account so this patient can sign in and see their own records."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {userId ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <span className="font-medium">Linked</span>
              <span className="text-muted-foreground"> · {email ?? "no email on file"}</span>
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => unlinkMut.mutate()} disabled={unlinkMut.isPending}>
                Unlink
              </Button>
            )}
          </div>
        ) : !isAdmin ? (
          <div className="text-sm text-muted-foreground">Not linked yet.</div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="link-email">Account email</Label>
              <Input
                id="link-email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="patient@example.com"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={invite} onCheckedChange={(v) => setInvite(!!v)} />
              Invite if no account exists
            </label>
            <Button onClick={() => linkMut.mutate()} disabled={!emailInput || linkMut.isPending}>
              {linkMut.isPending ? "Linking…" : "Link account"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OutcomesPDFButton({ patientId, patient }: { patientId: string; patient: any }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const [outcome, vitals, reductions, labs] = await Promise.all([
        getPatientOutcome({ data: { patient_id: patientId } }),
        listVitals({ data: { patient_id: patientId } }),
        listReductions({ data: { patient_id: patientId } }),
        listLabResults({ data: { patient_id: patientId } }),
      ]);
      generateOutcomesSummaryPDF({ patient, outcome, vitals, reductions, labs });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to build PDF");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={go} disabled={busy}>
      <TrendingUp className="h-4 w-4 mr-2" />
      {busy ? "Building…" : "Outcomes PDF"}
    </Button>
  );
}


