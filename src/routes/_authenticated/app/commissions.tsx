import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCommissions, setCommissionStatus } from "@/lib/ops.functions";
import { getMonthlyCommissionStatement, listReferrersForStatements } from "@/lib/reports-pdf.functions";
import { generateCommissionStatementPDF } from "@/lib/pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { formatBDT, formatDateBD } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/commissions")({
  component: CommissionsPage,
  errorComponent: ({ error }) => <div className="p-4 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4">Not found</div>,
});

type Row = {
  id: string; referrer_kind: string; basis: string; amount_bdt: number;
  status: string; accrued_at: string;
  patient?: { id: string; patient_code: string; full_name_en: string } | null;
  doctor?: { id: string; name: string } | null;
  hospital?: { id: string; name: string } | null;
};

function CommissionsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCommissions);
  const setStatus = useServerFn(setCommissionStatus);
  const { data = [] } = useQuery({ queryKey: ["commissions"], queryFn: () => list({ data: {} }) });
  const mut = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "paid" | "void" }) => setStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
  });

  const totals = (data as Row[]).reduce(
    (a, r) => {
      a[r.status] = (a[r.status] ?? 0) + Number(r.amount_bdt);
      return a;
    },
    {} as Record<string, number>,
  );

  const [stmtOpen, setStmtOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Referral commissions</h1>
        <Button variant="outline" onClick={() => setStmtOpen(true)}>
          <FileDown className="h-4 w-4 mr-2" />Monthly statement
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["accrued", "approved", "paid", "void"] as const).map((s) => (
          <Card key={s}>
            <CardHeader className="pb-2"><CardTitle className="text-sm capitalize">{s}</CardTitle></CardHeader>
            <CardContent className="text-lg font-semibold">{formatBDT(totals[s] ?? 0)}</CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>All commissions</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Accrued</th><th>Patient</th><th>Referrer</th>
                  <th>Basis</th><th>Amount</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {(data as Row[]).map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2">{formatDateBD(r.accrued_at)}</td>
                    <td>
                      {r.patient ? (
                        <Link to="/app/patients/$patientId" params={{ patientId: r.patient.id }} className="text-primary hover:underline">
                          {r.patient.patient_code} · {r.patient.full_name_en}
                        </Link>
                      ) : "—"}
                    </td>
                    <td>{r.referrer_kind === "doctor" ? r.doctor?.name : r.hospital?.name}</td>
                    <td>{r.basis}</td>
                    <td>{formatBDT(Number(r.amount_bdt))}</td>
                    <td><Badge variant="outline">{r.status}</Badge></td>
                    <td className="text-right space-x-1">
                      {r.status === "accrued" && (
                        <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: r.id, status: "approved" })}>Approve</Button>
                      )}
                      {r.status === "approved" && (
                        <Button size="sm" onClick={() => mut.mutate({ id: r.id, status: "paid" })}>Mark paid</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No commissions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <MonthlyStatementDialog open={stmtOpen} onOpenChange={setStmtOpen} />
    </div>
  );
}

function MonthlyStatementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const listRefs = useServerFn(listReferrersForStatements);
  const getStmt = useServerFn(getMonthlyCommissionStatement);
  const { data: refs } = useQuery({
    queryKey: ["statement-referrers"],
    queryFn: () => listRefs(),
    enabled: open,
  });
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [kind, setKind] = useState<"doctor" | "hospital">("doctor");
  const [referrerId, setReferrerId] = useState("");
  const [period, setPeriod] = useState(defaultPeriod);
  const [busy, setBusy] = useState(false);

  const options =
    kind === "doctor"
      ? (refs?.doctors ?? []).map((d: any) => ({ id: d.id, name: d.full_name }))
      : (refs?.hospitals ?? []).map((h: any) => ({ id: h.id, name: h.name }));

  async function download() {
    if (!referrerId) return;
    setBusy(true);
    try {
      const res = await getStmt({ data: { referrer_kind: kind, referrer_id: referrerId, period } });
      if (!res.rows.length) {
        toast.info("No commissions for this period");
      } else {
        generateCommissionStatementPDF({
          period,
          referrer_kind: kind,
          referrer_name: res.referrer_name,
          rows: res.rows as any,
        });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to build statement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Monthly commission statement</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Referrer type</Label>
            <Select value={kind} onValueChange={(v: any) => { setKind(v); setReferrerId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="doctor">Doctor</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Referrer</Label>
            <Select value={referrerId} onValueChange={setReferrerId}>
              <SelectTrigger><SelectValue placeholder="Select referrer" /></SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Month (YYYY-MM)</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={!referrerId || busy} onClick={download}>
            <FileDown className="h-4 w-4 mr-2" />{busy ? "Generating…" : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
