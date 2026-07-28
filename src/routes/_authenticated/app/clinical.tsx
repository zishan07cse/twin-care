import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listMedicines,
  upsertMedicine,
  deleteMedicine,
  listPrescriptions,
  createPrescription,
  deletePrescription,
  listDietPlans,
  upsertDietPlan,
  deleteDietPlan,
  listReductions,
  createReduction,
  listPatientsForClinical,
  listDoctorsForClinical,
  listNutritionistsForClinical,
} from "@/lib/clinical.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Pill, ClipboardList, Apple, TrendingDown, FileDown } from "lucide-react";
import { generatePrescriptionPDF, generateDietChartPDF } from "@/lib/pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/clinical")({
  component: ClinicalPage,
});

function ClinicalPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clinical</h1>
        <p className="text-sm text-muted-foreground">
          Medicines catalog, prescriptions, diet plans, and medication reduction tracking.
        </p>
      </div>

      <Tabs defaultValue="prescriptions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prescriptions">
            <ClipboardList className="h-4 w-4 mr-2" />
            Prescriptions
          </TabsTrigger>
          <TabsTrigger value="diet">
            <Apple className="h-4 w-4 mr-2" />
            Diet plans
          </TabsTrigger>
          <TabsTrigger value="reductions">
            <TrendingDown className="h-4 w-4 mr-2" />
            Med reductions
          </TabsTrigger>
          <TabsTrigger value="medicines">
            <Pill className="h-4 w-4 mr-2" />
            Medicines
          </TabsTrigger>
        </TabsList>
        <TabsContent value="prescriptions"><PrescriptionsTab /></TabsContent>
        <TabsContent value="diet"><DietPlansTab /></TabsContent>
        <TabsContent value="reductions"><ReductionsTab /></TabsContent>
        <TabsContent value="medicines"><MedicinesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Medicines Tab ============
function MedicinesTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["medicines"], queryFn: () => listMedicines() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((m: any) =>
      [m.name, m.generic_name, m.manufacturer].filter(Boolean).some((s: string) => s.toLowerCase().includes(q))
    );
  }, [data, search]);

  const del = useMutation({
    mutationFn: (id: string) => deleteMedicine({ data: { id } }),
    onSuccess: () => {
      toast.success("Medicine removed");
      qc.invalidateQueries({ queryKey: ["medicines"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Medicines catalog</CardTitle>
          <CardDescription>Reference list used by prescriptions</CardDescription>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add medicine
        </Button>
      </CardHeader>
      <CardContent>
        <Input
          placeholder="Search by name, generic, manufacturer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 max-w-sm"
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Generic</TableHead>
                <TableHead>Strength</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.generic_name || "—"}</TableCell>
                  <TableCell>{m.strength || "—"}</TableCell>
                  <TableCell>{m.form || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={m.is_active ? "default" : "secondary"}>
                      {m.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No medicines yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <MedicineDialog open={open} onOpenChange={setOpen} initial={editing} />
    </Card>
  );
}

function MedicineDialog({ open, onOpenChange, initial }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(() => initial ?? { name: "", is_active: true });
  const mut = useMutation({
    mutationFn: (v: any) => upsertMedicine({ data: v }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["medicines"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) setForm(initial ?? { name: "", is_active: true }); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit medicine" : "Add medicine"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Generic name</Label><Input value={form.generic_name || ""} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} /></div>
            <div><Label>Manufacturer</Label><Input value={form.manufacturer || ""} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Strength</Label><Input placeholder="500 mg" value={form.strength || ""} onChange={(e) => setForm({ ...form, strength: e.target.value })} /></div>
            <div><Label>Form</Label>
              <Select value={form.form || ""} onValueChange={(v) => setForm({ ...form, form: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["tablet","capsule","syrup","injection","cream","drops","inhaler","other"].map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active !== false} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!form.name || mut.isPending} onClick={() => mut.mutate(form)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Prescriptions Tab ============
function PrescriptionsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["prescriptions"], queryFn: () => listPrescriptions({ data: {} }) });
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: (id: string) => deletePrescription({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["prescriptions"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Prescriptions</CardTitle>
          <CardDescription>Doctor-issued medication instructions</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New prescription</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="space-y-3">
            {data.map((rx: any) => (
              <div key={rx.id} className="border rounded-md p-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{rx.patient?.full_name} <span className="text-muted-foreground">· {rx.patient?.patient_code}</span></div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(rx.issued_at).toLocaleString()} · {rx.doctor?.full_name || "No doctor"}
                    </div>
                    {rx.diagnosis && <div className="text-sm mt-1"><span className="text-muted-foreground">Dx:</span> {rx.diagnosis}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => generatePrescriptionPDF(rx)}><FileDown className="h-3.5 w-3.5 mr-1" />PDF</Button>
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(rx.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {rx.items?.length > 0 && (
                  <ul className="mt-2 text-sm space-y-1">
                    {rx.items.map((it: any) => (
                      <li key={it.id} className="pl-2 border-l-2 border-primary/50">
                        <span className="font-medium">{it.medicine_name}</span>
                        {it.dose && <> · {it.dose}</>}
                        {it.frequency && <> · {it.frequency}</>}
                        {it.duration && <> · {it.duration}</>}
                        {it.instructions && <div className="text-xs text-muted-foreground">{it.instructions}</div>}
                      </li>
                    ))}
                  </ul>
                )}
                {rx.advice && <div className="mt-2 text-sm"><span className="text-muted-foreground">Advice:</span> {rx.advice}</div>}
              </div>
            ))}
            {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No prescriptions yet.</p>}
          </div>
        )}
      </CardContent>
      <PrescriptionDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function PrescriptionDialog({ open, onOpenChange }: any) {
  const qc = useQueryClient();
  const { data: patients = [] } = useQuery({ queryKey: ["clinical-patients"], queryFn: () => listPatientsForClinical(), enabled: open });
  const { data: doctors = [] } = useQuery({ queryKey: ["clinical-doctors"], queryFn: () => listDoctorsForClinical(), enabled: open });
  const { data: meds = [] } = useQuery({ queryKey: ["medicines"], queryFn: () => listMedicines(), enabled: open });
  const [form, setForm] = useState<any>({ patient_id: "", doctor_id: "", diagnosis: "", advice: "", follow_up_at: "" });
  const [items, setItems] = useState<any[]>([{ medicine_id: "", medicine_name: "", dose: "", frequency: "", duration: "", instructions: "" }]);

  const mut = useMutation({
    mutationFn: (v: any) => createPrescription({ data: v }),
    onSuccess: () => {
      toast.success("Prescription saved");
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      onOpenChange(false);
      setForm({ patient_id: "", doctor_id: "", diagnosis: "", advice: "", follow_up_at: "" });
      setItems([{ medicine_id: "", medicine_name: "", dose: "", frequency: "", duration: "", instructions: "" }]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New prescription</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Patient *</Label>
              <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} · {p.patient_code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Doctor</Label>
              <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Diagnosis</Label><Textarea rows={2} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Medicines</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems([...items, { medicine_id: "", medicine_name: "", dose: "", frequency: "", duration: "", instructions: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="border rounded p-2 space-y-2">
                  <div className="grid grid-cols-6 gap-2">
                    <div className="col-span-2">
                      <Select value={it.medicine_id} onValueChange={(v) => {
                        const m = meds.find((mm: any) => mm.id === v);
                        const cp = [...items]; cp[i] = { ...cp[i], medicine_id: v, medicine_name: m?.name || cp[i].medicine_name }; setItems(cp);
                      }}>
                        <SelectTrigger><SelectValue placeholder="Pick or type below" /></SelectTrigger>
                        <SelectContent>{meds.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}{m.strength ? ` ${m.strength}` : ""}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Input className="col-span-2" placeholder="Medicine name *" value={it.medicine_name} onChange={(e) => { const cp = [...items]; cp[i].medicine_name = e.target.value; setItems(cp); }} />
                    <Input placeholder="Dose" value={it.dose} onChange={(e) => { const cp = [...items]; cp[i].dose = e.target.value; setItems(cp); }} />
                    <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, x) => x !== i))} disabled={items.length === 1}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Frequency (1+0+1)" value={it.frequency} onChange={(e) => { const cp = [...items]; cp[i].frequency = e.target.value; setItems(cp); }} />
                    <Input placeholder="Duration (7 days)" value={it.duration} onChange={(e) => { const cp = [...items]; cp[i].duration = e.target.value; setItems(cp); }} />
                    <Input placeholder="Instructions" value={it.instructions} onChange={(e) => { const cp = [...items]; cp[i].instructions = e.target.value; setItems(cp); }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div><Label>Advice</Label><Textarea rows={2} value={form.advice} onChange={(e) => setForm({ ...form, advice: e.target.value })} /></div>
          <div><Label>Follow-up date</Label><Input type="datetime-local" value={form.follow_up_at} onChange={(e) => setForm({ ...form, follow_up_at: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!form.patient_id || items.some((i) => !i.medicine_name.trim()) || mut.isPending}
            onClick={() => mut.mutate({ ...form, items })}
          >Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Diet Plans Tab ============
function DietPlansTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["diet-plans"], queryFn: () => listDietPlans({ data: {} }) });
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: (id: string) => deleteDietPlan({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["diet-plans"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Diet plans</CardTitle>
          <CardDescription>Meal plans issued by nutritionists</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New plan</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="space-y-3">
            {data.map((p: any) => (
              <div key={p.id} className="border rounded-md p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.patient?.full_name} · {p.patient?.patient_code} · {p.start_date}{p.end_date ? ` → ${p.end_date}` : ""}
                      {p.daily_calories ? ` · ${p.daily_calories} kcal/day` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Ended"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => generateDietChartPDF(p)}><FileDown className="h-3.5 w-3.5 mr-1" />PDF</Button>
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {Array.isArray(p.meals) && p.meals.length > 0 && (
                  <ul className="mt-2 text-sm space-y-1">
                    {p.meals.map((m: any, i: number) => (
                      <li key={i} className="pl-2 border-l-2 border-primary/50">
                        <span className="font-medium">{m.meal}{m.time ? ` · ${m.time}` : ""}:</span> {m.items}
                      </li>
                    ))}
                  </ul>
                )}
                {p.notes && <div className="text-sm mt-2 text-muted-foreground">{p.notes}</div>}
              </div>
            ))}
            {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No diet plans yet.</p>}
          </div>
        )}
      </CardContent>
      <DietPlanDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function DietPlanDialog({ open, onOpenChange }: any) {
  const qc = useQueryClient();
  const { data: patients = [] } = useQuery({ queryKey: ["clinical-patients"], queryFn: () => listPatientsForClinical(), enabled: open });
  const { data: nutritionists = [] } = useQuery({ queryKey: ["clinical-nutritionists"], queryFn: () => listNutritionistsForClinical(), enabled: open });
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({ patient_id: "", nutritionist_id: "", title: "", start_date: today, end_date: "", daily_calories: "", notes: "", is_active: true });
  const [meals, setMeals] = useState<any[]>([
    { meal: "Breakfast", time: "08:00", items: "" },
    { meal: "Lunch", time: "13:00", items: "" },
    { meal: "Dinner", time: "20:00", items: "" },
  ]);

  const mut = useMutation({
    mutationFn: (v: any) => upsertDietPlan({ data: v }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["diet-plans"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New diet plan</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Patient *</Label>
              <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} · {p.patient_code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nutritionist</Label>
              <Select value={form.nutritionist_id} onValueChange={(v) => setForm({ ...form, nutritionist_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{nutritionists.map((n: any) => <SelectItem key={n.id} value={n.id}>{n.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="4-week reversal diet" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>End</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            <div><Label>Daily kcal</Label><Input type="number" value={form.daily_calories} onChange={(e) => setForm({ ...form, daily_calories: e.target.value })} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Meals</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setMeals([...meals, { meal: "Snack", time: "", items: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add meal
              </Button>
            </div>
            <div className="space-y-2">
              {meals.map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-3" placeholder="Meal" value={m.meal} onChange={(e) => { const cp = [...meals]; cp[i].meal = e.target.value; setMeals(cp); }} />
                  <Input className="col-span-2" placeholder="Time" value={m.time || ""} onChange={(e) => { const cp = [...meals]; cp[i].time = e.target.value; setMeals(cp); }} />
                  <Input className="col-span-6" placeholder="Items" value={m.items} onChange={(e) => { const cp = [...meals]; cp[i].items = e.target.value; setMeals(cp); }} />
                  <Button size="sm" variant="ghost" onClick={() => setMeals(meals.filter((_, x) => x !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          </div>

          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!form.patient_id || !form.title || mut.isPending}
            onClick={() => mut.mutate({
              ...form,
              daily_calories: form.daily_calories ? parseInt(form.daily_calories) : null,
              meals: meals.filter((m) => m.items.trim()),
            })}
          >Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Reductions Tab ============
function ReductionsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["reductions"], queryFn: () => listReductions({ data: {} }) });
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Medication reductions</CardTitle>
          <CardDescription>Log dose reductions to measure clinical outcomes</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Log change</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Medicine</TableHead>
                <TableHead>Baseline</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Reduction</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.recorded_on}</TableCell>
                  <TableCell>{r.patient?.full_name} <span className="text-xs text-muted-foreground">{r.patient?.patient_code}</span></TableCell>
                  <TableCell className="font-medium">{r.medicine_name}</TableCell>
                  <TableCell>{r.baseline_dose || "—"}</TableCell>
                  <TableCell>{r.current_dose || "—"}</TableCell>
                  <TableCell>{r.reduction_percent != null ? <Badge>{r.reduction_percent}%</Badge> : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.notes || ""}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No entries yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <ReductionDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function ReductionDialog({ open, onOpenChange }: any) {
  const qc = useQueryClient();
  const { data: patients = [] } = useQuery({ queryKey: ["clinical-patients"], queryFn: () => listPatientsForClinical(), enabled: open });
  const { data: meds = [] } = useQuery({ queryKey: ["medicines"], queryFn: () => listMedicines(), enabled: open });
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({ patient_id: "", medicine_id: "", medicine_name: "", baseline_dose: "", current_dose: "", recorded_on: today, reduction_percent: "", notes: "" });

  const mut = useMutation({
    mutationFn: (v: any) => createReduction({ data: v }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["reductions"] }); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log medication change</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Patient *</Label>
            <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} · {p.patient_code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Medicine (from catalog)</Label>
              <Select value={form.medicine_id} onValueChange={(v) => {
                const m = meds.find((mm: any) => mm.id === v);
                setForm({ ...form, medicine_id: v, medicine_name: m?.name || form.medicine_name });
              }}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{meds.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Medicine name *</Label><Input value={form.medicine_name} onChange={(e) => setForm({ ...form, medicine_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Baseline dose</Label><Input placeholder="e.g. 500mg BID" value={form.baseline_dose} onChange={(e) => setForm({ ...form, baseline_dose: e.target.value })} /></div>
            <div><Label>Current dose</Label><Input placeholder="e.g. 250mg OD" value={form.current_dose} onChange={(e) => setForm({ ...form, current_dose: e.target.value })} /></div>
            <div><Label>Reduction %</Label><Input type="number" min="0" max="100" value={form.reduction_percent} onChange={(e) => setForm({ ...form, reduction_percent: e.target.value })} /></div>
          </div>
          <div><Label>Date</Label><Input type="date" value={form.recorded_on} onChange={(e) => setForm({ ...form, recorded_on: e.target.value })} /></div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!form.patient_id || !form.medicine_name.trim() || mut.isPending}
            onClick={() => mut.mutate({
              ...form,
              reduction_percent: form.reduction_percent ? parseFloat(form.reduction_percent) : null,
            })}
          >Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
