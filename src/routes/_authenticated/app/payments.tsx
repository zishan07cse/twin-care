import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listAllPayments,
  listPatientsForBilling,
  listEnrollmentsForPatient,
  listPlans,
  enrollPatient,
  recordPayment,
} from "@/lib/billing.functions";
import { getPlanInclusionsPreview } from "@/lib/plan-services.functions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Wallet, FileDown } from "lucide-react";
import { toast } from "sonner";
import { generateReceiptPDF } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/app/payments")({
  component: PaymentsPage,
});

const schedColor: Record<string, string> = {
  pending: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  overdue: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  waived: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

function PaymentsPage() {
  const { hasAnyRole } = useAuth();
  const canView = hasAnyRole([
    "super_admin",
    "admin",
    "care_coordinator",
    "finance",
  ]);

  const listFn = useServerFn(listAllPayments);
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => listFn(),
    enabled: canView,
  });

  const [recordOpen, setRecordOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const totals = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);
    let all = 0,
      month = 0,
      todayTotal = 0;
    for (const p of payments as any[]) {
      const amt = Number(p.amount_bdt);
      all += amt;
      if (p.paid_on?.startsWith(thisMonth)) month += amt;
      if (p.paid_on === today) todayTotal += amt;
    }
    return { all, month, today: todayTotal };
  }, [payments]);

  if (!canView) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">
          You do not have access to this page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Enrollments, installment schedules, and recorded transactions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEnrollOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Enroll patient
          </Button>
          <Button onClick={() => setRecordOpen(true)}>
            <Wallet className="h-4 w-4 mr-1" /> Record payment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Today" value={totals.today} />
        <StatCard label="This month" value={totals.month} />
        <StatCard label="All time" value={totals.all} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent payments</CardTitle>
          <CardDescription>Latest 500 transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : (payments as any[]).length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No payments yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 pr-4">Receipt</th>
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-left py-2 pr-4">Patient</th>
                    <th className="text-left py-2 pr-4">Plan</th>
                    <th className="text-right py-2 pr-4">Amount (৳)</th>
                    <th className="text-left py-2 pr-4">Method</th>
                    <th className="text-left py-2 pr-4">Ref</th>
                    <th className="text-right py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {(payments as any[]).map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">
                        {p.receipt_no}
                      </td>
                      <td className="py-2 pr-4">{p.paid_on}</td>
                      <td className="py-2 pr-4">
                        <div className="font-medium">
                          {p.enrollment?.patient?.full_name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {p.enrollment?.patient?.patient_code}
                        </div>
                      </td>
                      <td className="py-2 pr-4">{p.enrollment?.plan?.name}</td>
                      <td className="py-2 pr-4 text-right font-mono">
                        {Number(p.amount_bdt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 capitalize">
                        {p.method.replace("_", " ")}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">
                        {p.reference ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => generateReceiptPDF(p)}>
                          <FileDown className="h-3.5 w-3.5 mr-1" />Receipt
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RecordPaymentDialog open={recordOpen} onOpenChange={setRecordOpen} />
      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">
          ৳ {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

function EnrollDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const patientsFn = useServerFn(listPatientsForBilling);
  const plansFn = useServerFn(listPlans);
  const enrollFn = useServerFn(enrollPatient);
  const qc = useQueryClient();

  const { data: patients = [] } = useQuery({
    queryKey: ["billing-patients"],
    queryFn: () => patientsFn(),
    enabled: open,
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: () => plansFn(),
    enabled: open,
  });
  const inclusionsFn = useServerFn(getPlanInclusionsPreview);

  const [patientId, setPatientId] = useState("");
  const [planId, setPlanId] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      enrollFn({
        data: {
          patient_id: patientId,
          plan_id: planId,
          start_date: start,
          discount_bdt: discount,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Patient enrolled in plan");
      qc.invalidateQueries({ queryKey: ["payments"] });
      onOpenChange(false);
      setPatientId("");
      setPlanId("");
      setDiscount(0);
      setNotes("");
    },
    onError: (e) => toast.error("Enroll failed", { description: (e as Error).message }),
  });

  const plan = (plans as any[]).find((p) => p.id === planId);
  const total = plan ? Number(plan.total_price_bdt) : 0;
  const net = Math.max(0, total - discount);

  const { data: inclusions } = useQuery({
    queryKey: ["plan-inclusions-preview", planId],
    queryFn: () => inclusionsFn({ data: { plan_id: planId } }),
    enabled: !!planId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll patient in program</DialogTitle>
          <DialogDescription>
            Generates a payment schedule based on the plan's billing frequency.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!patientId || !planId) return;
            mut.mutate();
          }}
        >
          <div className="space-y-1">
            <Label>Patient</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                {(patients as any[]).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.patient_code} · {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {(plans as any[])
                  .filter((p) => p.is_active)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · ৳ {Number(p.total_price_bdt).toLocaleString()} ·{" "}
                      {p.duration_months} mo
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start date</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Discount (৳)</Label>
              <Input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          {plan && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono">৳ {total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-mono">− ৳ {discount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Net billable</span>
                <span className="font-mono">৳ {net.toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted-foreground pt-1 capitalize">
                Billing: {plan.billing_frequency.replace("_", " ")} · {plan.duration_months} months
              </div>
            </div>
          )}
          {plan && inclusions && (inclusions.devices.length > 0 || inclusions.services.length > 0) && (
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase">
                Package includes
              </div>
              {inclusions.services.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Services</div>
                  <ul className="space-y-0.5">
                    {(inclusions.services as any[]).map((s) => (
                      <li key={s.id} className="flex justify-between">
                        <span>{s.label}</span>
                        <span className="text-muted-foreground">
                          {s.frequency === "unlimited"
                            ? "Unlimited"
                            : `${s.quantity} ${s.frequency.replace("_", " ")}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {inclusions.devices.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Devices & supplies</div>
                  <ul className="space-y-0.5">
                    {(inclusions.devices as any[]).map((d) => (
                      <li key={d.id} className="flex justify-between">
                        <span>{d.item?.name_en}</span>
                        <span className="text-muted-foreground">
                          × {d.quantity}
                          {d.ownership_mode !== "free" ? ` · ${d.ownership_mode}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mut.isPending || !patientId || !planId}
            >
              {mut.isPending ? "Enrolling…" : "Enroll & generate schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const patientsFn = useServerFn(listPatientsForBilling);
  const enrollmentsFn = useServerFn(listEnrollmentsForPatient);
  const payFn = useServerFn(recordPayment);
  const qc = useQueryClient();

  const [patientId, setPatientId] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [scheduleId, setScheduleId] = useState<string>("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<
    "cash" | "bkash" | "nagad" | "card" | "bank_transfer" | "cheque" | "other"
  >("bkash");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const { data: patients = [] } = useQuery({
    queryKey: ["billing-patients"],
    queryFn: () => patientsFn(),
    enabled: open,
  });
  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments-for", patientId],
    queryFn: () => enrollmentsFn({ data: { patient_id: patientId } }),
    enabled: open && !!patientId,
  });

  const enrollment = (enrollments as any[]).find((e) => e.id === enrollmentId);
  const schedule = enrollment?.schedule ?? [];

  const mut = useMutation({
    mutationFn: () =>
      payFn({
        data: {
          enrollment_id: enrollmentId,
          schedule_id: scheduleId || null,
          amount_bdt: amount,
          method,
          reference: reference || null,
          paid_on: paidOn,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["enrollments-for", patientId] });
      onOpenChange(false);
      setEnrollmentId("");
      setScheduleId("");
      setAmount(0);
      setReference("");
      setNotes("");
    },
    onError: (e) => toast.error("Failed", { description: (e as Error).message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Applies against a schedule installment if selected.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!enrollmentId || amount <= 0) return;
            mut.mutate();
          }}
        >
          <div className="space-y-1">
            <Label>Patient</Label>
            <Select
              value={patientId}
              onValueChange={(v) => {
                setPatientId(v);
                setEnrollmentId("");
                setScheduleId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                {(patients as any[]).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.patient_code} · {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {patientId && (
            <div className="space-y-1">
              <Label>Enrollment</Label>
              <Select value={enrollmentId} onValueChange={setEnrollmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select enrollment" />
                </SelectTrigger>
                <SelectContent>
                  {(enrollments as any[]).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.plan?.name} · ৳{" "}
                      {Number(e.net_amount_bdt).toLocaleString()} ·{" "}
                      {e.start_date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {enrollment && schedule.length > 0 && (
            <div className="space-y-1">
              <Label>Apply to installment (optional)</Label>
              <Select
                value={scheduleId || "unset"}
                onValueChange={(v) => {
                  setScheduleId(v === "unset" ? "" : v);
                  const s = schedule.find((x: any) => x.id === v);
                  if (s) {
                    const due = Number(s.amount_bdt) - Number(s.paid_amount_bdt);
                    setAmount(due > 0 ? due : 0);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">— Ad-hoc payment —</SelectItem>
                  {schedule.map((s: any) => {
                    const remaining =
                      Number(s.amount_bdt) - Number(s.paid_amount_bdt);
                    return (
                      <SelectItem
                        key={s.id}
                        value={s.id}
                        disabled={s.status === "paid"}
                      >
                        #{s.installment_no} · Due {s.due_date} · ৳{" "}
                        {remaining.toLocaleString()} ({s.status})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1 mt-2">
                {schedule.map((s: any) => (
                  <Badge
                    key={s.id}
                    className={schedColor[s.status] + " border-0 capitalize"}
                    variant="secondary"
                  >
                    #{s.installment_no} {s.status}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount (৳)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Paid on</Label>
              <Input
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Reference / TxID</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mut.isPending || !enrollmentId || amount <= 0}
            >
              {mut.isPending ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
