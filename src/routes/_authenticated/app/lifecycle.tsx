import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listExpiringEnrollments,
  closeEnrollment,
  getChurnReport,
  listActivePlansSlim,
} from "@/lib/lifecycle.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, RefreshCw, CheckCircle2, XCircle, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { formatBDT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/lifecycle")({
  component: LifecyclePage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

type Action = "renewed" | "completed" | "dropped";

function LifecyclePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Program lifecycle</h1>
        <p className="text-sm text-muted-foreground">
          Renewal alerts, completion &amp; drop wizards, and churn analysis.
        </p>
      </div>
      <Tabs defaultValue="expiring">
        <TabsList>
          <TabsTrigger value="expiring"><CalendarClock className="h-4 w-4 mr-2" />Expiring</TabsTrigger>
          <TabsTrigger value="churn"><TrendingDown className="h-4 w-4 mr-2" />Churn report</TabsTrigger>
        </TabsList>
        <TabsContent value="expiring"><ExpiringTab /></TabsContent>
        <TabsContent value="churn"><ChurnTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ExpiringTab() {
  const listFn = useServerFn(listExpiringEnrollments);
  const [horizon, setHorizon] = useState(60);
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["lifecycle-expiring", horizon],
    queryFn: () => listFn({ data: { days_ahead: horizon } }),
  });
  const [target, setTarget] = useState<any>(null);
  const [action, setAction] = useState<Action>("renewed");

  const buckets = { "0-15": [] as any[], "16-30": [] as any[], "31-60": [] as any[], "61+": [] as any[] };
  for (const e of data as any[]) {
    if (e.days_to_end <= 15) buckets["0-15"].push(e);
    else if (e.days_to_end <= 30) buckets["16-30"].push(e);
    else if (e.days_to_end <= 60) buckets["31-60"].push(e);
    else buckets["61+"].push(e);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="text-sm">Show enrollments ending in:</Label>
        <Select value={String(horizon)} onValueChange={(v) => setHorizon(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="60">60 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <BucketCard label="Ending ≤ 15d" value={buckets["0-15"].length} tone="destructive" />
        <BucketCard label="16–30 days" value={buckets["16-30"].length} tone="warning" />
        <BucketCard label="31–60 days" value={buckets["31-60"].length} tone="default" />
        <BucketCard label="61+ days" value={buckets["61+"].length} tone="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enrollments approaching end</CardTitle>
          <CardDescription>Renew, complete, or drop each program.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (data as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nothing ending in this window.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>End date</TableHead>
                  <TableHead>Days left</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data as any[]).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link
                        to="/app/patients/$patientId"
                        params={{ patientId: e.patient?.id }}
                        className="text-primary hover:underline"
                      >
                        {e.patient?.full_name}
                      </Link>
                      <div className="text-xs text-muted-foreground font-mono">{e.patient?.patient_code}</div>
                    </TableCell>
                    <TableCell>{e.plan?.name}</TableCell>
                    <TableCell>{e.end_date}</TableCell>
                    <TableCell>
                      <Badge variant={e.days_to_end <= 15 ? "destructive" : e.days_to_end <= 30 ? "default" : "outline"}>
                        {e.days_to_end}d
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" onClick={() => { setTarget(e); setAction("renewed"); }}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />Renew
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setTarget(e); setAction("completed"); }}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Complete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setTarget(e); setAction("dropped"); }}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />Drop
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CloseWizard
        enrollment={target}
        action={action}
        onOpenChange={(v) => !v && setTarget(null)}
      />
    </div>
  );
}

