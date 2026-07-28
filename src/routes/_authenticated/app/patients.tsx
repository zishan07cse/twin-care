import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listPatients,
  upsertPatient,
  deletePatient,
  getPatient,
  addTimelineNote,
  listAssignmentOptions,
  type PatientValues,
} from "@/lib/patients.functions";
import { MasterDataList } from "@/components/app/master-data-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/patients")({
  component: PatientsPage,
});

type PatientRow = {
  id: string;
  patient_code: string;
  full_name: string;
  full_name_bn: string | null;
  phone: string;
  status: "active" | "paused" | "completed" | "dropped";
  enrolled_on: string;
  city: string | null;
  treating_doctor?: { full_name: string } | null;
  nutritionist?: { full_name: string } | null;
};

const emptyPatient: PatientValues = {
  full_name: "",
  full_name_bn: "",
  phone: "",
  alt_phone: "",
  email: "",
  gender: null,
  date_of_birth: "",
  address: "",
  city: "",
  nid: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  preferred_language: "en",
  status: "active",
  enrolled_on: "",
  height_cm: null,
  weight_kg: null,
  hba1c_baseline: null,
  fbg_baseline: null,
  ppbg_baseline: null,
  bp_systolic_baseline: null,
  bp_diastolic_baseline: null,
  diabetes_years: null,
  comorbidities: [],
  current_medications: "",
  allergies: "",
  referring_doctor_id: "",
  treating_doctor_id: "",
  nutritionist_id: "",
  hospital_id: "",
  notes: "",
};

const COMORBIDITY_OPTIONS = [
  "Hypertension",
  "Dyslipidemia",
  "Cardiovascular disease",
  "Kidney disease",
  "Thyroid disorder",
  "PCOS",
  "Fatty liver",
  "Sleep apnea",
];

const statusColor: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  dropped: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

