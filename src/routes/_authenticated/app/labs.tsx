import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listLabTests, upsertLabTest, deleteLabTest,
  listLabResults, createLabResult, deleteLabResult,
  listVitals, createVitals, deleteVitals,
  listPatientsForLabs,
} from "@/lib/labs.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, FlaskConical, Activity, Beaker } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/labs")({
  component: LabsPage,
});

function LabsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Labs & Vitals</h1>
        <p className="text-sm text-muted-foreground">Lab test catalog, results, and vitals tracking.</p>
      </div>
      <Tabs defaultValue="results" className="space-y-4">
        <TabsList>
          <TabsTrigger value="results"><FlaskConical className="h-4 w-4 mr-2" />Lab results</TabsTrigger>
          <TabsTrigger value="vitals"><Activity className="h-4 w-4 mr-2" />Vitals</TabsTrigger>
          <TabsTrigger value="catalog"><Beaker className="h-4 w-4 mr-2" />Test catalog</TabsTrigger>
        </TabsList>
        <TabsContent value="results"><ResultsTab /></TabsContent>
        <TabsContent value="vitals"><VitalsTab /></TabsContent>
        <TabsContent value="catalog"><CatalogTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Catalog =====
function CatalogTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["lab-tests"], queryFn: () => listLabTests() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((t: any) => [t.name, t.category].filter(Boolean).some((s: string) => s.toLowerCase().includes(q)));
  }, [data, search]);
  const del = useMutation({
    mutationFn: (id: string) => deleteLabTest({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["lab-tests"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div><CardTitle>Test catalog</CardTitle><CardDescription>Reference ranges used to flag lab results</CardDescription></div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Add test</Button>
      </CardHeader>
      <CardContent>
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 max-w-sm" />
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Unit</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.category || "—"}</TableCell>
                  <TableCell>{t.unit || "—"}</TableCell>
                  <TableCell>{t.reference_text || (t.reference_low != null && t.reference_high != null ? `${t.reference_low} – ${t.reference_high}` : "—")}</TableCell>
                  <TableCell><Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No tests yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <TestDialog open={open} onOpenChange={setOpen} initial={editing} />
    </Card>
  );
}

function TestDialog({ open, onOpenChange, initial }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(() => initial ?? { name: "", is_active: true });
  const mut = useMutation({
    mutationFn: (v: any) => upsertLabTest({ data: v }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["lab-tests"] }); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) setForm(initial ?? { name: "", is_active: true }); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Edit test" : "Add test"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label><Input placeholder="Metabolic, Lipids…" value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label>Unit</Label><Input placeholder="mg/dL" value={form.unit || ""} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Ref low</Label><Input type="number" value={form.reference_low ?? ""} onChange={(e) => setForm({ ...form, reference_low: e.target.value === "" ? null : parseFloat(e.target.value) })} /></div>
            <div><Label>Ref high</Label><Input type="number" value={form.reference_high ?? ""} onChange={(e) => setForm({ ...form, reference_high: e.target.value === "" ? null : parseFloat(e.target.value) })} /></div>
          </div>
          <div><Label>Reference text (alt)</Label><Input value={form.reference_text || ""} onChange={(e) => setForm({ ...form, reference_text: e.target.value })} placeholder="e.g. Negative / <5.7%" /></div>
          <div className="flex items-center gap-2"><Switch checked={form.is_active !== false} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!form.name || mut.isPending} onClick={() => mut.mutate(form)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Results =====
function flagResult(v: number | null, low: number | null, high: number | null) {
  if (v == null) return null;
  if (low != null && v < low) return "Low";
  if (high != null && v > high) return "High";
  return "Normal";
}

function ResultsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["lab-results"], queryFn: () => listLabResults({ data: {} }) });
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: (id: string) => deleteLabResult({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["lab-results"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div><CardTitle>Lab results</CardTitle><CardDescription>Per-patient measurements with reference flagging</CardDescription></div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add result</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Patient</TableHead><TableHead>Test</TableHead><TableHead>Value</TableHead><TableHead>Flag</TableHead><TableHead>Lab</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((r: any) => {
                const flag = flagResult(r.value_numeric, r.test?.reference_low ?? null, r.test?.reference_high ?? null);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.performed_on}</TableCell>
                    <TableCell>{r.patient?.full_name} <span className="text-xs text-muted-foreground">{r.patient?.patient_code}</span></TableCell>
                    <TableCell className="font-medium">{r.test_name}</TableCell>
                    <TableCell>{r.value_numeric ?? r.value_text ?? "—"}{r.unit ? ` ${r.unit}` : ""}</TableCell>
                    <TableCell>{flag && <Badge variant={flag === "Normal" ? "secondary" : "destructive"}>{flag}</Badge>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.lab_name || ""}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                );
              })}
              {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No results yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <ResultDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function ResultDialog({ open, onOpenChange }: any) {
  const qc = useQueryClient();
  const { data: patients = [] } = useQuery({ queryKey: ["labs-patients"], queryFn: () => listPatientsForLabs(), enabled: open });
  const { data: tests = [] } = useQuery({ queryKey: ["lab-tests"], queryFn: () => listLabTests(), enabled: open });
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({ patient_id: "", test_id: "", test_name: "", value_numeric: "", value_text: "", unit: "", performed_on: today, lab_name: "", notes: "", file_url: "" });
  const mut = useMutation({
    mutationFn: (v: any) => createLabResult({ data: v }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["lab-results"] }); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add lab result</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Patient *</Label>
            <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} · {p.patient_code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Test (catalog)</Label>
              <Select value={form.test_id} onValueChange={(v) => {
                const t = tests.find((tt: any) => tt.id === v);
                setForm({ ...form, test_id: v, test_name: t?.name || form.test_name, unit: t?.unit || form.unit });
              }}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{tests.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Test name *</Label><Input value={form.test_name} onChange={(e) => setForm({ ...form, test_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Value (num)</Label><Input type="number" value={form.value_numeric} onChange={(e) => setForm({ ...form, value_numeric: e.target.value })} /></div>
            <div><Label>Value (text)</Label><Input value={form.value_text} onChange={(e) => setForm({ ...form, value_text: e.target.value })} /></div>
            <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={form.performed_on} onChange={(e) => setForm({ ...form, performed_on: e.target.value })} /></div>
            <div><Label>Lab name</Label><Input value={form.lab_name} onChange={(e) => setForm({ ...form, lab_name: e.target.value })} /></div>
          </div>
          <div><Label>Report link</Label><Input placeholder="https://…" value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} /></div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!form.patient_id || !form.test_name.trim() || mut.isPending}
            onClick={() => mut.mutate({
              ...form,
              value_numeric: form.value_numeric === "" ? null : parseFloat(form.value_numeric),
            })}
          >Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Vitals =====
function VitalsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["vitals"], queryFn: () => listVitals({ data: {} }) });
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: (id: string) => deleteVitals({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["vitals"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div><CardTitle>Vitals</CardTitle><CardDescription>Weight, BP, glucose, HbA1c snapshots</CardDescription></div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Record vitals</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Patient</TableHead>
              <TableHead>Wt (kg)</TableHead><TableHead>BP</TableHead>
              <TableHead>FBS</TableHead><TableHead>PPBS</TableHead>
              <TableHead>HbA1c</TableHead><TableHead>Waist</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell>{v.recorded_on}</TableCell>
                  <TableCell>{v.patient?.full_name} <span className="text-xs text-muted-foreground">{v.patient?.patient_code}</span></TableCell>
                  <TableCell>{v.weight_kg ?? "—"}</TableCell>
                  <TableCell>{v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"}</TableCell>
                  <TableCell>{v.fasting_glucose ?? "—"}</TableCell>
                  <TableCell>{v.post_meal_glucose ?? "—"}</TableCell>
                  <TableCell>{v.hba1c != null ? `${v.hba1c}%` : "—"}</TableCell>
                  <TableCell>{v.waist_cm ?? "—"}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => del.mutate(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No records yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <VitalsDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function VitalsDialog({ open, onOpenChange }: any) {
  const qc = useQueryClient();
  const { data: patients = [] } = useQuery({ queryKey: ["labs-patients"], queryFn: () => listPatientsForLabs(), enabled: open });
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({ patient_id: "", recorded_on: today, weight_kg: "", height_cm: "", waist_cm: "", bp_systolic: "", bp_diastolic: "", pulse_bpm: "", fasting_glucose: "", post_meal_glucose: "", hba1c: "", notes: "" });
  const mut = useMutation({
    mutationFn: (v: any) => createVitals({ data: v }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["vitals"] }); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const num = (k: string) => (
    <Input type="number" step="0.01" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Record vitals</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Patient *</Label>
              <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} · {p.patient_code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={form.recorded_on} onChange={(e) => setForm({ ...form, recorded_on: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Weight (kg)</Label>{num("weight_kg")}</div>
            <div><Label>Height (cm)</Label>{num("height_cm")}</div>
            <div><Label>Waist (cm)</Label>{num("waist_cm")}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>BP systolic</Label>{num("bp_systolic")}</div>
            <div><Label>BP diastolic</Label>{num("bp_diastolic")}</div>
            <div><Label>Pulse (bpm)</Label>{num("pulse_bpm")}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Fasting glucose</Label>{num("fasting_glucose")}</div>
            <div><Label>Post-meal glucose</Label>{num("post_meal_glucose")}</div>
            <div><Label>HbA1c (%)</Label>{num("hba1c")}</div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!form.patient_id || mut.isPending}
            onClick={() => {
              const payload: any = { patient_id: form.patient_id, recorded_on: form.recorded_on, notes: form.notes || null };
              for (const k of ["weight_kg","height_cm","waist_cm","bp_systolic","bp_diastolic","pulse_bpm","fasting_glucose","post_meal_glucose","hba1c"]) {
                payload[k] = form[k] === "" ? null : parseFloat(form[k]);
              }
              mut.mutate(payload);
            }}
          >Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