function BucketCard({ label, value, tone }: { label: string; value: number; tone: "destructive" | "warning" | "default" | "muted" }) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function CloseWizard({ enrollment, action, onOpenChange }: { enrollment: any; action: Action; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const closeFn = useServerFn(closeEnrollment);
  const plansFn = useServerFn(listActivePlansSlim);
  const { data: plans = [] } = useQuery({
    queryKey: ["lifecycle-plans"],
    queryFn: () => plansFn(),
    enabled: !!enrollment && action === "renewed",
  });

  const [reason, setReason] = useState("");
  const [recover, setRecover] = useState(true);
  const [newPlanId, setNewPlanId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);

  const mut = useMutation({
    mutationFn: () =>
      closeFn({
        data: {
          enrollment_id: enrollment.id,
          closure_type: action,
          reason: reason || null,
          recover_devices: recover,
          new_plan_id: action === "renewed" ? newPlanId : undefined,
          new_start_date: action === "renewed" ? startDate : undefined,
          new_discount_bdt: discount,
        },
      }),
    onSuccess: (res: any) => {
      const parts = [
        action === "renewed" ? "Renewal created" : action === "completed" ? "Marked completed" : "Program dropped",
        res.recovered_devices ? `${res.recovered_devices} device(s) recovered` : null,
      ].filter(Boolean);
      toast.success(parts.join(" · "));
      qc.invalidateQueries({ queryKey: ["lifecycle-expiring"] });
      qc.invalidateQueries({ queryKey: ["churn"] });
      setReason("");
      setNewPlanId("");
      setDiscount(0);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const titles: Record<Action, string> = {
    renewed: "Renew enrollment",
    completed: "Mark program completed",
    dropped: "Drop program",
  };

  return (
    <Dialog open={!!enrollment} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titles[action]}</DialogTitle>
        </DialogHeader>
        {enrollment && (
          <div className="grid gap-3">
            <div className="text-sm rounded-md bg-muted p-3">
              <div className="font-medium">{enrollment.patient?.full_name}</div>
              <div className="text-muted-foreground text-xs">
                {enrollment.patient?.patient_code} · {enrollment.plan?.name} · ends {enrollment.end_date}
              </div>
            </div>

            {action === "renewed" && (
              <>
                <div>
                  <Label>New plan *</Label>
                  <Select value={newPlanId} onValueChange={setNewPlanId}>
                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      {(plans as any[]).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.duration_months}mo · {formatBDT(Number(p.total_price_bdt))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start date *</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Discount (৳)</Label>
                    <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label>{action === "dropped" ? "Drop reason *" : "Notes"}</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={action === "dropped" ? "e.g. affordability, moved city, dissatisfaction" : ""} />
            </div>

            {action !== "renewed" && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={recover} onCheckedChange={(v) => setRecover(!!v)} />
                Return all active devices (mark as recovered)
              </label>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={
              mut.isPending ||
              (action === "renewed" && (!newPlanId || !startDate)) ||
              (action === "dropped" && !reason.trim())
            }
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChurnTab() {
  const churnFn = useServerFn(getChurnReport);
  const [months, setMonths] = useState(6);
  const { data, isLoading } = useQuery({
    queryKey: ["churn", months],
    queryFn: () => churnFn({ data: { months } }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="text-sm">Look back:</Label>
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 months</SelectItem>
            <SelectItem value="6">6 months</SelectItem>
            <SelectItem value="12">12 months</SelectItem>
            <SelectItem value="24">24 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>By month</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Renewed</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Dropped</TableHead>
                    <TableHead className="text-right">Lost ৳</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.by_month ?? []).map((r: any) => (
                    <TableRow key={r.period}>
                      <TableCell className="font-mono">{r.period}</TableCell>
                      <TableCell>{r.renewed}</TableCell>
                      <TableCell>{r.completed}</TableCell>
                      <TableCell className="text-destructive">{r.dropped}</TableCell>
                      <TableCell className="text-right font-mono">{formatBDT(r.drop_amount)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data?.by_month || data.by_month.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No closures in this window.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top drop reasons</CardTitle>
            <CardDescription>Ranked by count</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (data?.drop_reasons ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No drops recorded.</p>
            ) : (
              <ul className="space-y-2">
                {(data?.drop_reasons ?? []).map((r: any, i: number) => (
                  <li key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <span className="truncate pr-2">{r.reason}</span>
                    <Badge variant="secondary">{r.count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent closures</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Closed</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.recent ?? []).slice(0, 30).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.closed_at ? new Date(r.closed_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    {r.patient ? (
                      <Link to="/app/patients/$patientId" params={{ patientId: r.patient.id }} className="text-primary hover:underline">
                        {r.patient.full_name}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{r.plan?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.closure_type === "dropped" ? "destructive" : r.closure_type === "renewed" ? "default" : "secondary"}>
                      {r.closure_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.closure_reason ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(!data?.recent || data.recent.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No recent closures.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