function num(v: string): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function PatientsPage() {
  const { hasAnyRole } = useAuth();
  const staff = hasAnyRole(["super_admin", "admin", "care_coordinator"]);
  const canDelete = hasAnyRole(["super_admin", "admin"]);

  const list = useServerFn(listPatients);
  const upsert = useServerFn(upsertPatient);
  const del = useServerFn(deletePatient);
  const optionsFn = useServerFn(listAssignmentOptions);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: () => list(),
    enabled: staff,
  });

  const { data: options } = useQuery({
    queryKey: ["assignment-options"],
    queryFn: () => optionsFn(),
    enabled: staff,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PatientRow | null>(null);
  const [form, setForm] = useState<PatientValues>(emptyPatient);
  const [detailId, setDetailId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, values: form } }),
    onSuccess: () => {
      toast.success(editing ? "Patient updated" : "Patient enrolled");
      qc.invalidateQueries({ queryKey: ["patients"] });
      setOpen(false);
    },
    onError: (e) => toast.error("Save failed", { description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (e) => toast.error("Delete failed", { description: (e as Error).message }),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyPatient);
    setOpen(true);
  }

  function openEdit(row: PatientRow) {
    setEditing(row);
    // fetch fresh
    (async () => {
      const list = await (await import("@/lib/patients.functions")).getPatient;
      // simpler: refetch via server fn wrapper is over-engineering; fetch selected item from cache
      const full = (items as any[]).find((p) => p.id === row.id) ?? row;
      setForm({
        full_name: full.full_name ?? "",
        full_name_bn: full.full_name_bn ?? "",
        phone: full.phone ?? "",
        alt_phone: full.alt_phone ?? "",
        email: full.email ?? "",
        gender: full.gender ?? null,
        date_of_birth: full.date_of_birth ?? "",
        address: full.address ?? "",
        city: full.city ?? "",
        nid: full.nid ?? "",
        emergency_contact_name: full.emergency_contact_name ?? "",
        emergency_contact_phone: full.emergency_contact_phone ?? "",
        preferred_language: full.preferred_language ?? "en",
        status: full.status ?? "active",
        enrolled_on: full.enrolled_on ?? "",
        height_cm: full.height_cm,
        weight_kg: full.weight_kg,
        hba1c_baseline: full.hba1c_baseline,
        fbg_baseline: full.fbg_baseline,
        ppbg_baseline: full.ppbg_baseline,
        bp_systolic_baseline: full.bp_systolic_baseline,
        bp_diastolic_baseline: full.bp_diastolic_baseline,
        diabetes_years: full.diabetes_years,
        comorbidities: full.comorbidities ?? [],
        current_medications: full.current_medications ?? "",
        allergies: full.allergies ?? "",
        referring_doctor_id: full.referring_doctor_id ?? "",
        treating_doctor_id: full.treating_doctor_id ?? "",
        nutritionist_id: full.nutritionist_id ?? "",
        hospital_id: full.hospital_id ?? "",
        notes: full.notes ?? "",
      });
      setOpen(true);
    })();
  }

  if (!staff) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">You do not have access to this page.</div>
      </div>
    );
  }

  return (
    <>
      <MasterDataList<PatientRow>
        title="Patients"
        description="Enrolled program participants."
        items={items as PatientRow[]}
        isLoading={isLoading}
        columns={[
          {
            header: "Code",
            cell: (r) => <span className="font-mono text-xs">{r.patient_code}</span>,
          },
          {
            header: "Name",
            cell: (r) => (
              <div className="flex items-center gap-2">
                <button
                  className="text-left hover:underline"
                  onClick={() => setDetailId(r.id)}
                >
                  <div className="font-medium">{r.full_name}</div>
                  {r.full_name_bn && (
                    <div className="text-xs text-muted-foreground">{r.full_name_bn}</div>
                  )}
                </button>
                <Link
                  to="/app/patients/$patientId"
                  params={{ patientId: r.id }}
                  className="text-xs text-primary hover:underline"
                >
                  open →
                </Link>
              </div>
            ),
          },
          { header: "Phone", cell: (r) => r.phone },
          { header: "City", cell: (r) => r.city ?? "—" },
          {
            header: "Doctor",
            cell: (r) => r.treating_doctor?.full_name ?? "—",
          },
          {
            header: "Nutritionist",
            cell: (r) => r.nutritionist?.full_name ?? "—",
          },
          {
            header: "Status",
            cell: (r) => (
              <Badge className={statusColor[r.status] + " capitalize border-0"} variant="secondary">
                {r.status}
              </Badge>
            ),
          },
          { header: "Enrolled", cell: (r) => r.enrolled_on ?? "—" },
        ]}
        searchFn={(r, q) =>
          [r.patient_code, r.full_name, r.full_name_bn, r.phone, r.city]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q))
        }
        onAdd={openNew}
        onEdit={openEdit}
        onDelete={(r) => remove.mutate(r.id)}
        canDelete={canDelete}
        addLabel="Enroll patient"
        emptyLabel="No patients yet. Enroll your first one."
      />

      <PatientFormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        setForm={setForm}
        editing={editing}
        onSubmit={() => save.mutate()}
        saving={save.isPending}
        options={options}
      />

      <PatientDetailDialog
        id={detailId}
        onClose={() => setDetailId(null)}
      />
    </>
  );
}

function PatientFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  editing,
  onSubmit,
  saving,
  options,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: PatientValues;
  setForm: (v: PatientValues) => void;
  editing: PatientRow | null;
  onSubmit: () => void;
  saving: boolean;
  options?: {
    doctors: { id: string; full_name: string; is_referrer: boolean; is_treating: boolean }[];
    nutritionists: { id: string; full_name: string }[];
    hospitals: { id: string; name: string }[];
  };
}) {
  const doctors = options?.doctors ?? [];
  const nutritionists = options?.nutritionists ?? [];
  const hospitals = options?.hospitals ?? [];

  const toggleComorbidity = (c: string) => {
    const cur = form.comorbidities ?? [];
    setForm({
      ...form,
      comorbidities: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit patient" : "Enroll new patient"}</DialogTitle>
          <DialogDescription>
            Capture demographics, medical baseline, and care team assignments.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <Tabs defaultValue="demo" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="demo">Demographics</TabsTrigger>
              <TabsTrigger value="medical">Medical baseline</TabsTrigger>
              <TabsTrigger value="care">Care team</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="demo" className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full name (English) *">
                  <Input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </Field>
                <Field label="Full name (Bengali)">
                  <Input
                    value={form.full_name_bn ?? ""}
                    onChange={(e) => setForm({ ...form, full_name_bn: e.target.value })}
                  />
                </Field>
                <Field label="Phone *">
                  <Input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </Field>
                <Field label="Alt phone">
                  <Input
                    value={form.alt_phone ?? ""}
                    onChange={(e) => setForm({ ...form, alt_phone: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
                <Field label="NID">
                  <Input
                    value={form.nid ?? ""}
                    onChange={(e) => setForm({ ...form, nid: e.target.value })}
                  />
                </Field>
                <Field label="Gender">
                  <Select
                    value={form.gender ?? "unset"}
                    onValueChange={(v) =>
                      setForm({ ...form, gender: v === "unset" ? null : (v as any) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not specified</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date of birth">
                  <Input
                    type="date"
                    value={form.date_of_birth ?? ""}
                    onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  />
                </Field>
                <Field label="City">
                  <Input
                    value={form.city ?? ""}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </Field>
                <Field label="Preferred language">
                  <Select
                    value={form.preferred_language}
                    onValueChange={(v) => setForm({ ...form, preferred_language: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="bn">বাংলা</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Address">
                <Textarea
                  rows={2}
                  value={form.address ?? ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Emergency contact name">
                  <Input
                    value={form.emergency_contact_name ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, emergency_contact_name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Emergency contact phone">
                  <Input
                    value={form.emergency_contact_phone ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, emergency_contact_phone: e.target.value })
                    }
                  />
                </Field>
                <Field label="Enrolled on">
                  <Input
                    type="date"
                    value={form.enrolled_on ?? ""}
                    onChange={(e) => setForm({ ...form, enrolled_on: e.target.value })}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="dropped">Dropped</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="medical" className="space-y-3 pt-4">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Height (cm)">
                  <Input
                    type="number"
                    step="0.1"
                    value={form.height_cm ?? ""}
                    onChange={(e) => setForm({ ...form, height_cm: num(e.target.value) })}
                  />
                </Field>
                <Field label="Weight (kg)">
                  <Input
                    type="number"
                    step="0.1"
                    value={form.weight_kg ?? ""}
                    onChange={(e) => setForm({ ...form, weight_kg: num(e.target.value) })}
                  />
                </Field>
                <Field label="Diabetes (years)">
                  <Input
                    type="number"
                    value={form.diabetes_years ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, diabetes_years: num(e.target.value) as any })
                    }
                  />
                </Field>
                <Field label="HbA1c baseline (%)">
                  <Input
                    type="number"
                    step="0.1"
                    value={form.hba1c_baseline ?? ""}
                    onChange={(e) => setForm({ ...form, hba1c_baseline: num(e.target.value) })}
                  />
                </Field>
                <Field label="FBG (mg/dL)">
                  <Input
                    type="number"
                    step="0.1"
                    value={form.fbg_baseline ?? ""}
                    onChange={(e) => setForm({ ...form, fbg_baseline: num(e.target.value) })}
                  />
                </Field>
                <Field label="PPBG (mg/dL)">
                  <Input
                    type="number"
                    step="0.1"
                    value={form.ppbg_baseline ?? ""}
                    onChange={(e) => setForm({ ...form, ppbg_baseline: num(e.target.value) })}
                  />
                </Field>
                <Field label="BP Systolic">
                  <Input
                    type="number"
                    value={form.bp_systolic_baseline ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, bp_systolic_baseline: num(e.target.value) as any })
                    }
                  />
                </Field>
                <Field label="BP Diastolic">
                  <Input
                    type="number"
                    value={form.bp_diastolic_baseline ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, bp_diastolic_baseline: num(e.target.value) as any })
                    }
                  />
                </Field>
              </div>
              <div>
                <Label>Comorbidities</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COMORBIDITY_OPTIONS.map((c) => {
                    const active = (form.comorbidities ?? []).includes(c);
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => toggleComorbidity(c)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Current medications">
                <Textarea
                  rows={2}
                  value={form.current_medications ?? ""}
                  onChange={(e) => setForm({ ...form, current_medications: e.target.value })}
                />
              </Field>
              <Field label="Allergies">
                <Textarea
                  rows={2}
                  value={form.allergies ?? ""}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                />
              </Field>
            </TabsContent>

            <TabsContent value="care" className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hospital">
                  <PickerSelect
                    value={form.hospital_id ?? ""}
                    onChange={(v) => setForm({ ...form, hospital_id: v })}
                    options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
                  />
                </Field>
                <Field label="Referring doctor">
                  <PickerSelect
                    value={form.referring_doctor_id ?? ""}
                    onChange={(v) => setForm({ ...form, referring_doctor_id: v })}
                    options={doctors
                      .filter((d) => d.is_referrer)
                      .map((d) => ({ value: d.id, label: d.full_name }))}
                  />
                </Field>
                <Field label="Treating doctor">
                  <PickerSelect
                    value={form.treating_doctor_id ?? ""}
                    onChange={(v) => setForm({ ...form, treating_doctor_id: v })}
                    options={doctors
                      .filter((d) => d.is_treating)
                      .map((d) => ({ value: d.id, label: d.full_name }))}
                  />
                </Field>
                <Field label="Nutritionist">
                  <PickerSelect
                    value={form.nutritionist_id ?? ""}
                    onChange={(v) => setForm({ ...form, nutritionist_id: v })}
                    options={nutritionists.map((n) => ({ value: n.id, label: n.full_name }))}
                  />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-3 pt-4">
              <Field label="Notes">
                <Textarea
                  rows={6}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Enroll patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PickerSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value || "unset"} onValueChange={(v) => onChange(v === "unset" ? "" : v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unset">— None —</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PatientDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const get = useServerFn(getPatient);
  const addNote = useServerFn(addTimelineNote);
  const qc = useQueryClient();
  const [note, setNote] = useState({ title: "", description: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => get({ data: { id: id! } }),
    enabled: !!id,
  });

  const noteMut = useMutation({
    mutationFn: () =>
      addNote({
        data: { patient_id: id!, title: note.title, description: note.description || null },
      }),
    onSuccess: () => {
      toast.success("Note added");
      setNote({ title: "", description: "" });
      qc.invalidateQueries({ queryKey: ["patient", id] });
    },
    onError: (e) => toast.error("Failed", { description: (e as Error).message }),
  });

  const bmi = useMemo(() => {
    const p = data?.patient as any;
    if (!p?.height_cm || !p?.weight_kg) return null;
    const h = p.height_cm / 100;
    return (p.weight_kg / (h * h)).toFixed(1);
  }, [data]);

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        {isLoading || !data ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {(data.patient as any).full_name}
                <Badge
                  className={
                    statusColor[(data.patient as any).status] + " capitalize border-0"
                  }
                  variant="secondary"
                >
                  {(data.patient as any).status}
                </Badge>
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {(data.patient as any).patient_code}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="medical">Medical</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-3 pt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info k="Phone" v={(data.patient as any).phone} />
                  <Info k="Alt phone" v={(data.patient as any).alt_phone} />
                  <Info k="Email" v={(data.patient as any).email} />
                  <Info k="Gender" v={(data.patient as any).gender} />
                  <Info k="DOB" v={(data.patient as any).date_of_birth} />
                  <Info k="City" v={(data.patient as any).city} />
                  <Info k="Language" v={(data.patient as any).preferred_language} />
                  <Info k="Enrolled" v={(data.patient as any).enrolled_on} />
                  <Info
                    k="Treating doctor"
                    v={(data.patient as any).treating_doctor?.full_name}
                  />
                  <Info
                    k="Referring doctor"
                    v={(data.patient as any).referring_doctor?.full_name}
                  />
                  <Info k="Nutritionist" v={(data.patient as any).nutritionist?.full_name} />
                  <Info k="Hospital" v={(data.patient as any).hospital?.name} />
                </div>
                {(data.patient as any).address && (
                  <div className="text-sm">
                    <div className="text-muted-foreground">Address</div>
                    <div>{(data.patient as any).address}</div>
                  </div>
                )}
                {(data.patient as any).notes && (
                  <div className="text-sm">
                    <div className="text-muted-foreground">Notes</div>
                    <div className="whitespace-pre-wrap">{(data.patient as any).notes}</div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="medical" className="space-y-3 pt-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Info k="Height" v={(data.patient as any).height_cm && `${(data.patient as any).height_cm} cm`} />
                  <Info k="Weight" v={(data.patient as any).weight_kg && `${(data.patient as any).weight_kg} kg`} />
                  <Info k="BMI" v={bmi} />
                  <Info k="HbA1c" v={(data.patient as any).hba1c_baseline && `${(data.patient as any).hba1c_baseline} %`} />
                  <Info k="FBG" v={(data.patient as any).fbg_baseline} />
                  <Info k="PPBG" v={(data.patient as any).ppbg_baseline} />
                  <Info
                    k="BP"
                    v={
                      (data.patient as any).bp_systolic_baseline
                        ? `${(data.patient as any).bp_systolic_baseline}/${(data.patient as any).bp_diastolic_baseline ?? "?"}`
                        : null
                    }
                  />
                  <Info k="Diabetes yrs" v={(data.patient as any).diabetes_years} />
                </div>
                {(data.patient as any).comorbidities?.length ? (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Comorbidities</div>
                    <div className="flex flex-wrap gap-1">
                      {(data.patient as any).comorbidities.map((c: string) => (
                        <Badge key={c} variant="secondary">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {(data.patient as any).current_medications && (
                  <div className="text-sm">
                    <div className="text-muted-foreground">Current medications</div>
                    <div className="whitespace-pre-wrap">
                      {(data.patient as any).current_medications}
                    </div>
                  </div>
                )}
                {(data.patient as any).allergies && (
                  <div className="text-sm">
                    <div className="text-muted-foreground">Allergies</div>
                    <div>{(data.patient as any).allergies}</div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="space-y-4 pt-4">
                <form
                  className="space-y-2 rounded-md border p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!note.title.trim()) return;
                    noteMut.mutate();
                  }}
                >
                  <div className="text-sm font-medium">Add note</div>
                  <Input
                    placeholder="Title"
                    value={note.title}
                    onChange={(e) => setNote({ ...note, title: e.target.value })}
                  />
                  <Textarea
                    rows={2}
                    placeholder="Details (optional)"
                    value={note.description}
                    onChange={(e) => setNote({ ...note, description: e.target.value })}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={noteMut.isPending}>
                      Add
                    </Button>
                  </div>
                </form>

                <div className="space-y-3">
                  {(data.timeline as any[]).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No timeline entries.</div>
                  ) : (
                    (data.timeline as any[]).map((t) => (
                      <div key={t.id} className="border-l-2 border-primary/40 pl-3">
                        <div className="text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleString()} · {t.event_type}
                        </div>
                        <div className="font-medium text-sm">{t.title}</div>
                        {t.description && (
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {t.description}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ k, v }: { k: string; v: any }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{k}</div>
      <div className="capitalize">{v ?? "—"}</div>
    </div>
  );
}
